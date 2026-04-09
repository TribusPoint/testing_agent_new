from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.database import get_db
from models.tables import SalesforceConnection, Agent
from api.schemas.agents import AgentResponse, AgentCreate, AgentUpdate, ChatRequest, ChatResponse, EndSessionRequest
from api.services.salesforce import (
    get_token,
    fetch_agents,
    fetch_agent_metadata,
    create_session,
    send_message,
    end_session,
    SalesforceError,
)
from api.services.http_service import send_http_message, HttpServiceError
from api.services.browser_service import send_browser_message_once, BrowserServiceError
from api.services import agent_discovery_service as discovery
from config import settings

router = APIRouter(tags=["agents"])


# ---------------------------------------------------------------------------
# Salesforce discovery / diagnostics (delegated to service)
# ---------------------------------------------------------------------------

@router.get("/api/connections/{connection_id}/describe/{sobject_name}")
async def describe_sobject(connection_id: str, sobject_name: str, db: AsyncSession = Depends(get_db)):
    """Return all field names for a Salesforce sObject."""
    conn = await db.get(SalesforceConnection, connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    try:
        return await discovery.describe_sobject(conn.domain, conn.consumer_key, conn.consumer_secret, sobject_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/api/connections/{connection_id}/discover-endpoints")
async def discover_endpoints(connection_id: str, db: AsyncSession = Depends(get_db)):
    """Probe the Salesforce org to discover available APIs."""
    conn = await db.get(SalesforceConnection, connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")

    agent_rows = (await db.execute(select(Agent).where(Agent.connection_id == connection_id))).scalars().all()
    rows = [{"salesforce_id": a.salesforce_id, "developer_name": a.developer_name or "", "name": a.name} for a in agent_rows]

    try:
        return await discovery.discover_endpoints(conn.domain, conn.consumer_key, conn.consumer_secret, rows)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/api/connections/{connection_id}/soql")
async def run_soql(connection_id: str, body: dict, db: AsyncSession = Depends(get_db)):
    """Run a SOQL query against the org."""
    conn = await db.get(SalesforceConnection, connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    query = (body.get("query") or "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="query is required")
    try:
        return await discovery.run_soql(conn.domain, conn.consumer_key, conn.consumer_secret, query)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/api/connections/{connection_id}/agents/runtime-ids")
async def discover_runtime_ids(connection_id: str, db: AsyncSession = Depends(get_db)):
    """Try every known strategy to discover AgentForce agent IDs."""
    conn = await db.get(SalesforceConnection, connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    try:
        return await discovery.discover_runtime_ids(
            conn.domain, conn.consumer_key, conn.consumer_secret,
            conn.connection_type or "salesforce",
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


# ---------------------------------------------------------------------------
# Agent CRUD
# ---------------------------------------------------------------------------

@router.post("/api/connections/{connection_id}/agents", response_model=AgentResponse, status_code=201)
async def add_agent_manually(
    connection_id: str, body: AgentCreate, db: AsyncSession = Depends(get_db)
):
    """Manually register an agent by providing its Salesforce ID directly."""
    conn = await db.get(SalesforceConnection, connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")

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
        result = await db.execute(
            select(Agent).where(Agent.connection_id == connection_id).order_by(Agent.name)
        )
        return result.scalars().all()

    saved = []
    for sf in sf_agents:
        sf_id = sf["Id"]
        meta = await fetch_agent_metadata(conn.domain, token, sf_id)

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


@router.delete("/api/agents/{agent_id}", status_code=204)
async def delete_agent(agent_id: str, db: AsyncSession = Depends(get_db)):
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    await db.delete(agent)
    await db.commit()


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


# ---------------------------------------------------------------------------
# Chat
# ---------------------------------------------------------------------------

class ManualChatRequest(BaseModel):
    message: str
    session_id: str | None = None


@router.post("/api/agents/{agent_id}/manual-chat")
async def manual_chat(agent_id: str, body: ManualChatRequest, db: AsyncSession = Depends(get_db)):
    """Send a single message to an agent and return the response."""
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
                conn_config=conn_config, agent_config=agent_config,
                question=body.message, timeout=settings.SF_TURN_TIMEOUT,
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
                conn.domain, token, agent.salesforce_id,
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


@router.post("/api/agents/{agent_id}/chat", response_model=ChatResponse)
async def chat_with_agent(agent_id: str, body: ChatRequest, db: AsyncSession = Depends(get_db)):
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
            response_text = await send_http_message(
                conn_config=conn_config, agent_config=agent_config,
                question=body.message, timeout=settings.SF_TURN_TIMEOUT,
            )
            return ChatResponse(session_id=body.session_id or "http", response=response_text, is_new_session=body.session_id is None)
        except HttpServiceError as e:
            raise HTTPException(status_code=502, detail=str(e))

    if conn_type == "browser":
        try:
            response_text = await send_browser_message_once(agent_config, body.message)
            return ChatResponse(session_id=body.session_id or "browser", response=response_text, is_new_session=body.session_id is None)
        except BrowserServiceError as e:
            raise HTTPException(status_code=502, detail=str(e))

    try:
        token = await get_token(conn.domain, conn.consumer_key, conn.consumer_secret)
        is_new = body.session_id is None
        session_id = body.session_id or await create_session(
            conn.domain, token, agent.salesforce_id,
            developer_name=agent.developer_name or "",
            runtime_url=agent.runtime_url,
        )
        response_text = await send_message(conn.domain, token, agent.salesforce_id, session_id, body.message)
        return ChatResponse(session_id=session_id, response=response_text, is_new_session=is_new)
    except SalesforceError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/api/agents/{agent_id}/screenshot")
async def screenshot_agent(agent_id: str, db: AsyncSession = Depends(get_db)):
    """Open the browser agent's URL and return a PNG screenshot (base64)."""
    from fastapi.responses import JSONResponse
    from api.services.browser_service import test_browser_connection
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    result = await test_browser_connection(agent.config or {})
    return JSONResponse(result)


@router.post("/api/agents/{agent_id}/sessions/end", status_code=204)
async def close_session(agent_id: str, body: EndSessionRequest, db: AsyncSession = Depends(get_db)):
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    conn = await db.get(SalesforceConnection, agent.connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    if (conn.connection_type or "salesforce") != "salesforce":
        return
    try:
        token = await get_token(conn.domain, conn.consumer_key, conn.consumer_secret)
        await end_session(conn.domain, token, agent.salesforce_id, body.session_id)
    except SalesforceError as e:
        raise HTTPException(status_code=502, detail=str(e))
