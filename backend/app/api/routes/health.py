from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.api.deps import ContainerDep

router = APIRouter(tags=["meta"])


@router.get("/health")
def health(container: ContainerDep):
    db_ok = container.db.ping()
    embedder = container.embedder
    ready = db_ok and embedder.status == "ready"
    body = {
        "status": "ok" if ready else "unavailable",
        "db": "ok" if db_ok else "error",
        "embedder": embedder.status,
        "embedder_error": embedder.error,
        "model": embedder.model_name,
        "dim": embedder.dim,
        "llm_configured": container.settings.llm_configured,
    }
    return JSONResponse(status_code=200 if ready else 503, content=body)
