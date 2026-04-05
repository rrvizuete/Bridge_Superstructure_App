from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .models import (
    BuildProfileRequest,
    BuildProfileResponse,
    FitParabolaRequest,
    FitParabolaResponse,
    ProfilePoint,
)
from .services.deflection import build_profile, fit_parabola

app = FastAPI(
    title="Bridge Superstructure App API",
    version="0.1.0",
    description="API scaffolding for girder/deck deflection workflows.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/fit-parabola", response_model=FitParabolaResponse)
def fit_parabola_endpoint(request: FitParabolaRequest) -> FitParabolaResponse:
    coefficients, r_squared = fit_parabola(request.points)
    return FitParabolaResponse(coefficients=coefficients.tolist(), r_squared=r_squared)


@app.post("/api/build-profile", response_model=BuildProfileResponse)
def build_profile_endpoint(request: BuildProfileRequest) -> BuildProfileResponse:
    coefficients, _ = fit_parabola(request.points)
    stations, deflections = build_profile(request.points, request.intervals)

    profile = [
        ProfilePoint(station=float(station), deflection=float(deflection))
        for station, deflection in zip(stations, deflections)
    ]

    return BuildProfileResponse(coefficients=coefficients.tolist(), profile=profile)


frontend_dir = Path(__file__).resolve().parents[2] / "frontend"
if frontend_dir.exists():
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
