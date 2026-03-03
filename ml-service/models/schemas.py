"""
SAIOMS ML Service — Pydantic schemas for breed detection and QR.
"""
from __future__ import annotations

from typing import List, Literal, Optional
from pydantic import BaseModel


class BreedPrediction(BaseModel):
    breed:      str
    confidence: float
    rank:       int


class BreedDetectResponse(BaseModel):
    success:       bool = True
    top_breed:     str
    confidence:    float
    predictions:   List[BreedPrediction]
    species:       Literal["cattle", "buffalo"]
    estimated_age: Optional[str] = None
    bcs:           Optional[str] = None
    notes:         Optional[str] = None
    model_version: str = "ensemble-v1"


class QRGenerateRequest(BaseModel):
    animal_doc: dict


class QRGenerateResponse(BaseModel):
    success:     bool = True
    qr_id:       str
    qr_filename: str
    qr_url:      str


class QRDecodeRequest(BaseModel):
    payload: str
