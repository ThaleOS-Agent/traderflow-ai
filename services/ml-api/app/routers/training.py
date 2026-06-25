from fastapi import APIRouter

from app.schemas.training import GenerateSignalRequest, TrainingStartRequest
from app.services.training import training_service


router = APIRouter(tags=["training"])


@router.post("/training/start")
def start_training(payload: TrainingStartRequest) -> dict:
    job = training_service.start_job(payload.trainingData, payload.requestedBy)
    return {"success": True, "job": job}


@router.get("/training/status/{job_id}")
def get_training_status(job_id: str) -> dict:
    return {"success": True, "status": training_service.get_status(job_id)}


@router.get("/training/weights/latest")
def get_latest_weights() -> dict:
    return {"success": True, "weights": training_service.get_latest_weights()}


@router.post("/training/generate-signal")
def generate_signal(payload: GenerateSignalRequest) -> dict:
    signal = training_service.generate_signal(payload.symbol, payload.assetType, payload.marketData or {})
    return {"success": True, "signal": signal}
