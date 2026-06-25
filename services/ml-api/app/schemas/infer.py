from typing import Any

from pydantic import BaseModel, Field


class PriceDirectionRequest(BaseModel):
    symbol: str
    assetType: str = "crypto"
    prices: list[float] = Field(min_length=2, max_length=10000)
    volumes: list[float] = Field(min_length=2, max_length=10000)
    highs: list[float] | None = None
    lows: list[float] | None = None


class OpportunityScoreRequest(BaseModel):
    opportunity: dict[str, Any]
    marketData: dict[str, Any]


class VolatilityForecastRequest(BaseModel):
    symbol: str
    assetType: str = "crypto"
    prices: list[float] = Field(min_length=2, max_length=10000)
    highs: list[float] | None = None
    lows: list[float] | None = None
