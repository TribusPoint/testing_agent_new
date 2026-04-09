from pydantic import BaseModel, field_validator
from datetime import datetime
from typing import Literal

from api.utils import normalize_salesforce_domain


# ── Salesforce ────────────────────────────────────────────────────────────────

class SalesforceConnectionCreate(BaseModel):
    connection_type: Literal["salesforce"] = "salesforce"
    name: str
    domain: str
    consumer_key: str
    consumer_secret: str
    default_agent_id: str | None = None


# ── Generic HTTP ──────────────────────────────────────────────────────────────

class HttpConnectionConfig(BaseModel):
    """Auth config stored in connections.config for HTTP connections."""
    auth_type: Literal["none", "api_key", "bearer", "basic"] = "none"
    auth_header: str = "Authorization"
    auth_value: str = ""


class HttpConnectionCreate(BaseModel):
    connection_type: Literal["http"] = "http"
    name: str
    config: HttpConnectionConfig


# ── Shared create (union) ─────────────────────────────────────────────────────

class ConnectionCreate(BaseModel):
    """
    Flexible create schema — accepts both Salesforce and HTTP connections.
    Frontend sends connection_type to distinguish.
    """
    connection_type: str = "salesforce"
    name: str
    # Salesforce fields (optional for HTTP)
    domain: str = ""
    consumer_key: str = ""
    consumer_secret: str = ""
    default_agent_id: str | None = None
    # HTTP config (optional for Salesforce)
    config: dict | None = None

    @field_validator("domain", mode="before")
    @classmethod
    def _normalize_domain_create(cls, v: object) -> object:
        if not isinstance(v, str) or not v.strip():
            return v
        return normalize_salesforce_domain(v)


class ConnectionUpdate(BaseModel):
    name: str | None = None
    # Salesforce
    domain: str | None = None
    consumer_key: str | None = None
    consumer_secret: str | None = None
    default_agent_id: str | None = None
    # HTTP
    config: dict | None = None

    @field_validator("domain", mode="before")
    @classmethod
    def _normalize_domain_update(cls, v: object) -> object:
        if v is None or not isinstance(v, str) or not v.strip():
            return v
        return normalize_salesforce_domain(v)


class ConnectionResponse(BaseModel):
    id: str
    connection_type: str
    name: str
    domain: str
    consumer_key: str
    default_agent_id: str | None
    config: dict | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ConnectionTestResult(BaseModel):
    success: bool
    message: str
    agent_count: int = 0
