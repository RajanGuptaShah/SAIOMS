"""
SAIOMS — ML Microservice Entry Point
Handles: Breed Detection (PyTorch CNN Ensemble) + QR Code Generation/Decoding

Run with:
    uvicorn main:app --reload --port 8001

Environment variables:
    MONGO_URI    mongodb://localhost:27017
    DB_NAME      saioms
    QR_SECRET    <your AES secret key>
    QR_SALT      <your salt string>
"""
from __future__ import annotations
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

from database import connect_db, close_db
from routers.breed import router as breed_router
from routers.qr import router as qr_router


# ── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="SAIOMS ML Service",
    description="AI Breed Detection + QR Code Microservice for SAIOMS",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)


# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Static files (QR PNGs) ───────────────────────────────────────────────────
static_dir = Path(__file__).parent / "static"
static_dir.mkdir(exist_ok=True)
(static_dir / "qrcodes").mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")


# ── Lifecycle ─────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    await connect_db()
    print("SAIOMS ML Service started ✓")


@app.on_event("shutdown")
async def shutdown():
    await close_db()


# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(breed_router)
app.include_router(qr_router)


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["System"])
async def health():
    return {"status": "ok", "service": "SAIOMS ML Service v1.0"}


@app.get("/", tags=["System"])
async def root():
    return {
        "name":    "SAIOMS ML Service",
        "version": "1.0.0",
        "docs":    "/docs",
        "health":  "/health",
        "endpoints": {
            "detect_breed":  "POST /api/breed/detect",
            "model_status":  "GET  /api/breed/status",
            "breed_list":    "GET  /api/breed/list",
            "generate_qr":   "POST /api/qr/generate",
            "decode_qr":     "POST /api/qr/decode",
        },
    }


# ── Global error handler ──────────────────────────────────────────────────────
@app.exception_handler(Exception)
async def generic_error(request, exc):
    return JSONResponse(
        status_code=500,
        content={"success": False, "detail": str(exc)},
    )
