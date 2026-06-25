from app.config import settings


class ModelRegistry:
    def __init__(self) -> None:
        self._models = [
            {
                "name": "priceDirection",
                "type": "starter_classifier",
                "version": settings.default_model_version,
                "description": "Starter direction model for migration from Express ML routes.",
            },
            {
                "name": "opportunityScore",
                "type": "starter_ensemble",
                "version": settings.default_model_version,
                "description": "Starter opportunity scoring model for migration from Express ML routes.",
            },
            {
                "name": "volatilityForecast",
                "type": "starter_forecaster",
                "version": settings.default_model_version,
                "description": "Starter volatility forecasting model for migration from Express ML routes.",
            },
        ]

    def list_models(self) -> list[str]:
        return [model["name"] for model in self._models]

    def describe_models(self) -> list[dict]:
        return self._models


model_registry = ModelRegistry()
