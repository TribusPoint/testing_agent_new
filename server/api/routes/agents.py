from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.database import get_db
from models.tables import SalesforceConnection, Agent
from api.schemas.agents import AgentResponse, AgentCreate, AgentUpdate, ChatRequest, ChatResponse, EndSessionRequest
from api.services.salesforce import (
    get_token, fetch_agents, fetch_agent_metadata,
    create_session, send_message, end_session, SalesforceError,
)
from api.services.http_service import send_http_message, HttpServiceError
from api.services.browser_service import send_browser_message_once, BrowserServiceError
from config import settings

router = APIRouter(tags=["agents"])


@router.get("/api/connections/{connection_id}/describe/{sobject_name}")
async def describe_sobject(connection_id: str, sobject_name: str, db: AsyncSession = Depends(get_db)):
    """Return all field names for a Salesforce sObject — useful for diagnosing schema."""
    conn = await db.get(SalesforceConnection, connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    import httpx
    errors = []
    try:
        token = await get_token(conn.domain, conn.consumer_key, conn.consumer_secret)
        headers = {"Authorization": f"Bearer {token}"}
        domain = conn.domain
        for v in ["v62.0", "v61.0", "v60.0"]:
            for api_type in ["tooling", "data"]:
                base = f"https://{domain}/services/data/{v}"
                url = (
                    f"{base}/tooling/sobjects/{sobject_name}/describe"
                    if api_type == "tooling"
                    else f"{base}/sobjects/{sobject_name}/describe"
                )
                try:
                    async with httpx.AsyncClient(timeout=20) as c:
                        r = await c.get(url, headers=headers)
                    if r.status_code == 200:
                        data = r.json()
                        fields = [
                            {"name": f["name"], "label": f["label"], "type": f["type"]}
                            for f in data.get("fields", [])
                        ]
                        return {
                            "sobject": sobject_name,
                            "api": api_type,
                            "version": v,
                            "fields": fields,
                            "note": f"Retrieved via {api_type} API ({v})",
                        }
                    errors.append(f"{api_type}/{v}: HTTP {r.status_code}")
                except Exception as exc:
                    errors.append(f"{api_type}/{v}: {exc}")
        raise HTTPException(status_code=502, detail=f"Could not describe {sobject_name}. Tried: {'; '.join(errors)}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/api/connections/{connection_id}/discover-endpoints")
async def discover_endpoints(connection_id: str, db: AsyncSession = Depends(get_db)):
    """
    Probe the Salesforce org to discover which APIs are available and what
    the correct endpoint format is for AgentForce / Einstein Bot / Messaging.
    """
    import httpx, re

    def _clean(t: str) -> str:
        return re.sub(r"<[^>]+>", "", t).strip()[:300]

    conn = await db.get(SalesforceConnection, connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")

    try:
        token = await get_token(conn.domain, conn.consumer_key, conn.consumer_secret)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Auth failed: {e}")

    domain = conn.domain
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
    results = []

    async def probe(label: str, url: str, method: str = "GET", body: dict | None = None) -> dict:
        try:
            async with httpx.AsyncClient(timeout=15) as c:
                if method == "POST":
                    r = await c.post(url, json=body or {}, headers={**headers, "Content-Type": "application/json"})
                else:
                    r = await c.get(url, headers=headers)
            status = r.status_code
            try:
                data = r.json()
            except Exception:
                data = _clean(r.text)
            return {"label": label, "url": url, "status": status, "ok": status in (200, 201), "data": data}
        except Exception as ex:
            return {"label": label, "url": url, "status": 0, "ok": False, "data": str(ex)}

    # 1. List available API versions
    r = await probe("API versions", f"https://{domain}/services/data/")
    results.append(r)
    latest_version = "v62.0"
    if r["ok"] and isinstance(r["data"], list):
        latest_version = r["data"][-1].get("version", "62.0")
        if not latest_version.startswith("v"):
            latest_version = f"v{latest_version}"

    # 2. List resources at latest version (checks if einstein appears)
    r2 = await probe(f"REST resources ({latest_version})", f"https://{domain}/services/data/{latest_version}/")
    results.append(r2)

    # 3. AgentForce runtime list (no /services/data prefix)
    results.append(await probe(
        "AgentForce agents list (no prefix)",
        f"https://{domain}/einstein/ai-agent/v1/agents"
    ))

    # 4. AgentForce runtime list (with /services/data prefix)
    results.append(await probe(
        f"AgentForce agents list ({latest_version})",
        f"https://{domain}/services/data/{latest_version}/einstein/ai-agent/v1/agents"
    ))

    # 5. Try known agent IDs — BotDefinition records
    from sqlalchemy import select as sa_select
    agent_rows = (await db.execute(sa_select(Agent).where(Agent.connection_id == connection_id))).scalars().all()
    for ag in agent_rows:
        for id_val in set([ag.salesforce_id, ag.developer_name]):
            if not id_val:
                continue
            results.append(await probe(
                f"Session create: {ag.name} / {id_val} (POST, no prefix)",
                f"https://{domain}/einstein/ai-agent/v1/agents/{id_val}/sessions",
                method="POST",
            ))
            results.append(await probe(
                f"Session create: {ag.name} / {id_val} (POST, {latest_version})",
                f"https://{domain}/services/data/{latest_version}/einstein/ai-agent/v1/agents/{id_val}/sessions",
                method="POST",
            ))

    # 6. Messaging for In-App and Web (MIAW) — classic bots use this
    results.append(await probe(
        "MIAW conversations endpoint",
        f"https://{domain}/iamessage/api/v1/authorization/unauthenticated/access-token"
    ))

    # 7. Check OAuth scopes on the current token via identity endpoint
    results.append(await probe("Identity (token info)", f"https://{domain}/services/oauth2/userinfo"))

    return {"domain": domain, "probes": results}


@router.post("/api/connections/{connection_id}/soql")
async def run_soql(connection_id: str, body: dict, db: AsyncSession = Depends(get_db)):
    """Run a SOQL query against the org and return raw results. Useful for diagnostics."""
    conn = await db.get(SalesforceConnection, connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    query = (body.get("query") or "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="query is required")
    import httpx, re

    def _clean(text: str) -> str:
        return re.sub(r"<[^>]+>", "", text).strip()[:400]

    try:
        token = await get_token(conn.domain, conn.consumer_key, conn.consumer_secret)
        headers = {"Authorization": f"Bearer {token}"}
        domain = conn.domain
        # Try Tooling API first, then regular REST
        for url in [
            f"https://{domain}/services/data/v62.0/tooling/query",
            f"https://{domain}/services/data/v61.0/tooling/query",
            f"https://{domain}/services/data/v60.0/tooling/query",
            f"https://{domain}/services/data/v62.0/query",
            f"https://{domain}/services/data/v61.0/query",
            f"https://{domain}/services/data/v60.0/query",
        ]:
            try:
                async with httpx.AsyncClient(timeout=20) as client:
                    resp = await client.get(url, params={"q": query}, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    return {
                        "ok": True,
                        "endpoint": url,
                        "totalSize": data.get("totalSize", 0),
                        "records": data.get("records", []),
                    }
                elif resp.status_code not in (400, 404):
                    pass
                else:
                    err = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else [{"message": _clean(resp.text)}]
                    # 400 = sObject not supported — stop this URL, try REST
                    if url.endswith("/tooling/query") and isinstance(err, list) and "not supported" in str(err).lower():
                        continue
                    return {"ok": False, "endpoint": url, "error": err}
            except Exception as e:
                continue
        return {"ok": False, "error": "All endpoints failed", "endpoint": ""}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/api/connections/{connection_id}/agents", response_model=AgentResponse, status_code=201)
async def add_agent_manually(
    connection_id: str, body: AgentCreate, db: AsyncSession = Depends(get_db)
):
    """Manually register an agent by providing its Salesforce ID directly."""
    conn = await db.get(SalesforceConnection, connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")

    # Check for duplicate salesforce_id in this connection
    existing = await db.execute(
        select(Agent).where(
            Agent.connection_id == connection_id,
            Agent.salesforce_id == body.salesforce_id,
        )
    )
    agent = existing.scalar_one_or_none()
    if agent:
        agent.name = body.name
        agent.developer_name = body.developer_name or body.name
        agent.agent_type = body.agent_type
    else:
        agent = Agent(
            connection_id=connection_id,
            salesforce_id=body.salesforce_id or body.name,
            name=body.name,
            developer_name=body.developer_name or body.name,
            agent_type=body.agent_type,
            config=body.config,
            topics=[],
            actions=[],
        )
        db.add(agent)

    if body.config is not None:
        agent.config = body.config
    await db.commit()
    await db.refresh(agent)
    return agent


@router.get("/api/connections/{connection_id}/agents", response_model=list[AgentResponse])
async def list_agents(connection_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Agent)
        .where(Agent.connection_id == connection_id)
        .order_by(Agent.name)
    )
    return result.scalars().all()


@router.post("/api/connections/{connection_id}/agents/sync", response_model=list[AgentResponse])
async def sync_agents(connection_id: str, db: AsyncSession = Depends(get_db)):
    """Fetch agents from Salesforce and upsert them into the database."""
    conn = await db.get(SalesforceConnection, connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    try:
        token = await get_token(conn.domain, conn.consumer_key, conn.consumer_secret)
        sf_agents = await fetch_agents(conn.domain, token)
    except SalesforceError as e:
        raise HTTPException(status_code=502, detail=str(e))

    if not sf_agents:
        # No agents discovered — return existing DB agents so UI stays populated
        result = await db.execute(
            select(Agent).where(Agent.connection_id == connection_id).order_by(Agent.name)
        )
        return result.scalars().all()

    saved = []
    for sf in sf_agents:
        sf_id = sf["Id"]
        meta = await fetch_agent_metadata(conn.domain, token, sf_id)

        # Check if agent already exists
        result = await db.execute(
            select(Agent).where(Agent.connection_id == connection_id, Agent.salesforce_id == sf_id)
        )
        agent = result.scalar_one_or_none()

        agent_type = (sf.get("BotType") or sf.get("_source") or "agentforce").lower()

        if agent:
            agent.name = sf["MasterLabel"]
            agent.developer_name = sf["DeveloperName"]
            agent.agent_type = agent_type
            agent.planner_id = meta["planner_id"]
            agent.planner_name = meta["planner_name"]
            agent.topics = meta["topics"]
            agent.actions = meta["actions"]
        else:
            agent = Agent(
                connection_id=connection_id,
                salesforce_id=sf_id,
                name=sf["MasterLabel"],
                developer_name=sf["DeveloperName"],
                agent_type=agent_type,
                planner_id=meta["planner_id"],
                planner_name=meta["planner_name"],
                topics=meta["topics"],
                actions=meta["actions"],
            )
            db.add(agent)

        saved.append(agent)

    await db.commit()
    for a in saved:
        await db.refresh(a)
    return saved


@router.get("/api/agents/{agent_id}", response_model=AgentResponse)
async def get_agent(agent_id: str, db: AsyncSession = Depends(get_db)):
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@router.patch("/api/agents/{agent_id}", response_model=AgentResponse)
async def update_agent(agent_id: str, body: AgentUpdate, db: AsyncSession = Depends(get_db)):
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    if body.salesforce_id is not None:
        agent.salesforce_id = body.salesforce_id
    if body.name is not None:
        agent.name = body.name
    if body.developer_name is not None:
        agent.developer_name = body.developer_name
    if body.agent_type is not None:
        agent.agent_type = body.agent_type
    if body.runtime_url is not None:
        agent.runtime_url = body.runtime_url or None
    if body.config is not None:
        agent.config = body.config or None
    await db.commit()
    await db.refresh(agent)
    return agent


class ManualChatRequest(BaseModel):
    message: str
    session_id: str | None = None


@router.post("/api/agents/{agent_id}/manual-chat")
async def manual_chat(agent_id: str, body: ManualChatRequest, db: AsyncSession = Depends(get_db)):
    """
    Send a single message to an agent and return the response.
    Creates a new session if session_id is not provided.
    Returns verbose diagnostics so the user can see which URL worked.
    """

    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    conn = await db.get(SalesforceConnection, agent.connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")

    conn_type = conn.connection_type or "salesforce"
    agent_config = agent.config or {}
    conn_config = conn.config or {}

    if conn_type == "http":
        try:
            response = await send_http_message(
                conn_config=conn_config,
                agent_config=agent_config,
                question=body.message,
                timeout=settings.SF_TURN_TIMEOUT,
            )
        except HttpServiceError as e:
            raise HTTPException(status_code=502, detail=str(e))
        return {
            "session_id": body.session_id or "http",
            "new_session": body.session_id is None,
            "response": response,
            "agent_id_used": "",
            "developer_name_used": "",
            "runtime_url_used": agent_config.get("endpoint", ""),
        }

    if conn_type == "browser":
        try:
            response = await send_browser_message_once(agent_config, body.message)
        except BrowserServiceError as e:
            raise HTTPException(status_code=502, detail=str(e))
        return {
            "session_id": body.session_id or "browser",
            "new_session": body.session_id is None,
            "response": response,
            "agent_id_used": "",
            "developer_name_used": "",
            "runtime_url_used": agent_config.get("url", ""),
        }

    try:
        token = await get_token(conn.domain, conn.consumer_key, conn.consumer_secret)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Auth failed: {e}")

    session_id = body.session_id
    new_session = False
    session_url_used = agent.runtime_url or "(auto-detected)"

    if not session_id:
        try:
            session_id = await create_session(
                conn.domain,
                token,
                agent.salesforce_id,
                developer_name=agent.developer_name,
                runtime_url=agent.runtime_url,
            )
            new_session = True
        except SalesforceError as e:
            raise HTTPException(status_code=502, detail=str(e))

    try:
        response = await send_message(conn.domain, token, agent.salesforce_id, session_id, body.message, seq_id=1)
    except SalesforceError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return {
        "session_id": session_id,
        "new_session": new_session,
        "response": response,
        "agent_id_used": agent.salesforce_id,
        "developer_name_used": agent.developer_name,
        "runtime_url_used": session_url_used,
    }


@router.get("/api/connections/{connection_id}/agents/runtime-ids")
async def discover_runtime_ids(connection_id: str, db: AsyncSession = Depends(get_db)):
    """
    Try every known strategy to discover AgentForce agent IDs for this org.
    Returns list of {id, name, developer_name, source}.
    """
    conn = await db.get(SalesforceConnection, connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")

    if (conn.connection_type or "salesforce") != "salesforce":
        return {
            "agents": [],
            "errors": [],
            "instructions": "Agent ID auto-discovery is only for Salesforce. Use + Add Page for Browser or HTTP agents.",
        }

    import httpx
    import re

    try:
        token = await get_token(conn.domain, conn.consumer_key, conn.consumer_secret)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Auth failed: {e}")

    headers = {"Authorization": f"Bearer {token}"}
    domain = conn.domain
    results: list[dict] = []
    errors: list[str] = []

    def _clean(text: str) -> str:
        """Strip HTML tags from Salesforce error pages."""
        return re.sub(r"<[^>]+>", "", text).strip()[:200]

    async def _soql(query: str) -> list[dict] | None:
        for base in [
            f"https://{domain}/services/data/v62.0/tooling/query",
            f"https://{domain}/services/data/v61.0/tooling/query",
            f"https://{domain}/services/data/v60.0/tooling/query",
        ]:
            try:
                async with httpx.AsyncClient(timeout=15) as c:
                    r = await c.get(base, params={"q": query}, headers=headers)
                if r.status_code == 200:
                    return r.json().get("records", [])
            except Exception:
                pass
        return None

    async def _rest(query: str) -> list[dict] | None:
        for v in ["v62.0", "v61.0", "v60.0"]:
            try:
                async with httpx.AsyncClient(timeout=15) as c:
                    r = await c.get(
                        f"https://{domain}/services/data/{v}/query",
                        params={"q": query},
                        headers=headers,
                    )
                if r.status_code == 200:
                    return r.json().get("records", [])
            except Exception:
                pass
        return None

    # Strategy 1 — BotDefinition (classic Einstein Bots)
    rows = await _soql("SELECT Id,DeveloperName,MasterLabel FROM BotDefinition")
    if rows:
        results += [{"id": r["Id"], "name": r["MasterLabel"], "developer_name": r["DeveloperName"], "source": "BotDefinition"} for r in rows]

    # Strategy 2 — GenAiPlanner (AgentForce)
    rows = await _soql("SELECT Id,DeveloperName,MasterLabel FROM GenAiPlanner")
    if rows:
        results += [{"id": r["Id"], "name": r["MasterLabel"], "developer_name": r["DeveloperName"], "source": "GenAiPlanner"} for r in rows]

    # Strategy 3 — BotVersion fallback
    if not results:
        rows = await _soql("SELECT Id,DeveloperName,MasterLabel FROM BotVersion")
        if rows:
            results += [{"id": r["Id"], "name": r["MasterLabel"], "developer_name": r["DeveloperName"], "source": "BotVersion"} for r in rows]

    # Strategy 4 — REST GenAiPlanner
    if not results:
        rows = await _rest("SELECT Id,DeveloperName,MasterLabel FROM GenAiPlanner")
        if rows:
            results += [{"id": r["Id"], "name": r["MasterLabel"], "developer_name": r["DeveloperName"], "source": "GenAiPlanner-REST"} for r in rows]

    # Strategy 5 — AgentForce runtime list (try multiple paths)
    if not results:
        for path in [
            "/einstein/ai-agent/v1/agents",
            "/services/data/v62.0/einstein/ai-agent/v1/agents",
            "/services/data/v61.0/einstein/ai-agent/v1/agents",
        ]:
            try:
                async with httpx.AsyncClient(timeout=15) as c:
                    r = await c.get(f"https://{domain}{path}", headers=headers)
                if r.status_code == 200:
                    data = r.json()
                    agents_raw = data.get("agents", data.get("records", []))
                    if agents_raw:
                        results += [
                            {
                                "id": a.get("agentId") or a.get("id") or a.get("Id", ""),
                                "name": a.get("agentName") or a.get("name") or a.get("MasterLabel", ""),
                                "developer_name": a.get("developerName") or a.get("DeveloperName", ""),
                                "source": f"runtime:{path}",
                            }
                            for a in agents_raw
                        ]
                        break
                else:
                    errors.append(f"{path}: {r.status_code} {_clean(r.text)}")
            except Exception as e:
                errors.append(f"{path}: {e}")

    return {
        "agents": results,
        "errors": errors,
        "instructions": (
            "To find your agent ID manually: "
            "Salesforce Setup → search 'Agents' in Quick Find → "
            "click your agent → copy the 18-character ID from the URL "
            "(e.g. 0HoXXXXXXXXXXXXXXX) or the record detail page."
        ),
    }


@router.post("/api/agents/{agent_id}/chat", response_model=ChatResponse)
async def chat_with_agent(
    agent_id: str, body: ChatRequest, db: AsyncSession = Depends(get_db)
):
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    conn = await db.get(SalesforceConnection, agent.connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")

    conn_type = conn.connection_type or "salesforce"
    agent_config = agent.config or {}
    conn_config = conn.config or {}

    # ── Generic HTTP (no OAuth, no domain) ────────────────────────────────
    if conn_type == "http":
        try:
            response_text = await send_http_message(
                conn_config=conn_config,
                agent_config=agent_config,
                question=body.message,
                timeout=settings.SF_TURN_TIMEOUT,
            )
            return ChatResponse(
                session_id=body.session_id or "http",
                response=response_text,
                is_new_session=body.session_id is None,
            )
        except HttpServiceError as e:
            raise HTTPException(status_code=502, detail=str(e))

    # ── Browser automation (Playwright) ──────────────────────────────────
    if conn_type == "browser":
        try:
            response_text = await send_browser_message_once(agent_config, body.message)
            return ChatResponse(
                session_id=body.session_id or "browser",
                response=response_text,
                is_new_session=body.session_id is None,
            )
        except BrowserServiceError as e:
            raise HTTPException(status_code=502, detail=str(e))

    # ── Salesforce AgentForce ─────────────────────────────────────────────
    try:
        token = await get_token(conn.domain, conn.consumer_key, conn.consumer_secret)

        is_new = body.session_id is None
        session_id = body.session_id or await create_session(
            conn.domain, token, agent.salesforce_id,
            developer_name=agent.developer_name or "",
            runtime_url=agent.runtime_url,
        )
        response_text = await send_message(
            conn.domain, token, agent.salesforce_id, session_id, body.message
        )
        return ChatResponse(
            session_id=session_id,
            response=response_text,
            is_new_session=is_new,
        )
    except SalesforceError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/api/agents/{agent_id}/screenshot")
async def screenshot_agent(agent_id: str, db: AsyncSession = Depends(get_db)):
    """
    Open the browser agent's URL and return a PNG screenshot (base64).
    Used to help the user verify their URL and choose CSS selectors.
    """
    from fastapi.responses import JSONResponse
    from api.services.browser_service import test_browser_connection
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    config = agent.config or {}
    result = await test_browser_connection(config)
    return JSONResponse(result)


@router.post("/api/agents/{agent_id}/sessions/end", status_code=204)
async def close_session(
    agent_id: str, body: EndSessionRequest, db: AsyncSession = Depends(get_db)
):
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    conn = await db.get(SalesforceConnection, agent.connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    if (conn.connection_type or "salesforce") != "salesforce":
        return  # HTTP / Browser have no Salesforce session to close
    try:
        token = await get_token(conn.domain, conn.consumer_key, conn.consumer_secret)
        await end_session(conn.domain, token, agent.salesforce_id, body.session_id)
    except SalesforceError as e:
        raise HTTPException(status_code=502, detail=str(e))
