from pydantic import BaseModel
from datetime import datetime


class ConnectionCreate(BaseModel):
    name: str
    domain: str
    consumer_key: str
    consumer_secret: str
    default_agent_id: str | None = None


class ConnectionUpdate(BaseModel):
    name: str | None = None
    domain: str | None = None
    consumer_key: str | None = None
    consumer_secret: str | None = None
    default_agent_id: str | None = None


class ConnectionResponse(BaseModel):
    id: str
    name: str
    domain: str
    consumer_key: str
    default_agent_id: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ConnectionTestResult(BaseModel):
    success: bool
    message: str
    agent_count: int = 0
