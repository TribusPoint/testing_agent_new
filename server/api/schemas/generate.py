from pydantic import BaseModel


class GeneratePersonasRequest(BaseModel):
    agent_id: str
    count: int = 4


class GenerateDimensionsRequest(BaseModel):
    pass


class GenerateProfilesRequest(BaseModel):
    pass


class GenerateQuestionsRequest(BaseModel):
    agent_id: str
    questions_per_agent: int = 30
