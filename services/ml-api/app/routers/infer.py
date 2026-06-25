from fastapi import APIRouter

from app.schemas.infer import (
    OpportunityScoreRequest,
    PriceDirectionRequest,
    VolatilityForecastRequest,
)
from app.services.inference import inference_service
from app.services.models import model_registry


router = APIRouter(tags=["infer"])


@router.post("/infer/price-direction")
def predict_price_direction(payload: PriceDirectionRequest) -> dict:
    prediction = inference_service.predict_price_direction(payload.model_dump())
    return {"success": True, "prediction": prediction}


@router.post("/infer/opportunity-score")
def score_opportunity(payload: OpportunityScoreRequest) -> dict:
    score = inference_service.score_opportunity(
        payload.opportunity,
        payload.marketData,
    )
    return {"success": True, "score": score}


@router.post("/infer/volatility-forecast")
def forecast_volatility(payload: VolatilityForecastRequest) -> dict:
    forecast = inference_service.forecast_volatility(payload.model_dump())
    return {"success": True, "forecast": forecast}


@router.get("/models")
def get_models() -> dict:
    return {"success": True, "models": model_registry.describe_models()}


@router.get("/performance")
def get_performance() -> dict:
    return {"success": True, "performance": inference_service.get_performance()}
