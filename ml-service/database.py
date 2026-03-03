"""
SAIOMS ML Service — MongoDB connection via Motor (async driver).
"""
from __future__ import annotations

import os
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import IndexModel, ASCENDING, DESCENDING

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME   = os.getenv("DB_NAME", "saioms")

_client: Optional[AsyncIOMotorClient] = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(MONGO_URI)
    return _client


def get_db():
    return get_client()[DB_NAME]


def breed_logs_col():
    return get_db()["breed_logs"]


async def connect_db():
    """Pre-warm connection pool and create indexes on startup."""
    client = get_client()
    db     = client[DB_NAME]
    await db["breed_logs"].create_indexes([
        IndexModel([("created_at", DESCENDING)]),
    ])
    print(f"[ML-DB] Connected → {MONGO_URI} / {DB_NAME}")


async def close_db():
    global _client
    if _client:
        _client.close()
        _client = None
    print("[ML-DB] Connection closed")
