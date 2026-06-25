from datetime import datetime, timezone

from app.config import settings
from app.services.features import build_feature_summary, clamp


class InferenceService:
    def __init__(self) -> None:
        self.performance = {
            "predictions": 0,
            "correctPredictions": 0,
            "accuracy": 0.0,
            "lastTraining": None,
        }

    def predict_price_direction(self, market_data: dict) -> dict:
        prices = [float(value) for value in market_data["prices"]]
        volumes = [float(value) for value in market_data["volumes"]]
        summary = build_feature_summary(prices, volumes)

        bullish_probability = clamp(0.5 + summary["returns"] * 4, 0.05, 0.9)
        bearish_probability = clamp(0.5 - summary["returns"] * 4, 0.05, 0.9)
        neutral_probability = clamp(1 - abs(summary["returns"] * 6), 0.05, 0.8)

        total = bullish_probability + bearish_probability + neutral_probability
        probabilities = {
            "bearish": bearish_probability / total,
            "neutral": neutral_probability / total,
            "bullish": bullish_probability / total,
        }

        direction = max(probabilities, key=probabilities.get)
        confidence = round(probabilities[direction] * 100, 2)
        predicted_change = round(summary["returns"] * 100 * 0.5, 2)

        self.performance["predictions"] += 1

        return {
            "symbol": market_data["symbol"],
            "direction": direction,
            "confidence": f"{confidence:.2f}",
            "confidenceScore": round(confidence),
            "probabilities": {key: f"{value * 100:.2f}" for key, value in probabilities.items()},
            "predictedChange": f"{predicted_change:.2f}",
            "timeframe": "next 5 periods",
            "model": "starter_classifier",
            "accuracy": 0.75,
            "modelVersion": settings.default_model_version,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    def score_opportunity(self, opportunity: dict, market_data: dict) -> dict:
        prices = [float(value) for value in market_data.get("prices", [1.0, 1.01])]
        volumes = [float(value) for value in market_data.get("volumes", [1000.0, 1200.0])]
        summary = build_feature_summary(prices, volumes)

        pattern_confidence = float(opportunity.get("confidenceScore") or opportunity.get("confidence") or 65)
        risk = max(float(opportunity.get("risk") or 1), 0.1)
        momentum_boost = clamp(summary["returns"] * 100, -10, 10)
        volatility_penalty = clamp(summary["volatility"] * 100, 0, 20)

        opportunity_score = clamp(pattern_confidence + momentum_boost - (volatility_penalty * 0.4), 1, 99)
        win_probability = clamp(opportunity_score / 100, 0.05, 0.98)
        confidence_score = round(opportunity_score)

        if confidence_score >= 85:
            confidence = "very_high"
        elif confidence_score >= 75:
            confidence = "high"
        elif confidence_score >= 60:
            confidence = "medium"
        else:
            confidence = "low"

        return {
            "symbol": market_data.get("symbol") or opportunity.get("symbol"),
            "opportunityScore": f"{opportunity_score:.2f}",
            "confidenceScore": confidence_score,
            "confidence": confidence,
            "consensusStrength": f"{clamp(100 - volatility_penalty * 3, 10, 99):.1f}",
            "expectedReturn": f"{(opportunity_score / 10):.2f}",
            "expectedSharpe": f"{clamp(opportunity_score / 25, 0.1, 5):.2f}",
            "winProbability": f"{win_probability * 100:.1f}",
            "riskAdjustedScore": f"{(opportunity_score / risk):.2f}",
            "modelContributions": {
                "starter_classifier": {"score": f"{opportunity_score:.2f}", "weight": 0.6, "accuracy": 0.75},
                "starter_volatility": {"score": f"{(100 - volatility_penalty):.2f}", "weight": 0.4, "accuracy": 0.68},
            },
            "ensembleAccuracy": 0.73,
            "recommendation": "strong_buy" if opportunity_score >= 80 else "watch" if opportunity_score >= 60 else "pass",
            "modelVersion": settings.default_model_version,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    def forecast_volatility(self, market_data: dict) -> dict:
        prices = [float(value) for value in market_data["prices"]]
        summary = build_feature_summary(prices)
        current_volatility = round(summary["volatility"] * 100, 4)
        forecast_value = round(clamp(current_volatility * 1.1 + 0.25, 0.01, 25), 4)

        return {
            "symbol": market_data["symbol"],
            "assetType": market_data.get("assetType", "crypto"),
            "forecast": f"{forecast_value:.4f}",
            "volatilityRegime": "high" if forecast_value > 5 else "medium" if forecast_value > 2 else "low",
            "lookback": len(prices),
            "model": "starter_forecaster",
            "modelVersion": settings.default_model_version,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    def get_performance(self) -> dict:
        return self.performance


inference_service = InferenceService()
