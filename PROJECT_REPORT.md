# SAIOMS - Smart Animal Identification and Ownership Management System
## Comprehensive Project Documentation

---

### 1. Abstract
The **Smart Animal Identification and Ownership Management System (SAIOMS)** is a modern, microservice-based web application tailored to revolutionize livestock management. It provides a secure, reliable, and accessible platform for tracking animal ownership, maintaining health records, and streamlining the transfer of ownership. By integrating cutting-edge machine learning (ML) models for breed identification, advanced cryptographic algorithms (AES-256) for secure QR code-based identification, and an intuitive user interface, SAIOMS empowers farmers, veterinarians, and animal owners with critical tools optimized for both desktop and mobile devices.

### 2. Introduction
Livestock management in rural and semi-urban areas often relies on fragmented, paper-based records, making ownership tracking, health monitoring, and breed identification inefficient and susceptible to fraud. SAIOMS bridges this technological gap by digitizing the entire lifecycle of animal ownership. 

The platform allows users to register animals, generate secure encrypted QR codes for physical tagging, log vaccination and health data, and seamlessly transfer ownership to other registered users. To cater specifically to the Indian demographic, the system features robust **Hindi language localization** and regional search capabilities. Additional quality-of-life integrations, such as a localized chat system, map-based geographic tagging, and AI-driven "Nearby Help" functionalities, make SAIOMS a holistic, one-stop solution for modern animal husbandry.

### 3. Key Features
- **Animal Registration & Profile Management:** Register animals with detailed metadata, including age, breed, weight, and vaccination history.
- **Secure QR Code Generation & Scanning:** Utilizes AES-256 encryption via Fernet to generate customized QR codes for each animal. A highly optimized, fast camera scanner is integrated for instant decoding and profile retrieval.
- **AI-Powered Breed Identification:** Deploys an ensemble of Convolutional Neural Networks (CNN) powered by PyTorch to classify uploaded animal images into 25 distinct supported breeds.
- **Secure Ownership Transfer:** Cryptographically secure workflow for transferring animal ownership between registered accounts while maintaining a permanent, unalterable history.
- **Health & Vaccination Alerts:** Maintains detailed health records with seasonal alerts for vaccinations depending on the species.
- **Language Localization (Hindi):** A dedicated toggle allows users to switch the entire user interface between English and Hindi, improving accessibility while retaining standard English formats for critical data like emails, phones, and IDs.
- **Dark / Light Mode:** Fully responsive UI/UX with seamless dark and light theme toggles.
- **Geographic Tagging (Maps):** Allows users to securely drop a location pin for an animal or farm using a built-in map integration.
- **"Nearby Help" & Gemini API Integration:** Employs the Gemini API to provide smart search results for nearby veterinarians, feed suppliers, and farming services.
- **Real-time User Chat:** A built-in user-to-user chat service allowing text and image sharing for seamless communication between buyers, sellers, and vets.

---

### 4. Technical Architecture
The application is structured into a **Microservices Architecture**, containerized using Docker and orchestrated via Docker Compose.

#### 4.1. Frontend Service (React + Vite)
- **Role:** Handles the User Interface and Client-side experience.
- **Stack:** React, Vite, JavaScript, CSS3.
- **Key Modules:** Router for navigation, Context API for state management, HTML5-QRCode/jsQR for fast camera scanning, Axios for API communication.

#### 4.2. Backend Service (Node.js + Express)
- **Role:** The primary RESTful API gateway connecting the database with the frontend.
- **Stack:** Node.js, Express.js, Mongoose.
- **Key Modules:** JWT (JSON Web Tokens) for authentication, BcryptJS for password hashing, Multer for image uploads.
- **Capabilities:** Manages User and Animal CRUD operations, tracks ownership transfers, and proxies specific heavy tasks to the ML Microservice.

#### 4.3. Machine Learning (ML) Microservice
- **Role:** A dedicated GPU-accelerated computing service running demanding AI and Cryptographic workloads to avoid blocking the main Node.js event loop.
- **Stack:** Python, FastAPI, PyTorch, Uvicorn, OpenAI-CLIP.
- **Key Modules:** 
  - `breed_service.py`: Loads the `.pt` weights for the CNN ensemble to run breed inference.
  - `qr_service.py`: Handles AES-256 Fernet payload encryption and decryption for proprietary QR codes.

#### 4.4. Database (MongoDB)
- **Role:** A NoSQL datastore for flexible, scalable doc-storage.
- **Collections:** Users, Animals, Health Records, Chats/Messages.

---

### 5. Technologies Used
#### Frontend
- **React 18** (UI Library)
- **Vite** (Next-generation bundler)
- **React Router v6** (Routing)
- **Axios** (HTTP Client)
- **Tailwind / Custom CSS** (Responsive UI, Dark Mode styling)

#### Backend Core
- **Node.js** & **Express.js** (Server Logic)
- **MongoDB** & **Mongoose** (Database & ORM)
- **JSON Web Tokens (JWT)** (Session Security)
- **Multer** (Multipart/form-data handling)

#### ML / AI Microservice
- **Python 3.10+**
- **FastAPI** (High-performance API framework)
- **PyTorch & Torchvision** (Deep Learning framework)
- **Scikit-learn** & **Numpy** (Numerical operations & ML utilities)
- **Cryptography** (AES-256 for QR security)
- **Google Gemini API** (For Nearby Help contextual search)

#### DevOps & Deployment
- **Docker** & **Docker Compose** (Containerization & Orchestration)
- **Nginx** (Reverse Proxy & Static File Serving - implicitly in prod)
- **Git** (Version Control)

---

### 6. Project Structure Overview
```
capstone/
├── docker-compose.yml          # Global orchestrator
├── backend/                    # Node.js + Express API
│   ├── src/models/             # DB Schemas (User, Animal, etc.)
│   ├── src/routes/             # API Endpoints
│   └── Dockerfile              # Backend container
├── frontend/                   # React SPA
│   ├── src/components/         # Reusable UI widgets
│   ├── src/pages/              # Views (Dashboard, Profile, Chat)
│   └── Dockerfile              # Frontend container
├── ml-service/                 # FastAPI ML Server
│   ├── routers/                # Inferencing API Endpoints (breed, qr)
│   ├── services/               # Cryptography and PyTorch loading logic
│   └── Dockerfile              # ML container
└── PROJECT_REPORT.md           # This Documentation
```

### 7. Setup & Execution (via Docker)
To deploy the whole architecture seamlessly:
1. Ensure **Docker Desktop** or Docker Engine is installed and running.
2. Initialize the environment variables (`.env` files in frontend, backend, and ml-service) by copying the respective `.env.example` configurations.
3. Open a terminal in the root directory and run:
   ```bash
   docker-compose up --build
   ```
4. Access the services:
   - Frontend Application: `http://localhost`
   - Backend API: `http://localhost:5000`
   - ML Fast API Docs: `http://localhost:8001/docs`

---
*Developed as a comprehensive solution for intelligent livestock tracking and modern agrarian empowerment.*
