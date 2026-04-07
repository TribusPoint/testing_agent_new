from pydantic import BaseModel, ConfigDict


class GeneratePersonasRequest(BaseModel):
    agent_id: str
    count: int = 4


class GenerateDimensionsRequest(BaseModel):
    pass


class GenerateProfilesRequest(BaseModel):
    pass


class GenerateQuestionsRequest(BaseModel):
    """Project-scoped generation; no connection/agent required."""

    model_config = ConfigDict(extra="ignore")

    questions_per_agent: int = 30
