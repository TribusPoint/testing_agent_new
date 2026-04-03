import asyncio
from typing import AsyncIterator

# Per-run queues — in-memory, single-process only.
# For multi-process deployments replace with Redis pub/sub.
_queues: dict[str, asyncio.Queue] = {}


def _get_queue(run_id: str) -> asyncio.Queue:
    if run_id not in _queues:
        _queues[run_id] = asyncio.Queue(maxsize=200)
    return _queues[run_id]


async def publish(run_id: str, event: dict) -> None:
    """Publish an event to a run's queue. Non-blocking — drops silently if full."""
    q = _get_queue(run_id)
    try:
        q.put_nowait(event)
    except asyncio.QueueFull:
        pass


async def subscribe(run_id: str, timeout: float = 300.0) -> AsyncIterator[dict]:
    """
    Async generator that yields events for a run.
    Stops automatically when a run_complete or run_failed event is received,
    or after `timeout` seconds of inactivity (default 5 minutes).
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
