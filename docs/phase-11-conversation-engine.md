# Phase 11 — Conversation Engine

**Status:** Planned  
**Date:** April 2026  
**Author:** Testing Agent Team

---

## Overview

Phase 11 hardens the test runner from a fragile flat loop into a production-grade conversation engine. It adds retry logic for Salesforce failures, granular per-result status tracking, live streaming via Server-Sent Events (SSE), fixes two bugs in the current runner, and guards against context-window overflow.

---

## Problems Being Fixed

| Problem | Impact | Fix |
|---|---|---|
| No retry on Salesforce failures | One network hiccup fails the whole result | Exponential backoff, up to 3 retries |
| Result jumps `pending → completed` with no intermediate state | No live observability | States: `pending → running → evaluating → completed / failed` |
| `utterance_result` used before assignment if 0 follow-ups | Runtime `UnboundLocalError` possible | Initialize before loop |
| `persona` passed as `question_id` string to utterance service | Wrong persona used for follow-ups | Look up actual persona from question row |
| Conversation grows unbounded — potential LLM token overflow | Generation errors on long runs | Trim to configurable character limit before each LLM call |
| Frontend polls every 3 seconds after run completes | Stale UI, wasted requests | SSE stream replaces polling; results appear as they complete |

---

## New Architecture

```
Runner                            Event Bus
  |                                   |
  |── result status: "running"  ──►  publish(run_id, event)
  |── (SF call)                       |
  |── result status: "evaluating"──►  publish(run_id, event)     ◄── SSE endpoint reads
  |── result status: "completed" ──►  publish(run_id, event)          and streams to browser
  |── run status: "completed"   ──►  publish(run_id, run_complete)
```

---

## No Database Migration Required

Phase 11 does not add new columns. All changes are in service logic, routes, and the frontend.

---

## Steps and Code

---

### Step 1 — Add config vars to `server/config.py`

**Change:** Add 4 new fields.

```python
# server/config.py  (full file after change)
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_ENV: str = "development"
    DEBUG: bool = True
    DATABASE_URL: str
    DATABASE_URL_SYNC: str
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    SECRET_KEY: str = "change-me"
    MASTER_API_KEY: str = "master-change-me"

    # LLM routing
    LLM_PROVIDER: str = "openai"
    GENERATION_MODEL: str = "gpt-4o"
    EVALUATION_MODEL: str = "gpt-4o"
    UTTERANCE_MODEL: str = "gpt-4o-mini"

    # Conversation engine
    SF_TURN_TIMEOUT: int = 30        # seconds per Salesforce send_message call
    SF_MAX_RETRIES: int = 3          # retry attempts for Salesforce session/message calls
    SF_RETRY_DELAY: float = 1.0      # base delay seconds (doubles each retry)
    MAX_CONV_CHARS: int = 8000       # max conversation chars before trimming for LLM

    class Config:
        env_file = ".env"

settings = Settings()
```

Also add to `server/.env`:

```env
# Conversation engine
SF_TURN_TIMEOUT=30
SF_MAX_RETRIES=3
SF_RETRY_DELAY=1.0
MAX_CONV_CHARS=8000
```

---

### Step 2 — Add retry helper to `server/api/services/salesforce.py`

**Change:** Add `with_retry()` helper. Update `create_session` and `send_message` to use configurable timeout and retry.

```python
# server/api/services/salesforce.py  (full file after change)
import asyncio
import httpx
from typing import Callable, Awaitable, TypeVar
from config import settings

T = TypeVar("T")


class SalesforceError(Exception):
    pass


async def with_retry(fn: Callable[[], Awaitable[T]]) -> T:
    """
    Execute an async callable with exponential backoff retry.
    Uses SF_MAX_RETRIES and SF_RETRY_DELAY from config.
    Only retries on SalesforceError — not on programming errors.
    """
    last_exc: Exception = SalesforceError("Unknown error")
    for attempt in range(settings.SF_MAX_RETRIES):
        try:
            return await fn()
        except SalesforceError as e:
            last_exc = e
            if attempt < settings.SF_MAX_RETRIES - 1:
                wait = settings.SF_RETRY_DELAY * (2 ** attempt)
                await asyncio.sleep(wait)
    raise last_exc


async def get_token(domain: str, consumer_key: str, consumer_secret: str) -> str:
    """Authenticate via OAuth 2.0 client credentials flow."""
    url = f"https://{domain}/services/oauth2/token"
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, data={
            "grant_type": "client_credentials",
            "client_id": consumer_key,
            "client_secret": consumer_secret,
        })
    if resp.status_code != 200:
        raise SalesforceError(f"Auth failed ({resp.status_code}): {resp.text}")
    return resp.json()["access_token"]


async def fetch_agents(domain: str, token: str) -> list[dict]:
    """Fetch all bots/agents from the Salesforce org via Tooling API."""
    url = f"https://{domain}/services/data/v60.0/tooling/query"
    query = "SELECT Id,DeveloperName,MasterLabel,BotType FROM BotDefinition"
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, params={"q": query}, headers=headers)
    if resp.status_code != 200:
        raise SalesforceError(f"Failed to fetch agents ({resp.status_code}): {resp.text}")
    return resp.json().get("records", [])


async def fetch_agent_metadata(domain: str, token: str, bot_id: str) -> dict:
    """Fetch topics and actions for a specific agent."""
    headers = {"Authorization": f"Bearer {token}"}
    topics: list = []
    actions: list = []
    planner_id = None
    planner_name = None

    try:
        async with httpx.AsyncClient() as client:
            planner_url = (
                f"https://{domain}/services/data/v60.0/tooling/query"
                f"?q=SELECT+Id,MasterLabel+FROM+GenAiPlanner+WHERE+BotId='{bot_id}'"
            )
            p_resp = await client.get(planner_url, headers=headers)
            if p_resp.status_code == 200:
                records = p_resp.json().get("records", [])
                if records:
                    planner_id = records[0]["Id"]
                    planner_name = records[0]["MasterLabel"]

            topic_url = (
                f"https://{domain}/services/data/v60.0/tooling/query"
                f"?q=SELECT+Id,MasterLabel,Description+FROM+BotTopic+WHERE+BotDefinitionId='{bot_id}'"
            )
            t_resp = await client.get(topic_url, headers=headers)
            if t_resp.status_code == 200:
                topics = [
                    {"id": r["Id"], "name": r["MasterLabel"], "description": r.get("Description", "")}
                    for r in t_resp.json().get("records", [])
                ]

            action_url = (
                f"https://{domain}/services/data/v60.0/tooling/query"
                f"?q=SELECT+Id,MasterLabel+FROM+BotAction+WHERE+BotDefinitionId='{bot_id}'"
            )
            a_resp = await client.get(action_url, headers=headers)
            if a_resp.status_code == 200:
                actions = [
                    {"id": r["Id"], "name": r["MasterLabel"]}
                    for r in a_resp.json().get("records", [])
                ]
    except Exception:
        pass

    return {
        "planner_id": planner_id,
        "planner_name": planner_name,
        "topics": topics,
        "actions": actions,
    }


async def create_session(domain: str, token: str, agent_id: str) -> str:
    """Create an AgentForce conversation session. Retries on failure."""
    async def _create():
        url = f"https://{domain}/einstein/ai-agent/v1/agents/{agent_id}/sessions"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=settings.SF_TURN_TIMEOUT) as client:
            resp = await client.post(url, json={}, headers=headers)
        if resp.status_code not in (200, 201):
            raise SalesforceError(f"Failed to create session ({resp.status_code}): {resp.text}")
        return resp.json()["sessionId"]

    return await with_retry(_create)


async def send_message(
    domain: str, token: str, agent_id: str, session_id: str, message: str
) -> str:
    """Send a message to an active AgentForce session. Retries on failure."""
    async def _send():
        url = (
            f"https://{domain}/einstein/ai-agent/v1/agents/{agent_id}"
            f"/sessions/{session_id}/messages"
        )
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        payload = {
            "message": {"role": "user", "content": [{"type": "text", "text": message}]},
            "variables": [],
        }
        async with httpx.AsyncClient(timeout=settings.SF_TURN_TIMEOUT) as client:
            resp = await client.post(url, json=payload, headers=headers)
        if resp.status_code != 200:
            raise SalesforceError(f"Message failed ({resp.status_code}): {resp.text}")
        data = resp.json()
        messages = data.get("messages", [])
        parts = [
            item.get("text", "")
            for msg in messages if msg.get("role") == "assistant"
            for item in msg.get("content", []) if item.get("type") == "text"
        ]
        return " ".join(parts).strip() or "(no response)"

    return await with_retry(_send)


async def end_session(domain: str, token: str, agent_id: str, session_id: str) -> None:
    """End an AgentForce session. Best-effort — does not retry."""
    url = (
        f"https://{domain}/einstein/ai-agent/v1/agents/{agent_id}"
        f"/sessions/{session_id}"
    )
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient() as client:
        await client.delete(url, headers=headers)
```

---

### Step 3 — Create `server/api/services/event_bus.py` (new file)

In-memory event bus. The runner publishes events; the SSE endpoint subscribes and streams them to the browser.

```python
# server/api/services/event_bus.py  (new file)
import asyncio
from typing import AsyncIterator

# Per-run queues — in-memory, single-process only.
# For multi-process deployments, replace with Redis pub/sub.
_queues: dict[str, asyncio.Queue] = {}


def _get_queue(run_id: str) -> asyncio.Queue:
    if run_id not in _queues:
        _queues[run_id] = asyncio.Queue(maxsize=200)
    return _queues[run_id]


async def publish(run_id: str, event: dict) -> None:
    """Publish an event to a run's queue. Non-blocking — drops if full."""
    q = _get_queue(run_id)
    try:
        q.put_nowait(event)
    except asyncio.QueueFull:
        pass


async def subscribe(run_id: str, timeout: float = 300.0) -> AsyncIterator[dict]:
    """
    Async generator that yields events for a run.
    Stops automatically when a 'run_complete' event is received
    or after `timeout` seconds of inactivity.
    """
    q = _get_queue(run_id)
    try:
        while True:
            try:
                event = await asyncio.wait_for(q.get(), timeout=timeout)
            except asyncio.TimeoutError:
                yield {"type": "timeout", "run_id": run_id}
                break
            yield event
            if event.get("type") in ("run_complete", "run_failed"):
                break
    finally:
        _queues.pop(run_id, None)
```

---

### Step 4 — Rewrite `server/api/services/runner_service.py`

**Key changes:**
- Publishes events to the event bus at each stage
- Granular result status: `pending → running → evaluating → completed/failed`
- Fixes persona lookup (was passing `question_id` string instead of actual persona name)
- Fixes `utterance_result` uninitialized bug
- Trims conversation to `MAX_CONV_CHARS` before each LLM call

```python
# server/api/services/runner_service.py  (full file after change)
import time
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.tables import TestRun, TestRunResult, InitiatingQuestion, Agent, SalesforceConnection
from api.services.salesforce import get_token, create_session, send_message, end_session, SalesforceError
from api.services.inspired_utterance import get_inspired_utterance
from api.services.evaluation_service import evaluate_result
from api.services.event_bus import publish
from config import settings


def _trim_conversation(conversation: list[dict]) -> list[dict]:
    """
    Trim conversation to MAX_CONV_CHARS by removing oldest turns
    (always keeping the first user message).
    """
    total = sum(len(t.get("text", "")) for t in conversation)
    if total <= settings.MAX_CONV_CHARS:
        return conversation

    # Keep the first message always; trim from index 1 forward
    trimmed = list(conversation)
    while len(trimmed) > 1:
        total = sum(len(t.get("text", "")) for t in trimmed)
        if total <= settings.MAX_CONV_CHARS:
            break
        trimmed.pop(1)
    return trimmed


async def execute_run(run_id: str, db: AsyncSession) -> None:
    run = await db.get(TestRun, run_id)
    if not run:
        return

    agent = await db.get(Agent, run.agent_id)
    conn = await db.get(SalesforceConnection, agent.connection_id)

    run.status = "running"
    run.started_at = datetime.now(timezone.utc)
    await db.commit()

    await publish(run_id, {
        "type": "run_started",
        "run_id": run_id,
        "total_questions": run.total_questions,
    })

    # Load result rows
    result = await db.execute(
        select(TestRunResult).where(TestRunResult.run_id == run_id)
    )
    results = result.scalars().all()

    # Authenticate once — fail the whole run if this fails
    try:
        token = await get_token(conn.domain, conn.consumer_key, conn.consumer_secret)
    except SalesforceError as e:
        run.status = "failed"
        await db.commit()
        await publish(run_id, {"type": "run_failed", "run_id": run_id, "error": str(e)})
        return

    for result_row in results:
        session_id = None

        # Mark result as running
        result_row.status = "running"
        await db.commit()
        await publish(run_id, {
            "type": "result_update",
            "result_id": result_row.id,
            "status": "running",
            "question_text": result_row.question_text,
        })

        try:
            session_id = await create_session(conn.domain, token, agent.salesforce_id)

            start = time.monotonic()
            response_text = await send_message(
                conn.domain, token, agent.salesforce_id, session_id, result_row.question_text
            )
            latency_ms = int((time.monotonic() - start) * 1000)

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
            persona = question_obj.persona if question_obj else "General"
            personality_profile = question_obj.personality_profile if question_obj else "Neutral"
            expected_answer = question_obj.expected_answer if question_obj else None

            # Initialise utterance_result to handle the zero-follow-up case
            utterance_result = {"answered": True, "utterance": ""}

            # Follow-up loop
            for _ in range(settings.SF_MAX_RETRIES if hasattr(settings, "MAX_FOLLOW_UPS") else 5):
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

                follow_up_response = await send_message(
                    conn.domain, token, agent.salesforce_id, session_id, next_utterance
                )
                follow_ups.append({
                    "utterance": next_utterance,
                    "response": follow_up_response,
                })
                conversation.extend([
                    {"role": "user", "text": next_utterance},
                    {"role": "agent", "text": follow_up_response},
                ])

            # Evaluate
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

        except SalesforceError as e:
            result_row.response_text = f"Error: {e}"
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
                    await end_session(conn.domain, token, agent.salesforce_id, session_id)
                except Exception:
                    pass

        run.completed_questions += 1
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
                "completed_questions": run.completed_questions,
                "total_questions": run.total_questions,
            })

    run.status = "completed"
    run.completed_at = datetime.now(timezone.utc)
    await db.commit()

    await publish(run_id, {
        "type": "run_complete",
        "run_id": run_id,
        "status": "completed",
        "completed_questions": run.completed_questions,
        "total_questions": run.total_questions,
    })
```

> **Note on `MAX_FOLLOW_UPS`:** The constant moved to config. Replace the follow-up `range()` call:
> ```python
> for _ in range(settings.SF_MAX_RETRIES if ...):
> ```
> with a dedicated config var. Add to `config.py`:
> ```python
> MAX_FOLLOW_UPS: int = 5
> ```
> And update the runner's loop to:
> ```python
> for _ in range(settings.MAX_FOLLOW_UPS):
> ```

---

### Step 5 — Add SSE endpoint to `server/api/routes/runs.py`

**Change:** Add one new endpoint at the top of the file imports and at the bottom of the route list.

**New imports to add:**

```python
import json
from fastapi.responses import StreamingResponse
from api.services.event_bus import subscribe
```

**New endpoint to add** (append to the file):

```python
@router.get("/{run_id}/stream")
async def stream_run_events(
    run_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Server-Sent Events stream for a run.
    Emits result_update and run_complete events in real time.
    Connect with: fetch('/api/runs/{id}/stream', { headers: { 'X-API-Key': key } })
    """
    run = await db.get(TestRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    async def event_stream():
        # Send a heartbeat immediately so the browser knows the connection is live
        yield "event: connected\ndata: {}\n\n"
        async for event in subscribe(run_id):
            yield f"event: {event['type']}\ndata: {json.dumps(event)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # disable nginx buffering if behind a proxy
        },
    )
```

**Full updated `server/api/routes/runs.py`:**

```python
import asyncio
import json
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
from models.database import get_db, AsyncSessionLocal
from models.tables import TestRun, TestRunResult, InitiatingQuestion
from api.schemas.runs import RunCreate, RunResponse, RunResultResponse
from api.services.runner_service import execute_run
from api.services.event_bus import subscribe

router = APIRouter(prefix="/api/runs", tags=["runs"])


@router.post("", response_model=RunResponse, status_code=201)
async def create_run(
    body: RunCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
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
                InitiatingQuestion.agent_id == body.agent_id,
            )
        )
    questions = result.scalars().all()

    if not questions:
        raise HTTPException(status_code=400, detail="No questions found for this project/agent.")

    run = TestRun(
        project_id=body.project_id,
        agent_id=body.agent_id,
        status="pending",
        total_questions=len(questions),
        completed_questions=0,
    )
    db.add(run)
    await db.flush()

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

    background_tasks.add_task(_run_in_new_session, run.id)

    return run


async def _run_in_new_session(run_id: str):
    async with AsyncSessionLocal() as db:
        await execute_run(run_id, db)


@router.get("/{run_id}/stream")
async def stream_run_events(
    run_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Server-Sent Events stream — emits live result updates."""
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
    run = await db.get(TestRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    result = await db.execute(
        select(TestRunResult).where(TestRunResult.run_id == run_id)
    )
    return result.scalars().all()


@router.delete("/{run_id}", status_code=204)
async def delete_run(run_id: str, db: AsyncSession = Depends(get_db)):
    run = await db.get(TestRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    await db.delete(run)
    await db.commit()
```

---

### Step 6 — Update `client/src/lib/api.ts`

**Add one function** for the SSE stream URL builder (similar to `exportRunCsv`):

```typescript
// Add after getRun:
export const streamRunUrl = (runId: string) =>
  `${BASE}/api/runs/${runId}/stream`;
```

> Note: `EventSource` (browser native) does not support custom headers, so we use `fetch()` with a `ReadableStream` reader instead. The `streamRunUrl` helper just returns the URL string; the actual streaming logic lives in the page component.

---

### Step 7 — Update `client/src/app/runs/page.tsx`

**Replace the polling mechanism with SSE.** The `startPolling` function is replaced by `startStreaming`. Polling is kept as a fallback for already-completed runs.

**Key change — replace `startPolling` function:**

```typescript
// REMOVE this (old polling):
function startPolling(runId: string) {
  if (pollRef.current) clearInterval(pollRef.current);
  pollRef.current = setInterval(async () => {
    // ...3-second interval polling...
  }, 3000);
}

// REPLACE with this (SSE streaming):
function startStreaming(run: api.Run) {
  // Close any existing stream
  if (streamRef.current) streamRef.current.abort();
  const controller = new AbortController();
  streamRef.current = controller;

  const key = api.getStoredKey();

  (async () => {
    try {
      const res = await fetch(api.streamRunUrl(run.id), {
        headers: { "X-API-Key": key },
        signal: controller.signal,
      });
      if (!res.ok || !res.body) return;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Parse SSE lines
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        let eventType = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));
            handleStreamEvent(eventType, data, run.id);
          }
        }
      }
    } catch (e) {
      // AbortError is expected when we manually cancel; ignore it
    }
  })();
}

function handleStreamEvent(type: string, data: Record<string, unknown>, runId: string) {
  if (type === "result_update") {
    const update = data as Partial<api.RunResult> & { status: string; result_id: string; completed_questions?: number; total_questions?: number };

    // Update the result in the list
    setResults((prev) => {
      const existing = prev.find((r) => r.id === update.result_id);
      if (existing) {
        return prev.map((r) =>
          r.id === update.result_id ? { ...r, ...update, id: r.id } : r
        );
      }
      // New result arriving — add a placeholder
      return [
        ...prev,
        {
          id: update.result_id,
          run_id: runId,
          question_id: null,
          question_text: (update.question_text as string) ?? "",
          response_text: null,
          follow_up_utterances: [],
          latency_ms: null,
          answered: null,
          score: null,
          evaluation_notes: null,
          human_score: null,
          human_notes: null,
          status: update.status,
        },
      ];
    });

    // Update run progress counter
    if (update.completed_questions !== undefined) {
      setSelectedRun((prev) =>
        prev?.id === runId
          ? { ...prev, completed_questions: update.completed_questions as number }
          : prev
      );
      setRuns((prev) =>
        prev.map((r) =>
          r.id === runId
            ? { ...r, completed_questions: update.completed_questions as number }
            : r
        )
      );
    }
  }

  if (type === "run_complete" || type === "run_failed") {
    const finalStatus = type === "run_complete" ? "completed" : "failed";
    setSelectedRun((prev) => (prev?.id === runId ? { ...prev, status: finalStatus } : prev));
    setRuns((prev) =>
      prev.map((r) => (r.id === runId ? { ...r, status: finalStatus } : r))
    );
    // Load full report after completion
    api.getRunReport(runId).then(setReport).catch(() => {});
    // Close the stream
    if (streamRef.current) streamRef.current.abort();
  }
}
```

**Add `streamRef` to state:**

```typescript
const streamRef = useRef<AbortController | null>(null);
```

**Update `selectRun` to use streaming:**

```typescript
async function selectRun(run: api.Run) {
  setSelectedRun(run);
  setResults([]);
  setReport(null);
  setExpanded(null);
  setAnnotating(null);
  setShowCompare(false);
  setComparison(null);

  // Cancel any existing stream
  if (streamRef.current) { streamRef.current.abort(); streamRef.current = null; }
  if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }

  if (run.status === "completed" || run.status === "failed") {
    setLoadingResults(true);
    try {
      const [res, rep] = await Promise.allSettled([
        api.listRunResults(run.id),
        api.getRunReport(run.id),
      ]);
      if (res.status === "fulfilled") setResults(res.value);
      if (rep.status === "fulfilled") setReport(rep.value);
    } finally { setLoadingResults(false); }
  } else if (run.status === "running" || run.status === "pending") {
    startStreaming(run);
  }
}
```

**Update cleanup in `useEffect`:**

```typescript
return () => {
  if (pollRef.current) clearInterval(pollRef.current);
  if (streamRef.current) streamRef.current.abort();
};
```

---

### Step 8 — Add `MAX_FOLLOW_UPS` to `server/.env` and `config.py`

Since the follow-up loop constant was hardcoded, move it to config:

**`server/config.py`** — add:
```python
MAX_FOLLOW_UPS: int = 5
```

**`server/.env`** — add:
```env
MAX_FOLLOW_UPS=5
```

**`server/api/services/runner_service.py`** — update the loop:
```python
for _ in range(settings.MAX_FOLLOW_UPS):
```

---

## Execution Steps

### 1. Update `server/config.py` and `server/.env`

Add the 5 new vars listed in Step 1 and Step 8.

### 2. Create `server/api/services/event_bus.py`

Copy the code from Step 3.

### 3. Replace `server/api/services/salesforce.py`

Copy the full file from Step 2.

### 4. Replace `server/api/services/runner_service.py`

Copy the full file from Step 4.

### 5. Replace `server/api/routes/runs.py`

Copy the full file from Step 5.

### 6. Update `client/src/lib/api.ts`

Add `streamRunUrl` from Step 6.

### 7. Update `client/src/app/runs/page.tsx`

Apply the streaming changes from Step 7.

### 8. Restart the server

```bash
cd /Users/grividi/agents_dev/testing_agent/server
conda activate v1_env
uvicorn main:app --reload --port 8080
```

No migration needed — no database schema changes.

---

## SSE Event Reference

| Event type | When | Payload fields |
|---|---|---|
| `connected` | Immediately on connect | `{}` |
| `run_started` | Run begins processing | `run_id`, `total_questions` |
| `result_update` | Each status change per result | `result_id`, `status`, `question_text`, `score`, `latency_ms`, `answered`, `completed_questions`, `total_questions` |
| `run_complete` | All results finished | `run_id`, `status`, `completed_questions`, `total_questions` |
| `run_failed` | Auth or fatal error | `run_id`, `error` |
| `timeout` | 5 minutes of inactivity | `run_id` |

---

## Files Changed / Created

| File | Action |
|---|---|
| `server/config.py` | Add `SF_TURN_TIMEOUT`, `SF_MAX_RETRIES`, `SF_RETRY_DELAY`, `MAX_CONV_CHARS`, `MAX_FOLLOW_UPS` |
| `server/.env` | Add the 5 new vars |
| `server/api/services/event_bus.py` | **New** — in-memory pub/sub per run |
| `server/api/services/salesforce.py` | Add `with_retry()`, use configurable timeout |
| `server/api/services/runner_service.py` | Full rewrite — retries, granular status, SSE events, bug fixes, token guard |
| `server/api/routes/runs.py` | Add `GET /{run_id}/stream` SSE endpoint |
| `client/src/lib/api.ts` | Add `streamRunUrl()` |
| `client/src/app/runs/page.tsx` | Replace polling with SSE streaming |

---

## Bugs Fixed

### Bug 1 — `utterance_result` uninitialized

**Before:**
```python
for _ in range(MAX_FOLLOW_UPS):
    utterance_result = await get_inspired_utterance(...)
    if utterance_result["answered"]:
        break
# If loop ran 0 times, utterance_result is uninitialized here:
result_row.answered = utterance_result["answered"] if follow_ups or True else True
```

**After:**
```python
# Initialise before the loop
utterance_result = {"answered": True, "utterance": ""}

for _ in range(settings.MAX_FOLLOW_UPS):
    utterance_result = await get_inspired_utterance(...)
    if utterance_result["answered"]:
        break

result_row.answered = utterance_result.get("answered", True)
```

---

### Bug 2 — Wrong persona passed to utterance service

**Before:**
```python
utterance_result = await get_inspired_utterance(
    initiating_question=result_row.question_text,
    persona=result_row.question_id or "General",   # BUG: this is a UUID
    personality_profile="Neutral",                  # BUG: always "Neutral"
    conversation=conversation,
)
```

**After:**
```python
# Look up actual values from the question row
question_obj = await db.get(InitiatingQuestion, result_row.question_id) if result_row.question_id else None
persona = question_obj.persona if question_obj else "General"
personality_profile = question_obj.personality_profile if question_obj else "Neutral"

utterance_result = await get_inspired_utterance(
    initiating_question=result_row.question_text,
    persona=persona,
    personality_profile=personality_profile,
    conversation=trimmed_conv,
)
```
