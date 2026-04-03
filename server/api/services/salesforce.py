import asyncio
import uuid
import httpx
from typing import Callable, Awaitable, TypeVar
from config import settings

T = TypeVar("T")

# The Salesforce global API base — same as the POC's API_BASE_URL.
# Agent sessions are managed here, NOT at the org domain.
SF_API_BASE = "https://api.salesforce.com"


class SalesforceError(Exception):
    pass


async def with_retry(fn: Callable[[], Awaitable[T]]) -> T:
    """Execute an async callable with exponential-backoff retry."""
    last_exc: Exception = SalesforceError("Unknown error")
    for attempt in range(settings.SF_MAX_RETRIES):
        try:
            return await fn()
        except SalesforceError as e:
            last_exc = e
            if attempt < settings.SF_MAX_RETRIES - 1:
                await asyncio.sleep(settings.SF_RETRY_DELAY * (2 ** attempt))
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
    """
    Fetch agents from the Salesforce org.
    Uses BotDefinition with the `Type` field (v63.0), falling back to
    GenAiPlanner and BotVersion strategies.
    """
    headers = {"Authorization": f"Bearer {token}"}

    for version in ["v63.0", "v62.0", "v61.0", "v60.0"]:
        tooling_url = f"https://{domain}/services/data/{version}/tooling/query"
        rest_url = f"https://{domain}/services/data/{version}/query"

        # Strategy 1: BotDefinition with Type field (v63.0 exposes it)
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    tooling_url,
                    params={"q": "SELECT Id,DeveloperName,MasterLabel,Type FROM BotDefinition"},
                    headers=headers,
                )
            if resp.status_code == 200:
                records = resp.json().get("records", [])
                for r in records:
                    r.setdefault("BotType", r.get("Type", "agentforce"))
                    r.setdefault("_source", "BotDefinition")
                return records
        except Exception:
            pass

        # Strategy 2: BotDefinition without Type (older orgs)
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    tooling_url,
                    params={"q": "SELECT Id,DeveloperName,MasterLabel FROM BotDefinition"},
                    headers=headers,
                )
            if resp.status_code == 200:
                records = resp.json().get("records", [])
                for r in records:
                    r.setdefault("BotType", "agentforce")
                    r.setdefault("_source", "BotDefinition")
                return records
        except Exception:
            pass

    # Strategy 3: GenAiPlanner (AgentForce orgs)
    for version in ["v63.0", "v62.0"]:
        for base in ["tooling", "rest"]:
            try:
                url = (
                    f"https://{domain}/services/data/{version}/tooling/query"
                    if base == "tooling"
                    else f"https://{domain}/services/data/{version}/query"
                )
                async with httpx.AsyncClient() as client:
                    resp = await client.get(
                        url,
                        params={"q": "SELECT Id,DeveloperName,MasterLabel FROM GenAiPlanner"},
                        headers=headers,
                    )
                if resp.status_code == 200:
                    records = resp.json().get("records", [])
                    for r in records:
                        r.setdefault("BotType", "agentforce")
                        r.setdefault("_source", f"GenAiPlanner-{base}")
                    return records
            except Exception:
                pass

    return []


async def fetch_agent_metadata(domain: str, token: str, bot_id: str) -> dict:
    """Fetch topics and actions for a specific agent."""
    headers = {"Authorization": f"Bearer {token}"}
    topics: list = []
    actions: list = []
    planner_id = None
    planner_name = None

    try:
        async with httpx.AsyncClient() as client:
            tooling = f"https://{domain}/services/data/v63.0/tooling/query"

            p_resp = await client.get(
                tooling,
                params={"q": f"SELECT Id,MasterLabel FROM GenAiPlanner WHERE BotId='{bot_id}'"},
                headers=headers,
            )
            if p_resp.status_code == 200 and p_resp.json().get("records"):
                planner_id = p_resp.json()["records"][0]["Id"]
                planner_name = p_resp.json()["records"][0]["MasterLabel"]
            else:
                p2_resp = await client.get(
                    tooling,
                    params={"q": f"SELECT Id,MasterLabel FROM GenAiPlanner WHERE Id='{bot_id}'"},
                    headers=headers,
                )
                if p2_resp.status_code == 200 and p2_resp.json().get("records"):
                    planner_id = p2_resp.json()["records"][0]["Id"]
                    planner_name = p2_resp.json()["records"][0]["MasterLabel"]

            t_resp = await client.get(
                tooling,
                params={"q": f"SELECT Id,MasterLabel,Description FROM BotTopic WHERE BotDefinitionId='{bot_id}'"},
                headers=headers,
            )
            if t_resp.status_code == 200 and t_resp.json().get("records"):
                topics = [
                    {"id": r["Id"], "name": r["MasterLabel"], "description": r.get("Description", "")}
                    for r in t_resp.json().get("records", [])
                ]
            elif planner_id:
                t2_resp = await client.get(
                    tooling,
                    params={"q": f"SELECT Id,MasterLabel FROM GenAiPlannerTopic WHERE GenAiPlannerId='{planner_id}'"},
                    headers=headers,
                )
                if t2_resp.status_code == 200:
                    topics = [
                        {"id": r["Id"], "name": r["MasterLabel"], "description": ""}
                        for r in t2_resp.json().get("records", [])
                    ]

            a_resp = await client.get(
                tooling,
                params={"q": f"SELECT Id,MasterLabel FROM BotAction WHERE BotDefinitionId='{bot_id}'"},
                headers=headers,
            )
            if a_resp.status_code == 200 and a_resp.json().get("records"):
                actions = [
                    {"id": r["Id"], "name": r["MasterLabel"]}
                    for r in a_resp.json().get("records", [])
                ]
            elif planner_id:
                a2_resp = await client.get(
                    tooling,
                    params={"q": f"SELECT Id,MasterLabel FROM GenAiFunctionDef WHERE GenAiPlannerId='{planner_id}'"},
                    headers=headers,
                )
                if a2_resp.status_code == 200:
                    actions = [
                        {"id": r["Id"], "name": r["MasterLabel"]}
                        for r in a2_resp.json().get("records", [])
                    ]
    except Exception:
        pass

    return {
        "planner_id": planner_id,
        "planner_name": planner_name,
        "topics": topics,
        "actions": actions,
    }


def _strip_html(text: str) -> str:
    """Strip HTML tags from Salesforce error pages."""
    import re
    clean = re.sub(r"<[^>]+>", " ", text)
    clean = re.sub(r"\s+", " ", clean).strip()
    return clean[:300]


async def create_session(
    domain: str,
    token: str,
    agent_id: str,
    developer_name: str = "",
    runtime_url: str | None = None,
) -> str:
    """
    Create an AgentForce conversation session.

    Matches the POC exactly:
    - Primary: POST https://api.salesforce.com/einstein/ai-agent/v1/agents/{id}/sessions
    - Body includes externalSessionKey (UUID), instanceConfig.endpoint, bypassUser: true
    - Falls back through developer_name and org-domain variants if needed
    - Supports a pinned runtime_url override stored on the Agent record
    """
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    def _body(org_endpoint: str) -> dict:
        return {
            "externalSessionKey": str(uuid.uuid4()),
            "instanceConfig": {"endpoint": org_endpoint},
            "bypassUser": True,
        }

    org_endpoint = f"https://{domain}"

    if runtime_url:
        session_url = (
            runtime_url if runtime_url.endswith("/sessions")
            else f"{runtime_url.rstrip('/')}/sessions"
        )
        candidates = [(session_url, org_endpoint)]
    else:
        candidates = [
            # ① Global API + record ID (matches POC exactly)
            (f"{SF_API_BASE}/einstein/ai-agent/v1/agents/{agent_id}/sessions", org_endpoint),
            # ② Global API + developer name
            (f"{SF_API_BASE}/einstein/ai-agent/v1/agents/{developer_name}/sessions", org_endpoint)
            if developer_name and developer_name != agent_id else None,
            # ③ Org domain + record ID (no /services/data prefix)
            (f"{org_endpoint}/einstein/ai-agent/v1/agents/{agent_id}/sessions", org_endpoint),
            # ④ Org domain + developer name
            (f"{org_endpoint}/einstein/ai-agent/v1/agents/{developer_name}/sessions", org_endpoint)
            if developer_name and developer_name != agent_id else None,
            # ⑤ Org domain with /services/data prefix
            (f"{org_endpoint}/services/data/v63.0/einstein/ai-agent/v1/agents/{agent_id}/sessions", org_endpoint),
        ]
        candidates = [c for c in candidates if c]  # drop Nones

    last_error = ""
    for url, endpoint in candidates:
        for attempt in range(settings.SF_MAX_RETRIES):
            try:
                async with httpx.AsyncClient(timeout=settings.SF_TURN_TIMEOUT) as client:
                    resp = await client.post(url, json=_body(endpoint), headers=headers)
                if resp.status_code in (200, 201):
                    data = resp.json()
                    return data.get("sessionId") or data.get("id") or data.get("session_id") or list(data.values())[0]
                if resp.status_code == 404:
                    last_error = f"[{url}] 404: {_strip_html(resp.text)}"
                    break
                last_error = f"[{url}] {resp.status_code}: {_strip_html(resp.text)}"
                if attempt < settings.SF_MAX_RETRIES - 1:
                    await asyncio.sleep(settings.SF_RETRY_DELAY * (2 ** attempt))
            except Exception as e:
                last_error = f"[{url}] error: {e}"
                break

    raise SalesforceError(f"Failed to create session — all endpoints tried. Last error: {last_error}")


async def send_message(
    domain: str, token: str, agent_id: str, session_id: str, message: str,
    seq_id: int = 1,
) -> str:
    """
    Send a message to an active AgentForce session.

    Matches the POC:
    - URL: https://api.salesforce.com/einstein/ai-agent/v1/sessions/{session_id}/messages
    - Body: {"message": {"sequenceId": N, "type": "Text", "text": "..."}}
    - Parses "Inform" type messages from the response
    """
    async def _send() -> str:
        url = f"{SF_API_BASE}/einstein/ai-agent/v1/sessions/{session_id}/messages"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        payload = {
            "message": {
                "sequenceId": seq_id,
                "type": "Text",
                "text": message,
            }
        }
        async with httpx.AsyncClient(timeout=settings.SF_TURN_TIMEOUT) as client:
            resp = await client.post(url, json=payload, headers=headers)
        if resp.status_code != 200:
            raise SalesforceError(f"Message failed ({resp.status_code}): {_strip_html(resp.text)}")

        data = resp.json()
        # Parse response the same way as the POC
        for m in data.get("messages", []):
            if m.get("type") == "Inform" and m.get("message"):
                return m["message"]
            if m.get("message"):
                return m["message"]
            if m.get("text"):
                return m["text"]
        return "(no response)"

    return await with_retry(_send)


async def end_session(domain: str, token: str, agent_id: str, session_id: str) -> None:
    """End an AgentForce session. Matches the POC — uses global API base."""
    url = f"{SF_API_BASE}/einstein/ai-agent/v1/sessions/{session_id}"
    headers = {"Authorization": f"Bearer {token}"}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.delete(url, headers=headers)
    except Exception:
        pass
