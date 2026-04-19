/**
 * SAIOMS — Auth Routes v2
 *
 * POST  /api/auth/register   Create account (with optional avatar upload)
 * POST  /api/auth/login      Login + JWT
 * GET   /api/auth/me         Current user
 * PUT   /api/auth/password   Change password
 */
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
const { validateRegister, validateLogin } = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimiter');
const { upload, saveAvatar } = require('../services/upload');

const router = express.Router();

function signToken(userId) {
    const secret = process.env.JWT_SECRET;
    const expires = process.env.JWT_EXPIRES_IN || '7d';
    return jwt.sign({ id: userId }, secret, { expiresIn: expires });
}

// ── POST /api/auth/register ───────────────────────────────────────────────────
/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Create a new user account
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [name, email, phone, password]
 *             properties:
 *               name:     { type: string }
 *               email:    { type: string, format: email }
 *               phone:    { type: string }
 *               password: { type: string, minLength: 8 }
 *               bio:      { type: string }
 *               location: { type: string }
 *               avatar:   { type: string, format: binary }
 *     responses:
 *       201: { description: Account created }
 *       409: { description: Email already exists }
 */
router.post('/register', authLimiter, upload.single('avatar'), validateRegister, async (req, res, next) => {
    try {
        const { name, email, phone, countryCode, password, bio, location, role, otpToken } = req.body;

        const phoneWithCode = countryCode ? `${countryCode}${phone.replace(/^\+/, '').replace(/^0/, '')}` : phone;

        // ── Require OTP verification token ──────────────────────────────────
        if (!otpToken) {
            return res.status(400).json({ success: false, detail: 'Email OTP verification is required before creating an account.' });
        }
        const mongoose = require('mongoose');
        const OtpDoc = mongoose.models.OtpDoc;
        if (OtpDoc) {
            const otpDoc = await OtpDoc.findOne({ email: email.toLowerCase().trim(), verified: true, token: otpToken });
            if (!otpDoc || otpDoc.expiresAt < new Date()) {
                return res.status(401).json({ success: false, detail: 'OTP verification expired or invalid. Please verify your email again.' });
            }
        }

        const existing = await User.findOne({ email: email.toLowerCase().trim() });
        if (existing) return res.status(409).json({ success: false, detail: 'An account with this email already exists.' });

        const existingPhone = await User.findOne({ phone: phoneWithCode.trim() });
        if (existingPhone) return res.status(409).json({ success: false, detail: 'An account with this phone number already exists.' });

        const user = await User.create({ name, email, phone: phoneWithCode, password, bio: bio || '', location: location || '', role });

        if (req.file) {
            try { const photoUrl = await saveAvatar(req.file.buffer, user._id.toString()); user.profilePhoto = photoUrl; await user.save(); } catch (_) { }
        }

        // Clean up OTP doc
        if (OtpDoc) await OtpDoc.deleteOne({ email: email.toLowerCase().trim() });

        const token = signToken(user._id);
        res.status(201).json({ success: true, message: 'Account created successfully', token, user: user.toJSON() });
    } catch (err) { next(err); }
});


// ── POST /api/auth/login ──────────────────────────────────────────────────────
/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login and receive JWT
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:    { type: string }
 *               password: { type: string }
 *     responses:
 *       200: { description: Login successful }
 *       401: { description: Invalid credentials }
 */
router.post('/login', authLimiter, validateLogin, async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) {
            return res.status(401).json({ success: false, detail: 'Invalid email or password.' });
        }
        const match = await user.comparePassword(password);
        if (!match) {
            return res.status(401).json({ success: false, detail: 'Invalid email or password.' });
        }
        const token = signToken(user._id);
        res.json({ success: true, message: 'Logged in successfully', token, user: user.toJSON() });
    } catch (err) { next(err); }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get current authenticated user
 *     responses:
 *       200: { description: Current user }
 *       401: { description: Not authenticated }
 */
router.get('/me', protect, async (req, res) => {
    res.json({ success: true, user: req.user.toJSON() });
});

// ── PUT /api/auth/password — Change password ──────────────────────────────────
router.put('/password', protect, async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, detail: 'Both currentPassword and newPassword are required.' });
        }
        if (newPassword.length < 8) {
            return res.status(400).json({ success: false, detail: 'New password must be at least 8 characters.' });
        }
        const user = await User.findById(req.user._id);
        const match = await user.comparePassword(currentPassword);
        if (!match) {
            return res.status(401).json({ success: false, detail: 'Current password is incorrect.' });
        }
        user.password = newPassword;
        await user.save();
        res.json({ success: true, message: 'Password updated successfully.' });
    } catch (err) { next(err); }
});

module.exports = router;
