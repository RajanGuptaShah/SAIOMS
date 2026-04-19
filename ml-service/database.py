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


import urllib.parse

def _encode_mongo_uri(uri: str) -> str:
    """
    Re-encode username and password in a MongoDB URI so special characters
    (@ ! # $ % etc.) don't break PyMongo's URI parser.
    Safe to call even if the URI has no credentials (localhost).
    """
    try:
        parsed = urllib.parse.urlparse(uri)
        if parsed.username:
            user = urllib.parse.quote_plus(parsed.username)
            pwd  = urllib.parse.quote_plus(parsed.password or "")
            # Rebuild netloc with encoded creds
            host = parsed.hostname
            port = f":{parsed.port}" if parsed.port else ""
            netloc = f"{user}:{pwd}@{host}{port}"
            uri = urllib.parse.urlunparse(parsed._replace(netloc=netloc))
    except Exception:
        pass  # If parsing fails, return original and let pymongo report the error
    return uri


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(_encode_mongo_uri(MONGO_URI))
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
