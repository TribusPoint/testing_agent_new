from pydantic import BaseModel
from datetime import datetime


class ProjectCreate(BaseModel):
    name: str
    description: str | None = None
    company_name: str | None = None
    company_websites: str | None = None
    industry: str | None = None
    competitors: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    company_name: str | None = None
    company_websites: str | None = None
    industry: str | None = None
    competitors: str | None = None


class ProjectResponse(BaseModel):
    id: str
    name: str
    description: str | None
    company_name: str | None
    company_websites: str | None
    industry: str | None
    competitors: str | None
    site_analysis: dict | None = None
    site_analyzed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AnalyzeSiteRequest(BaseModel):
    """Optional override URL; otherwise the project `company_websites` field is used."""

    url: str | None = None


class PersonaResponse(BaseModel):
    id: str
    project_id: str
    agent_id: str | None
    name: str
    description: str | None
    tag: str | None
    goal: str | None = None
    personality: str | None = None
    knowledge_level: str | None = None

    model_config = {"from_attributes": True}


class PersonaCreate(BaseModel):
    name: str
    description: str | None = None
    goal: str | None = None
    personality: str | None = None
    knowledge_level: str | None = None
    tag: str | None = None
    agent_id: str | None = None


class PersonaUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    goal: str | None = None
    personality: str | None = None
    knowledge_level: str | None = None
    tag: str | None = None


class DimensionValueResponse(BaseModel):
    id: str
    dimension_id: str
    name: str
    description: str | None

    model_config = {"from_attributes": True}


class DimensionResponse(BaseModel):
    id: str
    project_id: str
    name: str
    values: list[DimensionValueResponse]

    model_config = {"from_attributes": True}


class PersonalityProfileResponse(BaseModel):
    id: str
    project_id: str
    name: str
    description: str | None

    model_config = {"from_attributes": True}


class InitiatingQuestionResponse(BaseModel):
    id: str
    project_id: str
    agent_id: str
    question: str
    expected_answer: str | None
    persona: str | None
    dimension: str | None
    dimension_value: str | None
    personality_profile: str | None

    model_config = {"from_attributes": True}


class QuestionUpdate(BaseModel):
    expected_answer: str | None = None
