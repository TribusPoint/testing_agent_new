from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case
from models.database import get_db
from models.tables import TestRun, TestRunResult, Agent

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary")
async def get_summary(db: AsyncSession = Depends(get_db)):
    """Platform-wide aggregate statistics."""
    run_stats = await db.execute(
        select(
            func.count(TestRun.id).label("total_runs"),
            func.count(
                case((TestRun.status == "completed", TestRun.id))
            ).label("completed_runs"),
        )
    )
    row = run_stats.one()

    result_stats = await db.execute(
        select(
            func.count(TestRunResult.id).label("total_questions"),
            func.avg(TestRunResult.score).label("avg_score"),
            func.count(
                case((TestRunResult.score >= 70, TestRunResult.id))
            ).label("pass_count"),
            func.count(
                case((TestRunResult.score.isnot(None), TestRunResult.id))
            ).label("scored_count"),
        ).where(TestRunResult.status == "completed")
    )
    res = result_stats.one()

    agent_count = await db.scalar(
        select(func.count(func.distinct(TestRun.agent_id)))
    )
    project_count = await db.scalar(
        select(func.count(func.distinct(TestRun.project_id)))
    )

    avg_score = round(float(res.avg_score), 1) if res.avg_score is not None else None
    pass_rate = (
        round(res.pass_count / res.scored_count * 100, 1)
        if res.scored_count and res.scored_count > 0
        else None
    )

    return {
        "total_runs": row.total_runs,
        "completed_runs": row.completed_runs,
        "total_questions_tested": res.total_questions or 0,
        "overall_avg_score": avg_score,
        "overall_pass_rate": pass_rate,
        "agents_count": agent_count or 0,
        "projects_count": project_count or 0,
    }


@router.get("/agents")
async def list_agents_with_runs(db: AsyncSession = Depends(get_db)):
    """Return agents that have at least one completed run."""
    result = await db.execute(
        select(Agent.id, Agent.name)
        .join(TestRun, TestRun.agent_id == Agent.id)
        .where(TestRun.status == "completed")
        .distinct()
        .order_by(Agent.name)
    )
    return [{"id": r.id, "name": r.name} for r in result.all()]


@router.get("/agents/{agent_id}/trend")
async def get_agent_trend(
    agent_id: str,
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Score + pass-rate trend for the last `limit` completed runs of an agent."""
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    runs_result = await db.execute(
        select(TestRun)
        .where(TestRun.agent_id == agent_id, TestRun.status == "completed")
        .order_by(TestRun.completed_at.desc())
        .limit(limit)
    )
    runs = list(reversed(runs_result.scalars().all()))  # oldest first for chart

    trend = []
    for run in runs:
        stats = await db.execute(
            select(
                func.avg(TestRunResult.score).label("avg_score"),
                func.count(TestRunResult.id).label("total"),
                func.count(
                    case((TestRunResult.score >= 70, TestRunResult.id))
                ).label("passed"),
            ).where(
                TestRunResult.run_id == run.id,
                TestRunResult.status == "completed",
                TestRunResult.score.isnot(None),
            )
        )
        s = stats.one()
        avg = round(float(s.avg_score), 1) if s.avg_score is not None else None
        pass_rate = (
            round(s.passed / s.total * 100, 1) if s.total and s.total > 0 else None
        )
        trend.append({
            "run_id": run.id,
            "run_short": run.id[:8],
            "completed_at": run.completed_at.isoformat() if run.completed_at else None,
            "avg_score": avg,
            "pass_rate": pass_rate,
            "completed_questions": run.completed_questions,
        })

    return {"agent_id": agent_id, "agent_name": agent.name, "runs": trend}


@router.get("/questions/weakest")
async def get_weakest_questions(
    project_id: str | None = Query(default=None),
    agent_id: str | None = Query(default=None),
    limit: int = Query(default=15, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Questions that consistently score lowest across completed runs."""
    query = (
        select(
            TestRunResult.question_text,
            func.avg(TestRunResult.score).label("avg_score"),
            func.min(TestRunResult.score).label("min_score"),
            func.max(TestRunResult.score).label("max_score"),
            func.count(TestRunResult.id).label("run_count"),
            func.count(
                case((TestRunResult.score >= 70, TestRunResult.id))
            ).label("pass_count"),
        )
        .join(TestRun, TestRunResult.run_id == TestRun.id)
        .where(
            TestRunResult.status == "completed",
            TestRunResult.score.isnot(None),
        )
    )
    if project_id:
        query = query.where(TestRun.project_id == project_id)
    if agent_id:
        query = query.where(TestRun.agent_id == agent_id)

    query = (
        query.group_by(TestRunResult.question_text)
        .having(func.count(TestRunResult.id) >= 1)
        .order_by(func.avg(TestRunResult.score).asc())
        .limit(limit)
    )

    result = await db.execute(query)
    rows = result.all()

    return [
        {
            "question_text": r.question_text,
            "avg_score": round(float(r.avg_score), 1) if r.avg_score is not None else None,
            "min_score": r.min_score,
            "max_score": r.max_score,
            "run_count": r.run_count,
            "pass_rate": round(r.pass_count / r.run_count * 100, 1) if r.run_count else None,
        }
        for r in rows
    ]
