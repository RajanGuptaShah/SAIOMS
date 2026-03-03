"""
SAIOMS ML Service — QR Code Router
Exposes QR generation and decoding as HTTP endpoints
so the Node.js backend can call them via REST.

POST /api/qr/generate  — Generate encrypted QR for an animal doc
POST /api/qr/decode    — Decode/verify a QR payload
GET  /api/qr/image/{qr_id} — (served via /static, this is just a helper)
"""
from __future__ import annotations
import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path

from models.schemas import QRGenerateRequest, QRGenerateResponse, QRDecodeRequest
from services.qr_service import generate_qr, decode_qr

router = APIRouter(prefix="/api/qr", tags=["QR Code"])

SERVER_URL = os.getenv("SERVER_URL", "http://localhost:8001")
QR_DIR     = Path(__file__).parent.parent / "static" / "qrcodes"


@router.post("/generate", response_model=QRGenerateResponse)
async def generate_qr_endpoint(body: QRGenerateRequest):
    """
    Accepts an animal document as JSON.
    Returns qr_id, filename, and download URL for the PNG.
    """
    try:
        qr_id, qr_filename = generate_qr(body.animal_doc)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"QR generation failed: {exc}")

    return QRGenerateResponse(
        success=True,
        qr_id=qr_id,
        qr_filename=qr_filename,
        qr_url=f"{SERVER_URL}/static/qrcodes/{qr_filename}",
    )


@router.post("/decode")
async def decode_qr_endpoint(body: QRDecodeRequest):
    """
    Accepts { "payload": "<encrypted QR string>" }.
    Returns decrypted animal data or 400 on tamper.
    """
    if not body.payload:
        raise HTTPException(status_code=400, detail="No payload provided")
    try:
        data = decode_qr(body.payload)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid or tampered QR code")
    return {"success": True, "data": data}


@router.get("/image/{qr_filename}")
async def get_qr_image(qr_filename: str):
    """Serve a QR PNG by filename."""
    path = QR_DIR / qr_filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="QR image not found")
    return FileResponse(str(path), media_type="image/png")
