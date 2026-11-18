from pydantic import BaseModel, Field, field_validator


class QueryRequest(BaseModel):
    question: str = Field(min_length=1)
    top_k: int | None = Field(default=None, ge=1, le=10)

    @field_validator("question")
    @classmethod
    def _strip_question(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("question must not be blank")
        return value


class SourceOut(BaseModel):
    index: int
    item_id: str
    title: str | None
    source_url: str | None
    snippet: str
    score: float


class QueryResponse(BaseModel):
    answer: str
    sources: list[SourceOut]
    model: str | None
    answered: bool
