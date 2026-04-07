
import asyncio
import json
import logging
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete as sa_delete, update as sa_update, or_
from datetime import datetime, timezone
from models.database import get_db, AsyncSessionLocal
from models.tables import TestRun, TestRunResult, InitiatingQuestion
from api.schemas.runs import RunCreate, RunResponse, RunResultResponse
from api.services.runner_service import execute_run, request_cancel
from api.services.event_bus import subscribe

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/runs", tags=["runs"])


@router.post("", response_model=RunResponse, status_code=201)
async def create_run(
    body: RunCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    # Load questions to run
    if body.question_ids:
        result = await db.execute(
            select(InitiatingQuestion).where(
                InitiatingQuestion.id.in_(body.question_ids),
                InitiatingQuestion.project_id == body.project_id,
            )
        )
    else:
        result = await db.execute(
            select(InitiatingQuestion).where(
                InitiatingQuestion.project_id == body.project_id,
                or_(
                    InitiatingQuestion.agent_id == body.agent_id,
                    InitiatingQuestion.agent_id.is_(None),
                ),
            )
        )
    questions = result.scalars().all()

    if not questions:
        raise HTTPException(
            status_code=400,
            detail="No questions for this project and agent. Generate questions on the project, or pick a different agent.",
        )

    # Create run record
    run = TestRun(
        project_id=body.project_id,
        agent_id=body.agent_id,
        status="pending",
        total_questions=len(questions),
        completed_questions=0,
    )
    db.add(run)
    await db.flush()

    # Pre-create result rows (one per question)
    for q in questions:
        db.add(TestRunResult(
            run_id=run.id,
            question_id=q.id,
            question_text=q.question,
            status="pending",
            follow_up_utterances=[],
        ))

    await db.commit()
    await db.refresh(run)

    # Run asynchronously in background
    background_tasks.add_task(_run_in_new_session, run.id)

    return run


async def _run_in_new_session(run_id: str):
    async with AsyncSessionLocal() as db:
        await execute_run(run_id, db)


@router.get("", response_model=list[RunResponse])
async def list_runs(
    project_id: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(TestRun).order_by(TestRun.started_at.desc())
    if project_id:
        query = query.where(TestRun.project_id == project_id)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{run_id}", response_model=RunResponse)
async def get_run(run_id: str, db: AsyncSession = Depends(get_db)):
    run = await db.get(TestRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


@router.get("/{run_id}/results", response_model=list[RunResultResponse])
async def get_run_results(run_id: str, db: AsyncSession = Depends(get_db)):
    # Verify run exists without loading ORM object (avoids relationship tracking)
    exists = await db.execute(
        select(TestRun.id).where(TestRun.id == run_id)
    )
    if not exists.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Run not found")
    result = await db.execute(
        select(TestRunResult).where(TestRunResult.run_id == run_id)
    )
    return result.scalars().all()


@router.get("/{run_id}/stream")
async def stream_run_events(run_id: str, db: AsyncSession = Depends(get_db)):
    """Server-Sent Events endpoint for live run progress."""
    run = await db.get(TestRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    async def event_stream():
        yield "event: connected\ndata: {}\n\n"
        async for event in subscribe(run_id):
            yield f"event: {event['type']}\ndata: {json.dumps(event)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/{run_id}/cancel", status_code=200)
async def cancel_run(run_id: str, db: AsyncSession = Depends(get_db)):
    """Signal a running run to stop after the current question completes."""
    exists = await db.execute(select(TestRun.id, TestRun.status).where(TestRun.id == run_id))
    row = exists.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Run not found")
    if row.status not in ("running", "pending"):
        raise HTTPException(status_code=400, detail=f"Run is already {row.status}")
    request_cancel(run_id)
    await db.execute(
        sa_update(TestRun).where(TestRun.id == run_id).values(status="cancelling")
    )
    await db.commit()
    return {"ok": True, "message": "Cancellation requested"}


@router.delete("/{run_id}", status_code=204)
async def delete_run(run_id: str, db: AsyncSession = Depends(get_db)):
    # Use raw SQL DELETE — avoids SQLAlchemy ORM trying to SET run_id=NULL on
    # child rows before deleting the parent (DB-level CASCADE handles children).
    result = await db.execute(
        sa_delete(TestRun).where(TestRun.id == run_id)
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Run not found")
    await db.commit()
