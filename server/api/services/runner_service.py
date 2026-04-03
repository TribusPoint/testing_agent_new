import time
import logging
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update as sa_update
from models.tables import TestRun, TestRunResult, InitiatingQuestion, Agent, SalesforceConnection
from api.services.salesforce import get_token, create_session, send_message, end_session, SalesforceError
from api.services.http_service import send_http_message, HttpServiceError
from api.services.inspired_utterance import get_inspired_utterance
from api.services.evaluation_service import evaluate_result
from api.services.event_bus import publish
from config import settings

logger = logging.getLogger(__name__)

# In-memory set of run IDs that have been requested to cancel.
# The runner checks this before each question and stops gracefully.
_cancelled_runs: set[str] = set()


def request_cancel(run_id: str) -> None:
    _cancelled_runs.add(run_id)


def is_cancelled(run_id: str) -> bool:
    return run_id in _cancelled_runs


def clear_cancelled(run_id: str) -> None:
    _cancelled_runs.discard(run_id)


def _trim_conversation(conversation: list[dict]) -> list[dict]:
    """
    Trim conversation history to MAX_CONV_CHARS by removing oldest turns
    (always keeping the first user message to preserve context).
    """
    total = sum(len(t.get("text", "")) for t in conversation)
    if total <= settings.MAX_CONV_CHARS:
        return conversation
    trimmed = list(conversation)
    while len(trimmed) > 1:
        total = sum(len(t.get("text", "")) for t in trimmed)
        if total <= settings.MAX_CONV_CHARS:
            break
        trimmed.pop(1)
    return trimmed


async def execute_run(run_id: str, db: AsyncSession) -> None:
    # Load run metadata, then immediately expunge from session so the ORM's
    # back-populates relationship never leaks TestRunResult objects into our
    # session and causes NULL run_id updates on commit.
    run = await db.get(TestRun, run_id)
    if not run:
        return

    agent_id = run.agent_id
    total_questions = run.total_questions
    db.expunge(run)

    agent = await db.get(Agent, agent_id)
    agent_salesforce_id = agent.salesforce_id
    agent_developer_name = agent.developer_name or ""
    agent_runtime_url = agent.runtime_url or None
    agent_config = agent.config or {}
    conn = await db.get(SalesforceConnection, agent.connection_id)
    conn_domain = conn.domain
    conn_consumer_key = conn.consumer_key
    conn_consumer_secret = conn.consumer_secret
    conn_type = conn.connection_type or "salesforce"
    conn_config = conn.config or {}
    db.expunge(agent)
    db.expunge(conn)

    # All TestRun mutations go through raw SQL to keep the ORM session clean.
    await db.execute(
        sa_update(TestRun)
        .where(TestRun.id == run_id)
        .values(status="running", started_at=datetime.utcnow())
    )
    await db.commit()

    await publish(run_id, {
        "type": "run_started",
        "run_id": run_id,
        "total_questions": total_questions,
    })

    # Load all result rows for this run
    result = await db.execute(
        select(TestRunResult).where(TestRunResult.run_id == run_id)
    )
    results = result.scalars().all()

    # Authenticate once for Salesforce; HTTP needs no pre-auth
    token = None
    if conn_type == "salesforce":
        try:
            token = await get_token(conn_domain, conn_consumer_key, conn_consumer_secret)
        except SalesforceError as e:
            await db.execute(
                sa_update(TestRun).where(TestRun.id == run_id).values(status="failed")
            )
            await db.commit()
            await publish(run_id, {"type": "run_failed", "run_id": run_id, "error": str(e)})
            return

    completed_count = 0

    for result_row in results:
        if is_cancelled(run_id):
            logger.info("Run %s cancelled before question %s", run_id, result_row.id)
            break

        session_id = None

        # Transition: pending → running
        result_row.status = "running"
        await db.commit()
        await publish(run_id, {
            "type": "result_update",
            "result_id": result_row.id,
            "status": "running",
            "question_text": result_row.question_text,
        })

        try:
            session_id = None
            seq = 1

            if conn_type == "http":
                # ── Generic HTTP ──────────────────────────────────────────
                start = time.monotonic()
                response_text = await send_http_message(
                    conn_config=conn_config,
                    agent_config=agent_config,
                    question=result_row.question_text,
                    timeout=settings.SF_TURN_TIMEOUT,
                )
                latency_ms = int((time.monotonic() - start) * 1000)
            else:
                # ── Salesforce AgentForce ────────────────────────────────
                session_id = await create_session(
                    conn_domain, token, agent_salesforce_id,
                    developer_name=agent_developer_name,
                    runtime_url=agent_runtime_url,
                )
                start = time.monotonic()
                response_text = await send_message(
                    conn_domain, token, agent_salesforce_id, session_id,
                    result_row.question_text, seq_id=seq,
                )
                latency_ms = int((time.monotonic() - start) * 1000)
                seq += 1

            conversation = [
                {"role": "user", "text": result_row.question_text},
                {"role": "agent", "text": response_text},
            ]
            follow_ups = []

            # Look up actual persona and personality profile from the question row
            question_obj = (
                await db.get(InitiatingQuestion, result_row.question_id)
                if result_row.question_id else None
            )
            persona = (question_obj.persona or "General") if question_obj else "General"
            personality_profile = (question_obj.personality_profile or "Neutral") if question_obj else "Neutral"
            expected_answer = question_obj.expected_answer if question_obj else None

            # Initialise to avoid UnboundLocalError when 0 follow-ups occur
            utterance_result: dict = {"answered": True, "utterance": ""}

            # Follow-up loop
            for _ in range(settings.MAX_FOLLOW_UPS):
                trimmed_conv = _trim_conversation(conversation)
                utterance_result = await get_inspired_utterance(
                    initiating_question=result_row.question_text,
                    persona=persona,
                    personality_profile=personality_profile,
                    conversation=trimmed_conv,
                )
                if utterance_result["answered"]:
                    break
                next_utterance = utterance_result.get("utterance", "")
                if not next_utterance:
                    break

                if conn_type == "http":
                    follow_up_response = await send_http_message(
                        conn_config=conn_config,
                        agent_config=agent_config,
                        question=next_utterance,
                        timeout=settings.SF_TURN_TIMEOUT,
                    )
                else:
                    follow_up_response = await send_message(
                        conn_domain, token, agent_salesforce_id, session_id,
                        next_utterance, seq_id=seq,
                    )
                    seq += 1
                follow_ups.append({
                    "utterance": next_utterance,
                    "response": follow_up_response,
                })
                conversation.extend([
                    {"role": "user", "text": next_utterance},
                    {"role": "agent", "text": follow_up_response},
                ])

            # Transition: running → evaluating
            result_row.status = "evaluating"
            await db.commit()
            await publish(run_id, {
                "type": "result_update",
                "result_id": result_row.id,
                "status": "evaluating",
            })

            evaluation = await evaluate_result(
                result_row.question_text,
                _trim_conversation(conversation),
                expected_answer=expected_answer,
            )

            result_row.response_text = response_text
            result_row.follow_up_utterances = follow_ups
            result_row.latency_ms = latency_ms
            result_row.answered = utterance_result.get("answered", True)
            result_row.score = evaluation["score"]
            result_row.evaluation_notes = evaluation["notes"]
            result_row.status = "completed"

        except (SalesforceError, HttpServiceError) as e:
            logger.error("Connector error for result %s in run %s: %s", result_row.id, run_id, e)
            result_row.response_text = f"Error: {e}"
            result_row.status = "failed"
            await publish(run_id, {
                "type": "result_update",
                "result_id": result_row.id,
                "status": "failed",
                "error": str(e),
            })
        except Exception as e:
            logger.exception("Unexpected error for result %s in run %s", result_row.id, run_id)
            result_row.response_text = f"Unexpected error: {e}"
            result_row.status = "failed"
            await publish(run_id, {
                "type": "result_update",
                "result_id": result_row.id,
                "status": "failed",
                "error": str(e),
            })
        finally:
            if session_id:
                try:
                    await end_session(conn_domain, token, agent_salesforce_id, session_id)
                except Exception:
                    pass

        completed_count += 1
        await db.execute(
            sa_update(TestRun)
            .where(TestRun.id == run_id)
            .values(completed_questions=completed_count)
        )
        await db.commit()

        if result_row.status == "completed":
            await publish(run_id, {
                "type": "result_update",
                "result_id": result_row.id,
                "status": "completed",
                "score": result_row.score,
                "latency_ms": result_row.latency_ms,
                "answered": result_row.answered,
                "response_text": result_row.response_text,
                "evaluation_notes": result_row.evaluation_notes,
                "follow_up_count": len(result_row.follow_up_utterances or []),
                "completed_questions": completed_count,
                "total_questions": total_questions,
            })

    final_status = "cancelled" if is_cancelled(run_id) else "completed"
    clear_cancelled(run_id)

    await db.execute(
        sa_update(TestRun)
        .where(TestRun.id == run_id)
        .values(status=final_status, completed_at=datetime.utcnow())
    )
    await db.commit()

    await publish(run_id, {
        "type": "run_complete",
        "run_id": run_id,
        "status": final_status,
        "completed_questions": completed_count,
        "total_questions": total_questions,
    })
