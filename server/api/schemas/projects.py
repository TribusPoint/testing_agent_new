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
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PersonaResponse(BaseModel):
    id: str
    project_id: str
    agent_id: str | None
    name: str
    description: str | None
    tag: str | None

    model_config = {"from_attributes": True}


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
