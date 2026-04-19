/**
 * SAIOMS — Breed Router (Express)
 * Thin proxy that forwards image uploads and requests to the ML service.
 *
 * POST /api/breed/detect   → ML service POST /api/breed/detect
 * GET  /api/breed/status   → ML service GET  /api/breed/status
 * GET  /api/breed/list     → ML service GET  /api/breed/list
 */
const express = require('express');
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const ML_URL = () => (process.env.ML_SERVICE_URL || 'http://localhost:8001').replace(/\/+$/, '');

// ── POST /api/breed/detect ────────────────────────────────────────────────────
router.post('/detect', upload.single('file'), async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, detail: 'No image file provided' });
        }

        // Forward as multipart/form-data to ML service
        const form = new FormData();
        form.append('file', req.file.buffer, {
            filename: req.file.originalname || 'upload.jpg',
            contentType: req.file.mimetype,
        });

        const mlRes = await axios.post(`${ML_URL()}/api/breed/detect`, form, {
            headers: form.getHeaders(),
            timeout: 30000,
        });

        res.json(mlRes.data);
    } catch (err) {
        if (err.response) return res.status(err.response.status).json(err.response.data);
        next(err);
    }
});

// ── GET /api/breed/status ──────────────────────────────────────────────────────
router.get('/status', async (req, res, next) => {
    try {
        const mlRes = await axios.get(`${ML_URL()}/api/breed/status`, { timeout: 5000 });
        res.json(mlRes.data);
    } catch (err) {
        // Return degraded status if ML service is down
        res.json({
            model_ready: false,
            model_version: 'demo-v1',
            num_breeds: 25,
            message: 'ML service unreachable — running in degraded mode',
        });
    }
});

// ── GET /api/breed/list ────────────────────────────────────────────────────────
router.get('/list', async (req, res, next) => {
    try {
        const mlRes = await axios.get(`${ML_URL()}/api/breed/list`, { timeout: 5000 });
        res.json(mlRes.data);
    } catch (err) {
        if (err.response) return res.status(err.response.status).json(err.response.data);
        next(err);
    }
});

module.exports = router;
