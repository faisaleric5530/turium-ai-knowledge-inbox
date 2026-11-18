from typing import Annotated, Literal

from pydantic import BaseModel, Field, HttpUrl, field_validator


class _IngestBase(BaseModel):
    title: str | None = Field(default=None, max_length=200)

    @field_validator("title")
    @classmethod
    def _blank_title_is_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None


class IngestNote(_IngestBase):
    type: Literal["note"]
    # Length limit is enforced in the service (413) rather than here (422).
    content: str = Field(min_length=1)

    @field_validator("content")
    @classmethod
    def _content_not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("content must not be blank")
        return value


class IngestUrl(_IngestBase):
    type: Literal["url"]
    url: HttpUrl

    @field_validator("url")
    @classmethod
    def _url_length(cls, value: HttpUrl) -> HttpUrl:
        if len(str(value)) > 2048:
            raise ValueError("url must be at most 2048 characters")
        return value


IngestRequest = Annotated[IngestNote | IngestUrl, Field(discriminator="type")]


class IngestAccepted(BaseModel):
    id: str
    status: Literal["pending"] = "pending"
