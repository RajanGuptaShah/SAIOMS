"""
SAIOMS ML Service — QR Code Service
Generates AES-256-Fernet encrypted QR codes for animal ownership records.
"""
from __future__ import annotations
import os
import json
import uuid
import base64
import qrcode
from pathlib import Path
from datetime import datetime
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

# ── Key derivation ─────────────────────────────────────────────────────────────
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


# ── Public API ─────────────────────────────────────────────────────────────────
def generate_qr(animal_doc: dict) -> tuple[str, str]:
    """
    Generate an encrypted QR code for an animal document.
    Returns (qr_id, qr_filename).
    """
    qr_id = str(uuid.uuid4())

    payload = {
        "qr_id":         qr_id,
        "animal_id":     animal_doc.get("animal_id"),
        "owner_name":    animal_doc.get("owner_name"),
        "owner_phone":   animal_doc.get("owner_phone"),
        "district":      animal_doc.get("district"),
        "state":         animal_doc.get("state"),
        "species":       animal_doc.get("species"),
        "breed":         animal_doc.get("breed"),
        "gender":        animal_doc.get("gender"),
        "dob":           animal_doc.get("dob"),
        "health_status": animal_doc.get("health_status"),
        "vaccinations":  animal_doc.get("vaccinations", []),
        "generated_at":  datetime.utcnow().isoformat() + "Z",
        "version":       "saioms-qr-v1",
    }

    encrypted_bytes = _CIPHER.encrypt(json.dumps(payload).encode())
    encoded_str     = base64.urlsafe_b64encode(encrypted_bytes).decode()

    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    qr.add_data(encoded_str)
    qr.make(fit=True)

    img      = qr.make_image(fill_color="#1B4332", back_color="white")
    filename = f"{animal_doc.get('animal_id', 'unknown')}_{qr_id[:8]}.png"
    img.save(str(QR_DIR / filename))

    return qr_id, filename


def decode_qr(encoded_str: str) -> dict:
    """Decrypt and verify a QR payload string. Raises on tamper."""
    encrypted_bytes = base64.urlsafe_b64decode(encoded_str.encode())
    decrypted       = _CIPHER.decrypt(encrypted_bytes)
    return json.loads(decrypted.decode())
