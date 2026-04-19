/**
 * SAIOMS — Animals Router (Express)
 *
 * POST   /api/animals/register            Register new animal + generate QR (auth required)
 * GET    /api/animals                     List MY animals (auth required)
 * GET    /api/animals/qr/:qr_id           Download QR image (proxy to ML service)
 * GET    /api/animals/by-qr/:qr_id        Full animal profile lookup by QR ID (public)
 * GET    /api/animals/:animal_id          Get single animal (public)
 * POST   /api/animals/decode-qr           Decode/verify a scanned QR string (public)
 * POST   /api/animals/:id/regenerate-qr   Regenerate QR for existing animal (auth required)
 * POST   /api/animals/transfer            Ownership transfer (auth required)
 * PUT    /api/animals/:animal_id/health   Update health / vaccination record (auth required)
 */
const express = require('express');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const Animal = require('../models/Animal');
const { protect, optionalAuth } = require('../middleware/authMiddleware');
const router = express.Router();

const ML_URL = () => process.env.ML_SERVICE_URL || 'http://localhost:8001';

// Local QR static dir (backend serves this when ML service is unavailable)
const QR_STATIC_DIR = path.join(__dirname, '..', '..', 'static', 'qrcodes');
if (!fs.existsSync(QR_STATIC_DIR)) {
    fs.mkdirSync(QR_STATIC_DIR, { recursive: true });
}

/**
 * Native Node.js Fernet decryptor (AES-128-CBC + HMAC-SHA256).
 * Matches the Python cryptography.fernet.Fernet implementation used by the ML service.
 * Used as a LOCAL fallback so scanning works even when the ML service is down.
 */
function fernetDecryptLocal(encodedStr) {
    try {
        const secret = process.env.QR_SECRET || 'saioms-default-secret-change-in-production';
        const salt = Buffer.from(process.env.QR_SALT || 'saioms-salt-2024');

        // Derive 32-byte key using PBKDF2-HMAC-SHA256 (480000 iterations — matches Python)
        const derivedKey = crypto.pbkdf2Sync(secret, salt, 480000, 32, 'sha256');
        // Fernet key structure: first 16 bytes = HMAC signing key, last 16 bytes = AES-128 encryption key
        const hmacKey = derivedKey.slice(0, 16);
        const aesKey = derivedKey.slice(16, 32);

        // Fernet token: base64url(version[1] + timestamp[8] + iv[16] + ciphertext[n] + hmac[32])
        const tokenBuf = Buffer.from(encodedStr.replace(/_/g, '/').replace(/-/g, '+'), 'base64');
        if (tokenBuf[0] !== 0x80) throw new Error('Bad Fernet version');

        const iv = tokenBuf.slice(9, 25);
        const ciphertext = tokenBuf.slice(25, tokenBuf.length - 32);
        const hmacGiven = tokenBuf.slice(tokenBuf.length - 32);

        // Verify HMAC over everything except the last 32 bytes
        const hmacCalc = crypto.createHmac('sha256', hmacKey)
            .update(tokenBuf.slice(0, tokenBuf.length - 32))
            .digest();
        if (!crypto.timingSafeEqual(hmacCalc, hmacGiven)) throw new Error('HMAC mismatch — tampered QR');

        // Decrypt AES-128-CBC
        const decipher = crypto.createDecipheriv('aes-128-cbc', aesKey, iv);
        const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        return JSON.parse(decrypted.toString('utf8'));
    } catch (_) {
        return null; // Not a valid Fernet token — caller tries other formats
    }
}

/**
 * Generate QR locally using the `qrcode` npm package.
 * Returns { qr_id, qr_filename, qr_url }
 */
async function generateQRLocally(animalDoc) {
    const qr_id = uuidv4();
    const qr_filename = `${qr_id}.png`;
    const qr_path = path.join(QR_STATIC_DIR, qr_filename);

    // Encode ONLY the qr_id UUID (36 chars) for a simple, fast-scanning QR
    // All animal data is fetched from the DB at scan time using this ID
    await QRCode.toFile(qr_path, qr_id, {
        type: 'png',
        width: 500,                                // Large output (500×500px)
        margin: 4,                                 // 4-module quiet zone
        errorCorrectionLevel: 'M',                 // Medium EC — good balance
        color: { dark: '#000000', light: '#FFFFFF' }, // Pure black on white for max contrast
    });

    const port = process.env.PORT || 5000;
    const qr_url = `${process.env.BACKEND_PUBLIC_URL || `http://localhost:${port}`}/static/qrcodes/${qr_filename}`;
    return { qr_id, qr_filename, qr_url };
}


// ── ID generator ──────────────────────────────────────────────────────────────
function makeAnimalId(species, breed) {
    const prefix = (species || 'animal').toUpperCase().slice(0, 7);
    const tag = (breed || 'XXX').replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 3) || 'XXX';
    const suffix = uuidv4().replace(/-/g, '').slice(0, 4).toUpperCase();
    return `${prefix}-${tag}-${suffix}`;
}

// ── POST /api/animals/register ────────────────────────────────────────────────
router.post('/register', protect, async (req, res, next) => {
    try {
        const body = req.body;
        const animal_id = makeAnimalId(body.species, body.breed);

        // Build base doc — link to authenticated user
        const doc = {
            ...body,
            animal_id,
            qr_id: '',
            qr_path: '',
            owner_user_id: req.user._id,
        };

        // 1. Try ML service first
        let qr_id = '', qr_path = '', qr_url = '';
        try {
            const qrRes = await axios.post(`${ML_URL()}/api/qr/generate`, { animal_doc: doc }, { timeout: 4000 });
            qr_id = qrRes.data.qr_id;
            qr_path = qrRes.data.qr_filename;
            qr_url = qrRes.data.qr_url;
            console.log('[QR] Generated via ML service:', qr_id);
        } catch (qrErr) {
            // 2. Fallback: generate QR locally
            console.warn('[QR] ML service unavailable, generating locally:', qrErr.message);
            try {
                const local = await generateQRLocally(doc);
                qr_id = local.qr_id;
                qr_path = local.qr_filename;
                qr_url = local.qr_url;
                console.log('[QR] Generated locally:', qr_id);
            } catch (localErr) {
                console.error('[QR] Local generation also failed:', localErr.message);
                qr_id = uuidv4();
                qr_url = '';
            }
        }

        doc.qr_id = qr_id;
        doc.qr_path = qr_path;

        const animal = await Animal.create(doc);

        res.status(201).json({
            success: true,
            message: 'Animal registered successfully',
            animal_id,
            qr_id,
            qr_url,
            animal: animal.toJSON(),
        });
    } catch (err) {
        next(err);
    }
});

// ── GET /api/animals ──────────────────────────────────────────────────────────
// Returns only animals belonging to the authenticated user
router.get('/', protect, async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, parseInt(req.query.limit) || 20);
        const skip = (page - 1) * limit;

        // Base filter: this user's animals or animals they previously owned (transferred to someone else)
        const filter = {
            $or: [
                { owner_user_id: req.user._id },
                { 'transfer_history.from_user_id': req.user._id }
            ]
        };

        if (req.query.breed) filter.breed = { $regex: req.query.breed, $options: 'i' };
        if (req.query.species) filter.species = req.query.species;
        if (req.query.district) filter.district = { $regex: req.query.district, $options: 'i' };
        if (req.query.health_status) filter.health_status = req.query.health_status;

        const [total, animals] = await Promise.all([
            Animal.countDocuments(filter),
            Animal.find(filter).sort({ registered_at: -1 }).skip(skip).limit(limit).lean(),
        ]);

        const cleaned = animals.map(({ _id, __v, ...rest }) => rest);
        res.json({ total, page, limit, animals: cleaned });
    } catch (err) {
        next(err);
    }
});

// ── GET /api/animals/qr/:qr_id ────────────────────────────────────────────────────────────────────────────────
// Must be defined BEFORE /:animal_id to avoid route conflict
router.get('/qr/:qr_id', async (req, res, next) => {
    try {
        const animal = await Animal.findOne({ qr_id: req.params.qr_id }).lean();
        if (!animal || !animal.qr_path) {
            return res.status(404).json({ success: false, detail: 'QR not found' });
        }

        // Determine disposition: ?download=1 forces attachment, otherwise inline for <img> display
        const disposition = req.query.download === '1' ? 'attachment' : 'inline';
        const dispHeader = `${disposition}; filename="saioms-qr-${req.params.qr_id.slice(0, 8)}.png"`;

        // 1. Try local static file first
        const localPath = path.join(QR_STATIC_DIR, animal.qr_path);
        if (fs.existsSync(localPath)) {
            res.set('Content-Type', 'image/png');
            res.set('Content-Disposition', dispHeader);
            return res.sendFile(localPath);
        }

        // 2. Proxy image from ML service
        const imageUrl = `${ML_URL()}/static/qrcodes/${animal.qr_path}`;
        try {
            const imgRes = await axios.get(imageUrl, { responseType: 'stream', timeout: 4000 });
            res.set('Content-Type', 'image/png');
            res.set('Content-Disposition', dispHeader);
            imgRes.data.pipe(res);
        } catch {
            res.status(404).json({ success: false, detail: 'QR image not available' });
        }
    } catch (err) {
        next(err);
    }
});

// ── GET /api/animals/by-qr/:qr_id ────────────────────────────────────────────────────────────────────────────
// Public endpoint — full animal record looked up by QR ID (for scanner)
router.get('/by-qr/:qr_id', async (req, res, next) => {
    try {
        const id = req.params.qr_id;
        // Try qr_id first, then animal_id as fallback (for locally generated QRs)
        const animal = await Animal.findOne({ $or: [{ qr_id: id }, { animal_id: id }] }).lean();
        if (!animal) {
            return res.status(404).json({ success: false, detail: 'No animal found for this QR code' });
        }
        const { _id, __v, owner_user_id, ...rest } = animal;
        res.json({ success: true, animal: rest });
    } catch (err) {
        next(err);
    }
});

// ── GET /api/animals/lookup-user  ───────────────────────────────────────────────
// IMPORTANT: must be defined BEFORE /:animal_id to avoid route conflict
// Frontend uses this to preview the recipient before confirming transfer
router.get('/lookup-user', protect, async (req, res, next) => {
    try {
        const User = require('../models/User');
        const { email, phone } = req.query;
        if (!email && !phone) return res.status(400).json({ success: false, detail: 'Provide email or phone to look up recipient.' });

        // Build a flexible query — normalise email and phone before matching
        const query = [];
        if (email && email.trim()) query.push({ email: email.toLowerCase().trim() });
        if (phone && phone.trim()) {
            // Normalise phone: strip spaces, dashes, +91 prefix so 09508141514 matches 9508141514
            const normalised = phone.trim().replace(/[\s\-().]/g, '').replace(/^\+91/, '').replace(/^91(?=\d{10})/, '');
            query.push({ phone: normalised });
            if (normalised !== phone.trim()) query.push({ phone: phone.trim() }); // also try raw
        }
        if (!query.length) return res.status(400).json({ success: false, detail: 'No valid email or phone provided.' });

        const user = await User.findOne({ $or: query }).lean();
        if (!user) return res.status(404).json({
            success: false,
            detail: email
                ? `No SAIOMS account found for email "${email}". Ask the recipient to sign up first.`
                : `No SAIOMS account found with phone "${phone}". Ask the recipient to sign up first.`,
        });

        // Prevent self-transfer
        if (user._id.toString() === req.user._id.toString()) {
            return res.status(400).json({ success: false, detail: 'You cannot transfer an animal to yourself.' });
        }

        res.json({ success: true, user: { name: user.name, email: user.email, phone: user.phone, id: user._id } });
    } catch (err) { next(err); }
});

// ── GET /api/animals/:animal_id ───────────────────────────────────────────────
router.get('/:animal_id', async (req, res, next) => {
    try {
        const animal = await Animal.findOne({ animal_id: req.params.animal_id }).lean();
        if (!animal) {
            return res.status(404).json({ success: false, detail: `Animal '${req.params.animal_id}' not found` });
        }
        const { _id, __v, owner_user_id, ...rest } = animal;
        res.json(rest);
    } catch (err) {
        next(err);
    }
});

// ── POST /api/animals/decode-qr ───────────────────────────────────────────────
router.post('/decode-qr', async (req, res, next) => {
    try {
        const { payload, qr_id } = req.body;
        const rawPayload = (payload || qr_id || '').trim();
        if (!rawPayload) return res.status(400).json({ success: false, detail: 'No payload provided' });

        const findAnimal = async (qId, aId) => {
            const q = [];
            if (qId) q.push({ qr_id: qId });
            if (aId) q.push({ animal_id: aId });
            if (!q.length) return null;
            const doc = await Animal.findOne({ $or: q }).lean();
            if (!doc) return null;
            const { _id, __v, owner_user_id, ...rest } = doc;
            return rest;
        };

        // ── Strategy 1: Plain UUID — new simplified QR codes (fast path) ──────
        const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRe.test(rawPayload)) {
            const animal = await findAnimal(rawPayload, rawPayload);
            if (animal) return res.json({ success: true, animal });
        }

        // ── Strategy 2: Direct DB lookup by passed qr_id field ───────────────
        if (qr_id && qr_id !== rawPayload) {
            const animal = await findAnimal(qr_id, qr_id);
            if (animal) return res.json({ success: true, animal });
        }

        // ── Strategy 3: Local Fernet decrypt (NO ML service dependency) ───────
        // This handles the old dense encrypted QR codes generated by the ML service.
        const localDecrypted = fernetDecryptLocal(rawPayload);
        if (localDecrypted) {
            const animal = await findAnimal(localDecrypted.qr_id, localDecrypted.animal_id);
            if (animal) return res.json({ success: true, animal });
            // DB record missing — return the decrypted data directly
            return res.json({ success: true, animal: localDecrypted });
        }

        // ── Strategy 4: Plain JSON payload (old backend-generated QRs) ────────
        try {
            const parsed = JSON.parse(rawPayload);
            const qId = parsed.qr_id || parsed.qrId;
            const aId = parsed.animal_id || parsed.animalId;
            const animal = await findAnimal(qId, aId);
            if (animal) return res.json({ success: true, animal });
        } catch (_) { }

        // ── Strategy 5: Forward to ML service as last resort ─────────────────
        try {
            const mlRes = await axios.post(`${ML_URL()}/api/qr/decode`, { payload: rawPayload }, { timeout: 5000 });
            const data = mlRes.data?.data || mlRes.data;
            const animal = await findAnimal(data.qr_id, data.animal_id);
            if (animal) return res.json({ success: true, animal });
            if (data.animal_id) return res.json({ success: true, animal: data });
        } catch (_) { }

        return res.status(404).json({ success: false, detail: 'No animal found for this QR code. It may be invalid or not registered in SAIOMS.' });
    } catch (err) {
        next(err);
    }
});

// ── POST /api/animals/:animal_id/regenerate-qr ───────────────────────────────
// Regenerates a new simple QR for an existing animal (auth required)
// Used to upgrade old dense QR codes to the new simple UUID-only format
router.post('/:animal_id/regenerate-qr', protect, async (req, res, next) => {
    try {
        const animal = await Animal.findOne({ animal_id: req.params.animal_id });
        if (!animal) return res.status(404).json({ success: false, detail: 'Animal not found' });

        // Only owner can regenerate QR
        if (animal.owner_user_id && animal.owner_user_id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, detail: 'You do not own this animal' });
        }

        // Try ML service first, fall back to local generation
        let qr_id, qr_filename, qr_url;
        try {
            const qrRes = await axios.post(`${ML_URL()}/api/qr/generate`, { animal_doc: animal.toJSON() }, { timeout: 5000 });
            qr_id = qrRes.data.qr_id;
            qr_filename = qrRes.data.qr_filename;
            qr_url = qrRes.data.qr_url;
        } catch (_) {
            const local = await generateQRLocally(animal);
            qr_id = local.qr_id;
            qr_filename = local.qr_filename;
            qr_url = local.qr_url;
        }

        animal.qr_id = qr_id;
        animal.qr_path = qr_filename;
        await animal.save();

        res.json({ success: true, message: 'QR code regenerated successfully', qr_id, qr_url });
    } catch (err) { next(err); }
});



// ── POST /api/animals/transfer ────────────────────────────────────────────────
router.post('/transfer', protect, async (req, res, next) => {
    try {
        const User = require('../models/User');
        const { animal_id, new_owner_email, new_owner_phone, reason, new_city, new_state, new_district } = req.body;

        if (!animal_id) return res.status(400).json({ success: false, detail: 'animal_id is required' });
        if (!new_owner_email) return res.status(400).json({ success: false, detail: 'Recipient email is required' });

        // 1. Find the animal
        const animal = await Animal.findOne({ animal_id });
        if (!animal) return res.status(404).json({ success: false, detail: 'Animal not found' });

        // 2. Verify current ownership
        if (animal.owner_user_id && animal.owner_user_id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, detail: 'You do not own this animal' });
        }

        // 3. Look up the new owner by email OR phone — they MUST have a SAIOMS account
        const ownerQuery = [];
        if (new_owner_email) ownerQuery.push({ email: new_owner_email.toLowerCase().trim() });
        if (new_owner_phone) {
            const normPhone = new_owner_phone.trim().replace(/[\s\-().]/g, '').replace(/^\+91/, '').replace(/^91(?=\d{10})/, '');
            ownerQuery.push({ phone: normPhone });
            if (normPhone !== new_owner_phone.trim()) ownerQuery.push({ phone: new_owner_phone.trim() });
        }
        if (!ownerQuery.length) return res.status(400).json({ success: false, detail: 'Recipient email or phone is required.' });
        const newOwner = await User.findOne({ $or: ownerQuery });
        if (!newOwner) {
            return res.status(404).json({
                success: false,
                detail: new_owner_email
                    ? `No SAIOMS account found for email "${new_owner_email}". Recipient must sign up first.`
                    : `No SAIOMS account found with phone "${new_owner_phone}". Recipient must sign up first.`,
            });
        }
        if (newOwner._id.toString() === req.user._id.toString()) {
            return res.status(400).json({ success: false, detail: 'You cannot transfer an animal to yourself.' });
        }

        // 4. Build rich history entry (captures full sender snapshot)
        const historyEntry = {
            from_owner: animal.owner_name,
            from_user_id: animal.owner_user_id,
            from_email: animal.owner_email || req.user.email,
            from_phone: animal.owner_phone,
            from_city: animal.city,
            from_state: animal.state,
            to_owner: newOwner.name,
            to_user_id: newOwner._id,
            to_email: newOwner.email,
            to_phone: newOwner.phone,
            date: new Date().toISOString(),
            reason: reason || '',
        };

        // 5. Update animal fields — reassign to new owner account
        animal.owner_name = newOwner.name;
        animal.owner_phone = new_owner_phone || newOwner.phone;
        animal.owner_email = newOwner.email;
        animal.owner_user_id = newOwner._id;           // ← KEY: links to new owner's dashboard
        if (new_city) animal.city = new_city;
        if (new_district) animal.district = new_district;
        if (new_state) animal.state = new_state;
        // All other fields (vaccinations, health_status, notes, breed, dob etc.) remain unchanged
        animal.transfer_history.push(historyEntry);
        await animal.save();

        // 6. Regenerate QR with updated owner info
        let qr_id = animal.qr_id;
        try {
            const qrRes = await axios.post(`${ML_URL()}/api/qr/generate`, { animal_doc: animal.toJSON() }, { timeout: 5000 });
            animal.qr_id = qrRes.data.qr_id;
            animal.qr_path = qrRes.data.qr_filename;
            await animal.save();
            qr_id = animal.qr_id;
        } catch (qrErr) {
            try {
                const local = await generateQRLocally(animal);
                animal.qr_id = local.qr_id;
                animal.qr_path = local.qr_filename;
                await animal.save();
                qr_id = animal.qr_id;
            } catch { /* non-fatal */ }
        }

        res.json({
            success: true,
            message: `Animal successfully transferred to ${newOwner.name} (${newOwner.email})`,
            qr_id,
            new_owner: { name: newOwner.name, email: newOwner.email },
        });
    } catch (err) { next(err); }
});


// ── PUT /api/animals/:animal_id/health ────────────────────────────────────────
router.put('/:animal_id/health', protect, async (req, res, next) => {
    try {
        const animal = await Animal.findOne({ animal_id: req.params.animal_id });
        if (!animal) return res.status(404).json({ success: false, detail: 'Animal not found' });

        // Only owner can update health
        if (animal.owner_user_id && animal.owner_user_id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, detail: 'You do not own this animal' });
        }

        const body = req.body;
        if (body.health_status) animal.health_status = body.health_status;
        if (body.last_vet_visit) animal.last_vet_visit = body.last_vet_visit;
        if (body.notes) animal.notes = body.notes;
        if (body.vaccination) animal.vaccinations.push(body.vaccination);

        await animal.save();
        res.json({ success: true, message: 'Health record updated' });
    } catch (err) {
        next(err);
    }
});

// ── DELETE /api/animals/:animal_id ───────────────────────────────────────────
router.delete('/:animal_id', protect, async (req, res, next) => {
    try {
        const animal = await Animal.findOne({ animal_id: req.params.animal_id });
        if (!animal) return res.status(404).json({ success: false, detail: 'Animal not found' });

        // Only owner can delete
        if (animal.owner_user_id && animal.owner_user_id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, detail: 'You do not own this animal' });
        }

        await Animal.deleteOne({ animal_id: req.params.animal_id });
        res.json({ success: true, message: `Animal ${req.params.animal_id} deleted` });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
