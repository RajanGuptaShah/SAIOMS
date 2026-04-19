"""
SAIOMS ML Service — QR Code Service
Generates simple, fast-scanning QR codes for animal identity lookup.

v2: Encodes ONLY the qr_id UUID (36 chars) in the QR code for maximum
scannability (QR version 2, 25×25 modules). All animal data is fetched
from the database at scan time using this ID as the lookup key.
"""
from __future__ import annotations
import os
import json
import uuid
import base64
import qrcode
from pathlib import Path
from PIL import Image
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

# ── Key derivation (kept for backward-compatible decoding of old QRs) ──────────
_SECRET = os.getenv("QR_SECRET", "saioms-default-secret-change-in-production")
_SALT   = os.getenv("QR_SALT",   "saioms-salt-2024").encode()


def _make_cipher() -> Fernet:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=_SALT,
        iterations=480_000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(_SECRET.encode()))
    return Fernet(key)


_CIPHER = _make_cipher()

# ── Paths ──────────────────────────────────────────────────────────────────────
QR_DIR = Path(__file__).parent.parent / "static" / "qrcodes"
QR_DIR.mkdir(parents=True, exist_ok=True)

# ── QR image settings ─────────────────────────────────────────────────────────
_QR_IMAGE_SIZE = 500          # Final output size in pixels (500×500)
_QR_BOX_SIZE   = 20           # Large modules for easy scanning
_QR_BORDER     = 4            # 4-module quiet zone (ISO standard)


# ── Public API ─────────────────────────────────────────────────────────────────
def generate_qr(animal_doc: dict) -> tuple[str, str]:
    """
    Generate a simple, fast-scanning QR code for an animal document.
    Encodes only the qr_id UUID (36 chars) → QR version 2 (25×25 modules).
    Returns (qr_id, qr_filename).
    """
    qr_id = str(uuid.uuid4())

    # ── Build QR with minimal data for instant scanning ────────────────────
    qr = qrcode.QRCode(
        version=2,                                    # Force low version (25×25)
        error_correction=qrcode.constants.ERROR_CORRECT_M,  # Medium EC — good balance
        box_size=_QR_BOX_SIZE,
        border=_QR_BORDER,
    )
    qr.add_data(qr_id)                               # Only 36-char UUID
    qr.make(fit=True)

    # Pure black on white for maximum contrast (best for low-end cameras)
    img = qr.make_image(fill_color="black", back_color="white")

    # Resize to consistent 500×500px output
    img = img.resize((_QR_IMAGE_SIZE, _QR_IMAGE_SIZE), Image.NEAREST)

    filename = f"{animal_doc.get('animal_id', 'unknown')}_{qr_id[:8]}.png"
    img.save(str(QR_DIR / filename))

    return qr_id, filename


def decode_qr(encoded_str: str) -> dict:
    """
    Decrypt and verify an OLD encrypted QR payload string.
    Kept for backward compatibility with v1 Fernet-encrypted QR codes.
    Raises on tamper or if the string is not a valid encrypted payload.
    """
    encrypted_bytes = base64.urlsafe_b64decode(encoded_str.encode())
    decrypted       = _CIPHER.decrypt(encrypted_bytes)
    return json.loads(decrypted.decode())
