# SAIOMS — Microservice Architecture

**Smart Animal Identification and Ownership Management System**

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  Browser → React + Vite  (:5173 dev / :80 Docker)       │
└────────────────────┬────────────────────────────────────┘
                     │  REST API calls
┌────────────────────▼────────────────────────────────────┐
│  Node.js + Express Backend  (:5000)                     │
│  • Animal CRUD (Mongoose → MongoDB)                     │
│  • Ownership transfer, health records                   │
└──────┬──────────────────────┬───────────────────────────┘
       │                      │  HTTP proxy
       ▼                      ▼
┌────────────┐   ┌─────────────────────────────────────────┐
│  MongoDB   │   │  Python + FastAPI ML Service  (:8001)   │
│  (:27017)  │   │  • CNN Ensemble breed detection          │
└────────────┘   │  • AES-256 QR code generation/decoding  │
                 └─────────────────────────────────────────┘
```

| Service | Stack | Port | Folder |
|---|---|---|---|
| Frontend | React + Vite | `5173` (dev) | `frontend/` |
| Backend  | Node.js + Express + Mongoose | `5000` | `backend/` |
| ML Service | Python + FastAPI + PyTorch | `8001` | `ml-service/` |
| Database | MongoDB | `27017` | (external) |

---

## 🚀 Quick Start (Without Docker)

### Step 1 — Start MongoDB
```bash
mongod --dbpath /data/db
```

### Step 2 — Start ML Service
```powershell
cd ml-service
pip install -r requirements.txt
# Copy env file
copy .env.example .env
uvicorn main:app --reload --port 8001
```
Swagger UI → http://localhost:8001/docs

### Step 3 — Start Node.js Backend
```powershell
cd backend
# Install Node.js first: https://nodejs.org
npm install
copy .env.example .env
npm run dev      # uses nodemon for auto-restart
# or: node src/app.js
```
API → http://localhost:5000

### Step 4 — Start React Frontend
```powershell
cd frontend
npm install
copy .env.example .env
npm run dev
```
App → http://localhost:5173

---

## 🐳 Quick Start (Docker Compose)

```bash
# Build and run everything
docker-compose up --build

# Services:
#   Frontend  → http://localhost
#   Backend   → http://localhost:5000
#   ML Service→ http://localhost:8001
#   MongoDB   → localhost:27017
```

---

## Project Structure

```
capstone/
├── docker-compose.yml          ← Orchestrates all services
│
├── ml-service/                 ← 🐍 Python + FastAPI + PyTorch
│   ├── main.py                 ← App entry point (:8001)
│   ├── database.py             ← Motor async MongoDB
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── models/schemas.py       ← Pydantic schemas
│   ├── routers/
│   │   ├── breed.py            ← POST /api/breed/detect
│   │   └── qr.py               ← POST /api/qr/generate|decode
│   └── services/
│       ├── breed_service.py    ← CNN ensemble + demo fallback
│       └── qr_service.py       ← AES-256 Fernet QR
│
├── backend/                    ← 🟢 Node.js + Express
│   ├── src/app.js              ← Entry point (:5000)
│   ├── src/db/mongo.js         ← Mongoose connection
│   ├── src/models/Animal.js    ← Mongoose schema
│   ├── src/routes/
│   │   ├── animals.js          ← Full CRUD + transfer
│   │   └── breed.js            ← Proxy → ML service
│   ├── src/middleware/
│   │   └── errorHandler.js
│   ├── package.json
│   └── Dockerfile
│
├── frontend/                   ← ⚛️  React + Vite
│   ├── src/
│   │   ├── App.jsx             ← Routes
│   │   ├── index.css           ← Design system
│   │   ├── services/api.js     ← Axios API layer
│   │   ├── components/
│   │   │   └── Navbar.jsx
│   │   └── pages/
│   │       ├── Dashboard.jsx       ← Animal list + stats
│   │       ├── RegisterAnimal.jsx  ← Registration form
│   │       ├── AnimalProfile.jsx   ← Detail + tabs
│   │       └── BreedDetector.jsx   ← AI upload + results
│   ├── vite.config.js
│   ├── package.json
│   └── Dockerfile
│
└── (legacy — original monolith, still works independently)
    ├── main.py
    ├── database.py
    ├── breed_service.py
    ├── qr_service.py
    └── index.html
```

---

## API Reference

### Backend (:5000)

| Method | Path | Description |
|---|---|---|
| POST | `/api/animals/register` | Register new animal |
| GET  | `/api/animals` | List (pagination + filters) |
| GET  | `/api/animals/:id` | Single animal |
| GET  | `/api/animals/qr/:qrId` | Download QR PNG |
| POST | `/api/animals/decode-qr` | Verify/decode QR |
| POST | `/api/animals/transfer` | Ownership transfer |
| PUT  | `/api/animals/:id/health` | Update health record |
| POST | `/api/breed/detect` | AI breed detection (proxy) |
| GET  | `/api/breed/status` | ML model status (proxy) |
| GET  | `/api/breed/list` | Breed catalogue (proxy) |

### ML Service (:8001)

| Method | Path | Description |
|---|---|---|
| POST | `/api/breed/detect` | Upload image → top-3 breeds |
| GET  | `/api/breed/status` | PyTorch model status |
| GET  | `/api/breed/list` | All 25 supported breeds |
| POST | `/api/qr/generate` | Generate encrypted QR |
| POST | `/api/qr/decode` | Decrypt/verify QR payload |

---

## AI Model Training

```bash
cd ml-service
python services/breed_service.py --train \
  --data ../dataset/augmented \
  --epochs 50

# Weights saved to: ../weights/ensemble_weights.pt
# Restart ml-service to auto-load real model
```

Model weights folder:
```
weights/
└── ensemble_weights.pt
```

---

## Environment Variables

### `ml-service/.env`
```
MONGO_URI=mongodb://localhost:27017
DB_NAME=saioms
QR_SECRET=change-this-to-a-strong-secret
QR_SALT=saioms-salt-2024
SERVER_URL=http://localhost:8001
```

### `backend/.env`
```
PORT=5000
MONGO_URI=mongodb://localhost:27017
DB_NAME=saioms
ML_SERVICE_URL=http://localhost:8001
```

### `frontend/.env`
```
VITE_API_BASE_URL=http://localhost:5000
```
