from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.database import get_db
from models.tables import SalesforceConnection
from api.schemas.connections import (
    ConnectionCreate, ConnectionUpdate, ConnectionResponse, ConnectionTestResult
)
from api.services.salesforce import get_token, fetch_agents, SalesforceError

router = APIRouter(prefix="/api/connections", tags=["connections"])


@router.get("", response_model=list[ConnectionResponse])
async def list_connections(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SalesforceConnection).order_by(SalesforceConnection.created_at.desc()))
    return result.scalars().all()


@router.post("", response_model=ConnectionResponse, status_code=201)
async def create_connection(body: ConnectionCreate, db: AsyncSession = Depends(get_db)):
    conn = SalesforceConnection(**body.model_dump())
    db.add(conn)
    await db.commit()
    await db.refresh(conn)
    return conn


@router.get("/{connection_id}", response_model=ConnectionResponse)
async def get_connection(connection_id: str, db: AsyncSession = Depends(get_db)):
    conn = await db.get(SalesforceConnection, connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    return conn


@router.put("/{connection_id}", response_model=ConnectionResponse)
async def update_connection(
    connection_id: str, body: ConnectionUpdate, db: AsyncSession = Depends(get_db)
):
    conn = await db.get(SalesforceConnection, connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(conn, field, value)
    await db.commit()
    await db.refresh(conn)
    return conn


@router.delete("/{connection_id}", status_code=204)
async def delete_connection(connection_id: str, db: AsyncSession = Depends(get_db)):
    conn = await db.get(SalesforceConnection, connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    await db.delete(conn)
    await db.commit()


@router.post("/{connection_id}/test", response_model=ConnectionTestResult)
async def test_connection(connection_id: str, db: AsyncSession = Depends(get_db)):
    conn = await db.get(SalesforceConnection, connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
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
