from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.database import get_db
from models.tables import ServiceConnection
from api.schemas.connections import (
    ConnectionAgentsPayload,
    ConnectionCreate,
    ConnectionUpdate,
    ConnectionResponse,
    ConnectionTestResult,
)
from api.schemas.agents import AgentResponse
from api.services.salesforce import get_token, fetch_agents, SalesforceError
from api.services.http_service import test_http_connection
from api.services.salesforce_bootstrap import bootstrap_salesforce_connection

router = APIRouter(prefix="/api/connections", tags=["connections"])


def _http_for_db_error(exc: ProgrammingError | OperationalError) -> HTTPException:
    hint = str(getattr(exc, "orig", exc) or exc).lower()
    if "does not exist" in hint or "no such table" in hint:
        return HTTPException(
            status_code=503,
            detail=(
                "Database tables are missing. From the server folder run: python -m alembic upgrade head"
            ),
        )
    return HTTPException(
        status_code=503,
        detail="Database error while talking to Postgres. Check DATABASE_URL and server logs.",
    )


@router.get("", response_model=list[ConnectionResponse])
async def list_connections(db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(select(ServiceConnection).order_by(ServiceConnection.created_at.desc()))
        return result.scalars().all()
    except (ProgrammingError, OperationalError) as e:
        raise _http_for_db_error(e) from e


@router.post("", response_model=ConnectionAgentsPayload, status_code=201)
async def create_connection(body: ConnectionCreate, db: AsyncSession = Depends(get_db)):
    conn = ServiceConnection(
        name=body.name,
        connection_type=body.connection_type,
        domain=body.domain or "",
        consumer_key=body.consumer_key or "",
        consumer_secret=body.consumer_secret or "",
        default_agent_id=body.default_agent_id,
        config=body.config,
    )
    db.add(conn)
    try:
        await db.commit()
        await db.refresh(conn)
    except (ProgrammingError, OperationalError) as e:
        await db.rollback()
        raise _http_for_db_error(e) from e
    # Bootstrap (OAuth + agent sync) runs from the UI via POST .../bootstrap-salesforce
    # so "Save" stays fast and "Connect" in the list drives navigation into the editor.
    if (conn.connection_type or "salesforce") == "salesforce":
        msg = "Saved. Use Connect in the list to authenticate and sync agents."
    else:
        msg = "Connection saved."
    return ConnectionAgentsPayload(
        connection=ConnectionResponse.model_validate(conn),
        agents=[],
        candidates=[],
        message=msg,
        diagnostics=None,
    )


@router.post("/{connection_id}/bootstrap-salesforce", response_model=ConnectionAgentsPayload)
async def bootstrap_salesforce(connection_id: str, db: AsyncSession = Depends(get_db)):
    conn = await db.get(ServiceConnection, connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    if (conn.connection_type or "salesforce") != "salesforce":
        raise HTTPException(status_code=400, detail="Only Salesforce connections support bootstrap")
    agents, candidates, message, diagnostics = await bootstrap_salesforce_connection(db, connection_id, conn)
    await db.refresh(conn)
    return ConnectionAgentsPayload(
        connection=ConnectionResponse.model_validate(conn),
        agents=[AgentResponse.model_validate(a) for a in agents],
        candidates=candidates,
        message=message,
        diagnostics=diagnostics,
    )


@router.get("/{connection_id}", response_model=ConnectionResponse)
async def get_connection(connection_id: str, db: AsyncSession = Depends(get_db)):
    conn = await db.get(ServiceConnection, connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    return conn


@router.put("/{connection_id}", response_model=ConnectionResponse)
async def update_connection(
    connection_id: str, body: ConnectionUpdate, db: AsyncSession = Depends(get_db)
):
    conn = await db.get(ServiceConnection, connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(conn, field, value)
    await db.commit()
    await db.refresh(conn)
    return conn


@router.delete("/{connection_id}", status_code=204)
async def delete_connection(connection_id: str, db: AsyncSession = Depends(get_db)):
    conn = await db.get(ServiceConnection, connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    await db.delete(conn)
    await db.commit()


@router.post("/{connection_id}/test", response_model=ConnectionTestResult)
async def test_connection(connection_id: str, db: AsyncSession = Depends(get_db)):
    conn = await db.get(ServiceConnection, connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")

    if conn.connection_type == "http":
        cfg = conn.config or {}
        endpoint = cfg.get("test_url") or cfg.get("endpoint") or ""
        if not endpoint:
            return ConnectionTestResult(
                success=True,
                message="HTTP connection saved. Add an agent with an endpoint URL to test.",
                agent_count=0,
            )
        result = await test_http_connection(cfg, endpoint)
        return ConnectionTestResult(
            success=result["success"],
            message=result["message"],
            agent_count=0,
        )

    try:
        token = await get_token(conn.domain, conn.consumer_key, conn.consumer_secret)
        agents = await fetch_agents(conn.domain, token)
        return ConnectionTestResult(
            success=True,
            message=f"Connected successfully to {conn.domain}",
            agent_count=len(agents),
        )
    except SalesforceError as e:
        return ConnectionTestResult(success=False, message=str(e))
