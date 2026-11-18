from fastapi import APIRouter

from app.api.deps import ContainerDep
from app.errors import PayloadTooLargeError
from app.schemas.query import QueryRequest, QueryResponse

router = APIRouter(tags=["query"])


@router.post("/query", response_model=QueryResponse)
def query(body: QueryRequest, container: ContainerDep):
    """Answer a question from saved items, with numbered source citations."""
    limit = container.settings.question_max_chars
    if len(body.question) > limit:
        raise PayloadTooLargeError(
            f"Questions are limited to {limit:,} characters (got {len(body.question):,})."
        )
    top_k = body.top_k
    if top_k is not None:
        top_k = min(top_k, container.settings.top_k_max)
    return container.answering.answer(body.question, top_k)
