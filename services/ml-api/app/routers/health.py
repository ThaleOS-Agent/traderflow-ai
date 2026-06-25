from fastapi import APIRouter

from app.config import settings
from app.services.models import model_registry
from app.services.training import training_service


router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": settings.service_name,
        "environment": settings.environment,
        "modelsLoaded": model_registry.list_models(),
        "trainingJobs": training_service.job_count(),
    }
