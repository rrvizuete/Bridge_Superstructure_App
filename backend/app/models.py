from typing import List

from pydantic import BaseModel, Field


class DeflectionPoint(BaseModel):
    station: float = Field(..., description="Distance along girder.")
    deflection: float = Field(..., description="Measured deflection at station.")


class FitParabolaRequest(BaseModel):
    points: List[DeflectionPoint] = Field(..., min_length=3)


class FitParabolaResponse(BaseModel):
    coefficients: List[float]
    r_squared: float


class BuildProfileRequest(BaseModel):
    points: List[DeflectionPoint] = Field(..., min_length=3)
    intervals: int = Field(10, ge=2, le=500)


class ProfilePoint(BaseModel):
    station: float
    deflection: float


class BuildProfileResponse(BaseModel):
    coefficients: List[float]
    profile: List[ProfilePoint]
