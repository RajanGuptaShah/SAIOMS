"""
SAIOMS ML Service — Breed Detection Router
POST /api/breed/detect   — Upload image → breed predictions
GET  /api/breed/status   — Model status
GET  /api/breed/list     — Full breed catalogue
"""
from __future__ import annotations
from datetime import datetime

from fastapi import APIRouter, File, UploadFile, HTTPException

from database import breed_logs_col
from models.schemas import BreedDetectResponse
from services.breed_service import detect_breed, ALL_BREEDS, BREED_SPECIES, MODEL_READY

# Model version string is set by breed_service at load time
try:
    from services.breed_service import _hf_model as _hm
    _MODEL_VERSION = "hf-ujjwal75-indian-bovine-v1" if (_hm is not None) else "demo-heuristic-v3"
except Exception:
    _MODEL_VERSION = "demo-heuristic-v3"

router = APIRouter(prefix="/api/breed", tags=["Breed Detection"])

MAX_BYTES = 10 * 1024 * 1024  # 10 MB


@router.post("/detect", response_model=BreedDetectResponse)
async def detect_breed_endpoint(file: UploadFile = File(...)):
    """
    Upload a JPEG/PNG image of an animal.
    Returns top-3 breed predictions with confidence scores.
    """
    if file.content_type not in ("image/jpeg", "image/png", "image/jpg", "image/webp"):
        raise HTTPException(status_code=415, detail="Only JPEG/PNG/WebP images are accepted")

    image_bytes = await file.read()
    if len(image_bytes) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Image too large (max 10 MB)")

    try:
        result = detect_breed(image_bytes)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Inference failed: {exc}")

    # Log to MongoDB (best-effort, non-blocking)
    try:
        col = breed_logs_col()
        await col.insert_one({
            "filename":   file.filename,
            "top_breed":  result["top_breed"],
            "confidence": result["confidence"],
            "model":      result["model_version"],
            "created_at": datetime.utcnow(),
        })
    except Exception:
        pass

    return result


@router.get("/status")
async def model_status():
    return {
        "model_ready":   MODEL_READY,
        "model_version": _MODEL_VERSION,
        "num_breeds":    len(ALL_BREEDS),
        "breeds": {"cattle": 15, "buffalo": 10},
        "message": (
            f"CLIP ViT-B/32 zero-shot active — {len(ALL_BREEDS)} Indian breeds supported"
            if MODEL_READY else
            "Running heuristic fallback — install openai-clip for real AI inference"
        ),
    }


@router.get("/list")
async def breed_list():
    return {
        "total": len(ALL_BREEDS),
        "breeds": [
            {"name": b, "species": BREED_SPECIES[b]}
            for b in ALL_BREEDS
        ],
    }
