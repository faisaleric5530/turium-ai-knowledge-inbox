from fastapi import APIRouter, BackgroundTasks

from app.api.deps import ContainerDep
from app.logging_config import current_request_id
from app.schemas.ingest import IngestAccepted, IngestRequest

router = APIRouter(tags=["ingest"])


@router.post("/ingest", status_code=202, response_model=IngestAccepted)
def ingest(body: IngestRequest, background: BackgroundTasks, container: ContainerDep):
    """Save a note or URL and process it in the background (poll GET /items for status)."""
    item_id = container.ingestion.create(body)
    background.add_task(container.ingestion.process, item_id, current_request_id())
    return IngestAccepted(id=item_id)
