from fastapi import FastAPI

from app.routers import health, infer, training


app = FastAPI(
    title="TradeFlow ML API",
    version="0.1.0",
    description="Internal FastAPI sidecar for TradeFlow AI inference and training workloads.",
)

app.include_router(health.router)
app.include_router(infer.router, prefix="/v1")
app.include_router(training.router, prefix="/v1")
