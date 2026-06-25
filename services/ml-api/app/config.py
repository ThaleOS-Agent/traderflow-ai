from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    service_name: str = "tradeflow-ml-api"
    environment: str = "development"
    default_training_epochs: int = 100
    default_model_version: str = "starter-v1"
    signal_confidence_floor: int = 75

    model_config = SettingsConfigDict(env_prefix="ML_API_", extra="ignore")


settings = Settings()
