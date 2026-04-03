from pydantic import BaseModel
from datetime import datetime


class AgentResponse(BaseModel):
    id: str
    connection_id: str
    salesforce_id: str
    name: str
    developer_name: str
    agent_type: str
    planner_id: str | None
    planner_name: str | None
    runtime_url: str | None = None
    config: dict | None = None
    topics: list
    actions: list
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AgentCreate(BaseModel):
    salesforce_id: str = ""
    name: str
    developer_name: str = ""
    agent_type: str = "agentforce"
    runtime_url: str | None = None
    config: dict | None = None


class AgentUpdate(BaseModel):
    salesforce_id: str | None = None
    name: str | None = None
    developer_name: str | None = None
    agent_type: str | None = None
    runtime_url: str | None = None
    config: dict | None = None


class HttpAgentConfig(BaseModel):
    """Config for a Generic HTTP agent — stored in agents.config."""
    endpoint: str
    method: str = "POST"
    body_template: str = '{"message": "{{question}}"}'
    response_path: str = ""
    extra_headers: dict = {}


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None


class ChatResponse(BaseModel):
    session_id: str
    response: str
    is_new_session: bool


class EndSessionRequest(BaseModel):
    session_id: str
