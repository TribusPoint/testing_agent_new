"""After a Salesforce connection is saved: sync API agents, then runtime discover + SOQL candidates."""

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.services import agent_discovery_service as discovery
from api.services.salesforce import SalesforceError
from api.services.salesforce_agent_sync import sync_salesforce_agents
from models.tables import Agent, ServiceConnection

SOQL_FALLBACK_QUERIES = [
    "SELECT Id, MasterLabel, DeveloperName FROM BotDefinition",
    "SELECT Id, MasterLabel, DeveloperName FROM GenAiPlanner",
    "SELECT Id, MasterLabel, DeveloperName FROM BotVersion",
    "SELECT Id, MasterLabel, DeveloperName FROM AiAgent",
]


def _candidate_key(c: dict[str, Any]) -> str:
    return str(c.get("id") or "")


async def bootstrap_salesforce_connection(
    db: AsyncSession, connection_id: str, conn: ServiceConnection
) -> tuple[list[Agent], list[dict[str, Any]], str, dict[str, Any]]:
    """
    1) Standard Salesforce agents API (sync).
    2) If no agents: runtime ID discovery + SOQL fallbacks → candidates (not inserted).

    Returns (agents, candidates, message, diagnostics) for UI verification.
    """
    if (conn.connection_type or "salesforce") != "salesforce":
        result = await db.execute(select(Agent).where(Agent.connection_id == connection_id).order_by(Agent.name))
        agents = list(result.scalars().all())
        return (
            agents,
            [],
            "",
            {
                "path": "non_salesforce",
                "note": "Listed existing agents from the database for this connection type.",
                "agent_count": len(agents),
            },
        )

    messages: list[str] = []

    try:
        agents = await sync_salesforce_agents(db, connection_id, conn)
    except SalesforceError as e:
        err_msg = f"Could not reach Salesforce: {e}"
        return (
            [],
            [],
            err_msg,
            {"path": "error", "phase": "salesforce_agent_sync", "error": str(e)},
        )

    known_ids = {a.salesforce_id for a in agents}
    candidates: list[dict[str, Any]] = []

    if agents:
        messages.append(f"Connected and synced {len(agents)} agent(s) from Salesforce.")
        msg = " ".join(messages)
        return (
            agents,
            candidates,
            msg,
            {
                "path": "salesforce_agent_sync",
                "sync_agent_count": len(agents),
                "discovery_skipped": True,
                "summary": msg,
            },
        )

    messages.append("No agents returned from the Salesforce agents list API.")

    dr = await discovery.discover_runtime_ids(
        conn.domain, conn.consumer_key, conn.consumer_secret, conn.connection_type or "salesforce"
    )
    runtime_agents = dr.get("agents") or []
    for row in runtime_agents:
        rid = row.get("id") or ""
        if not rid or rid in known_ids:
            continue
        if any(_candidate_key(c) == rid for c in candidates):
            continue
        candidates.append(
            {
                "id": rid,
                "name": row.get("name") or "",
                "developer_name": row.get("developer_name") or "",
                "source": row.get("source") or "runtime",
            }
        )
        known_ids.add(rid)

    soql_trace: list[dict[str, Any]] = []
    for q in SOQL_FALLBACK_QUERIES:
        step: dict[str, Any] = {"query": q}
        try:
            res = await discovery.run_soql(conn.domain, conn.consumer_key, conn.consumer_secret, q)
        except Exception as ex:
            step["ok"] = False
            step["error"] = str(ex)[:400]
            soql_trace.append(step)
            continue

        step["ok"] = bool(res.get("ok"))
        step["endpoint"] = res.get("endpoint", "")
        step["totalSize"] = res.get("totalSize")
        if not res.get("ok"):
            err = res.get("error")
            step["error"] = str(err)[:600] if err is not None else "unknown"
            soql_trace.append(step)
            continue

        merged = 0
        for r in res.get("records") or []:
            rid = r.get("Id")
            if not rid or rid in known_ids:
                continue
            if any(_candidate_key(c) == rid for c in candidates):
                continue
            name = r.get("MasterLabel") or r.get("Name") or ""
            dev = r.get("DeveloperName") or ""
            candidates.append(
                {
                    "id": rid,
                    "name": name,
                    "developer_name": dev,
                    "source": "soql",
                }
            )
            known_ids.add(rid)
            merged += 1
        step["new_candidates_from_query"] = merged
        soql_trace.append(step)

    if candidates:
        messages.append(
            f"Found {len(candidates)} candidate(s) you can add manually (+ Add)."
        )
    elif not agents:
        if dr.get("errors"):
            messages.append("Discovery reported errors; check domain and OAuth credentials.")
        if dr.get("instructions"):
            messages.append(str(dr["instructions"]))

    msg = " ".join(m for m in messages if m).strip()
    diagnostics: dict[str, Any] = {
        "path": "discovery_and_soql",
        "sync_agent_count": 0,
        "runtime_discovery": {
            "rows": len(runtime_agents),
            "errors": list(dr.get("errors") or []),
            "instructions": dr.get("instructions"),
        },
        "soql_fallback_queries": soql_trace,
        "candidates_total": len(candidates),
        "summary": msg,
    }
    return agents, candidates, msg, diagnostics
