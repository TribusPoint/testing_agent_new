import csv
import io
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.database import get_db
from models.tables import TestRun, TestRunResult
from api.schemas.runs import RunReport, ScoreDistribution, ResultAnnotate, RunComparison, QuestionDelta

router = APIRouter(prefix="/api/runs", tags=["reports"])


@router.get("/{run_id}/report", response_model=RunReport)
async def get_run_report(run_id: str, db: AsyncSession = Depends(get_db)):
    run = await db.get(TestRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    result = await db.execute(
        select(TestRunResult).where(TestRunResult.run_id == run_id)
    )
    rows = result.scalars().all()

    completed = [r for r in rows if r.status == "completed"]
    scored = [r for r in completed if r.score is not None]
    passing = [r for r in scored if r.score >= 70]

    avg_score = round(sum(r.score for r in scored) / len(scored), 1) if scored else None
    latencies = [r.latency_ms for r in completed if r.latency_ms is not None]
    avg_latency = round(sum(latencies) / len(latencies), 1) if latencies else None

    dist = ScoreDistribution(
        bucket_0_25=sum(1 for r in scored if r.score <= 25),
        bucket_26_50=sum(1 for r in scored if 26 <= r.score <= 50),
        bucket_51_75=sum(1 for r in scored if 51 <= r.score <= 75),
        bucket_76_100=sum(1 for r in scored if r.score >= 76),
    )

    return RunReport(
        run_id=run_id,
        status=run.status,
        total_results=len(rows),
        completed_results=len(completed),
        pass_count=len(passing),
        pass_rate=round(len(passing) / len(scored) * 100, 1) if scored else 0.0,
        avg_score=avg_score,
        avg_latency_ms=avg_latency,
        score_distribution=dist,
    )


@router.get("/{run_id}/export")
async def export_run_csv(run_id: str, db: AsyncSession = Depends(get_db)):
    run = await db.get(TestRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    result = await db.execute(
        select(TestRunResult).where(TestRunResult.run_id == run_id)
    )
    rows = result.scalars().all()

    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=[
            "result_id",
            "question_text",
            "response_text",
            "answered",
            "score",
            "evaluation_notes",
            "latency_ms",
            "turn_count",
            "status",
        ],
    )
    writer.writeheader()
    for r in rows:
        writer.writerow({
            "result_id": r.id,
            "question_text": r.question_text,
            "response_text": r.response_text or "",
            "answered": r.answered,
            "score": r.score if r.score is not None else "",
            "evaluation_notes": r.evaluation_notes or "",
            "latency_ms": r.latency_ms if r.latency_ms is not None else "",
            "turn_count": len(r.follow_up_utterances or []) + 1,
            "status": r.status,
        })

    output.seek(0)
    filename = f"run_{run_id[:8]}_results.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.patch("/{run_id}/results/{result_id}/annotate", response_model=dict)
async def annotate_result(
    run_id: str,
    result_id: str,
    body: ResultAnnotate,
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(TestRunResult, result_id)
    if not row or row.run_id != run_id:
        raise HTTPException(status_code=404, detail="Result not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    await db.commit()
    return {"ok": True}


@router.get("/compare", response_model=RunComparison)
async def compare_runs(
    run_a: str = Query(...),
    run_b: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    for run_id in (run_a, run_b):
        run = await db.get(TestRun, run_id)
        if not run:
            raise HTTPException(status_code=404, detail=f"Run {run_id} not found")

    res_a_q = await db.execute(select(TestRunResult).where(TestRunResult.run_id == run_a))
    res_b_q = await db.execute(select(TestRunResult).where(TestRunResult.run_id == run_b))
    rows_a = {r.question_id: r for r in res_a_q.scalars().all()}
    rows_b = {r.question_id: r for r in res_b_q.scalars().all()}

    all_qids = set(rows_a.keys()) | set(rows_b.keys())
    deltas: list[QuestionDelta] = []
    for qid in all_qids:
        ra = rows_a.get(qid)
        rb = rows_b.get(qid)
        score_a = ra.score if ra else None
        score_b = rb.score if rb else None
        delta = (score_b - score_a) if (score_a is not None and score_b is not None) else None
        deltas.append(QuestionDelta(
            question_id=qid,
            question_text=(ra or rb).question_text,
            score_a=score_a,
            score_b=score_b,
            delta=delta,
        ))

    deltas.sort(key=lambda d: (d.delta is None, d.delta if d.delta is not None else 0))

    scored_a = [d.score_a for d in deltas if d.score_a is not None]
    scored_b = [d.score_b for d in deltas if d.score_b is not None]
    paired = [(d.score_a, d.score_b) for d in deltas if d.score_a is not None and d.score_b is not None]

    avg_a = round(sum(scored_a) / len(scored_a), 1) if scored_a else None
    avg_b = round(sum(scored_b) / len(scored_b), 1) if scored_b else None
    avg_delta = round(sum(b - a for a, b in paired) / len(paired), 1) if paired else None

    return RunComparison(
        run_a=run_a,
        run_b=run_b,
        avg_score_a=avg_a,
        avg_score_b=avg_b,
        avg_delta=avg_delta,
        questions=deltas,
    )
