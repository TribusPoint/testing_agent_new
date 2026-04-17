"""Upsert Salesforce bots as Agent rows for a connection."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.tables import Agent, ServiceConnection
from api.services.salesforce import get_token, fetch_agents, fetch_agent_metadata, SalesforceError


async def sync_salesforce_agents(db: AsyncSession, connection_id: str, conn: ServiceConnection) -> list[Agent]:
    """Fetch agents from Salesforce and upsert. Returns current agents for this connection after commit."""
    token = await get_token(conn.domain, conn.consumer_key, conn.consumer_secret)
    sf_agents = await fetch_agents(conn.domain, token)

    if not sf_agents:
        result = await db.execute(select(Agent).where(Agent.connection_id == connection_id).order_by(Agent.name))
        return list(result.scalars().all())

    saved: list[Agent] = []
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

    result = await db.execute(select(Agent).where(Agent.connection_id == connection_id).order_by(Agent.name))
    return list(result.scalars().all())
