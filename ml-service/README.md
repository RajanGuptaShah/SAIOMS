---
title: SAIOMS ML Service
emoji: 🐄
colorFrom: green
colorTo: yellow
sdk: docker
pinned: false
app_port: 8001
---

# SAIOMS ML Service

AI-powered breed detection + QR code microservice for the SAIOMS livestock management platform.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/api/breed/detect` | Detect breed from image |
| `GET` | `/api/breed/list` | List all supported breeds |
| `POST` | `/api/qr/generate` | Generate signed QR code |
| `POST` | `/api/qr/decode` | Decode QR payload |

## Supported Breeds

25 Indian cattle and buffalo breeds including Gir, Sahiwal, Murrah, Tharparkar, Kankrej, and more.

## Environment Variables Required

Set these in Space **Settings → Variables and Secrets**:
- `MONGO_URI` — MongoDB Atlas connection string
- `DB_NAME` — Database name (e.g. `saioms`)
- `QR_SECRET` — Secret key for QR signing
- `QR_SALT` — Salt for QR signing
