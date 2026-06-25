from typing import Any

from pydantic import BaseModel


class TrainingStartRequest(BaseModel):
    trainingData: dict[str, Any] | None = None
    requestedBy: str | None = None


class GenerateSignalRequest(BaseModel):
    symbol: str
    assetType: str = "crypto"
    marketData: dict[str, Any] | None = None
