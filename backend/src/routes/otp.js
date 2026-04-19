/**
 * SAIOMS — OTP Verification Routes v3 (Email based)
 *
 * POST /api/auth/send-otp    — Generate + send OTP via Email (SendGrid)
 * POST /api/auth/verify-otp  — Verify OTP (returns verification token)
 *
 * Email providers supported:
 *   1. SendGrid API   — SENDGRID_API_KEY + SENDGRID_FROM_EMAIL
 *   2. Console log    — dev fallback when not configured
 */
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { rateLimit } = require('express-rate-limit');
const sgMail = require('@sendgrid/mail');

const router = express.Router();

/* ── OTP Schema (TTL auto-cleanup) ──────────────────────────────────────── */
const OtpSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    otpHash: { type: String, required: true }, 
    token: { type: String, default: null },
    attempts: { type: Number, default: 0 },
    verified: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true },
    sentAt: { type: Date, default: Date.now },
});
OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const OtpDoc = mongoose.models.OtpDoc || mongoose.model('OtpDoc', OtpSchema);

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function generateOTP() {
    return String(crypto.randomInt(100000, 999999));
}

function isConfigured(val) {
    if (!val || typeof val !== 'string') return false;
    const lower = val.toLowerCase().trim();
    return lower.length > 0 &&
        !lower.includes('your-') &&
        !lower.includes('placeholder') &&
        lower !== 'undefined' &&
        lower !== 'null';
}

/* ── Send OTP via SendGrid ───────────────────────────────────────────────── */
async function sendEmailOtp(email, otpStr) {
    const isSendgridConfigured = isConfigured(process.env.SENDGRID_API_KEY) && isConfigured(process.env.SENDGRID_FROM_EMAIL);

    if (!isSendgridConfigured) {
        // Dev fallback
        console.log(`\n=========================================`);
        console.log(`📱 OTP EMAIL (DEV MODE)`);
        console.log(`To: ${email}`);
        console.log(`Code: ${otpStr}`);
        console.log(`=========================================\n`);
        return { mode: 'console', status: 'delivered_to_console' };
    }

    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    
    const msg = {
        to: email,
        from: process.env.SENDGRID_FROM_EMAIL,
        subject: 'Your SAIOMS Verification Code',
        text: `Your SAIOMS verification code is ${otpStr}. It is valid for 10 minutes.`,
        html: `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaec; border-radius: 8px;">
                <h2 style="color: #1B4332;">Verify Your Email</h2>
                <p>Use the following 6-digit code to verify your email address:</p>
                <div style="background: #f4f4f5; font-size: 24px; font-weight: bold; letter-spacing: 4px; text-align: center; padding: 15px; border-radius: 6px; margin: 20px 0;">
                    ${otpStr}
                </div>
                <p style="color: #666; font-size: 13px;">This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
            </div>
        `,
    };

    try {
        await sgMail.send(msg);
        console.log(`[OTP] ✅ SendGrid Email sent to ${email}`);
        return { mode: 'sendgrid', status: 'sent' };
    } catch (err) {
        console.error(`[OTP] SendGrid failed: ${err.message}`);
        if (err.response) {
            console.error(err.response.body);
        }
        throw new Error(`SendGrid Error: Failed to send email.`);
    }
}

/* ── Rate limiter (permissive for dev, stricter for prod) ────────────────── */
const otpLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 5 : 30,
    message: { success: false, detail: 'Too many OTP requests. Please wait and try again.' },
    standardHeaders: true, legacyHeaders: false,
    skip: (req) => process.env.NODE_ENV !== 'production',
});

/* ── POST /api/auth/send-otp ─────────────────────────────────────────────── */
router.post('/send-otp', otpLimiter, async (req, res) => {
    try {
        const { email } = req.body;
        if (!email?.trim()) return res.status(400).json({ success: false, detail: 'Email address is required.' });
        const cleanEmail = email.trim().toLowerCase();

        // Check if already registered
        const User = require('../models/User');
        const existing = await User.findOne({ email: cleanEmail });
        if (existing) return res.status(409).json({ success: false, detail: 'Email already registered. Please sign in.' });

        const otpStr = generateOTP();
        const salt = await bcrypt.genSalt(10);
        const otpHash = await bcrypt.hash(otpStr, salt);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins validity

        await OtpDoc.findOneAndUpdate(
            { email: cleanEmail },
            { otpHash, attempts: 0, verified: false, expiresAt, sentAt: new Date() },
            { upsert: true, new: true }
        );

        const result = await sendEmailOtp(cleanEmail, otpStr);

        res.json({
            success: true,
            mode: result.mode,
            detail: `✅ OTP sent via Email to ${cleanEmail}. Please check your Inbox and Spam folder. (Delivery may take up to a minute)`,
        });

    } catch (err) {
        console.error('[OTP/send-otp]', err);
        res.status(500).json({ success: false, detail: err.message || 'Failed to send OTP. Please try again.' });
    }
});

/* ── POST /api/auth/verify-otp ───────────────────────────────────────────── */
router.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) return res.status(400).json({ success: false, detail: 'Email and OTP are required.' });
        const cleanEmail = email.trim().toLowerCase();

        const doc = await OtpDoc.findOne({ email: cleanEmail });
        if (!doc) return res.status(400).json({ success: false, detail: 'Please request an OTP first.' });
        
        if (doc.attempts >= 5) {
            await OtpDoc.deleteOne({ _id: doc._id });
            return res.status(429).json({ success: false, detail: 'Too many failed attempts. Request a new OTP.' });
        }
        
        if (new Date() > doc.expiresAt) {
            await OtpDoc.deleteOne({ _id: doc._id });
            return res.status(400).json({ success: false, detail: 'OTP has expired. Please request a new one.' });
        }

        const isMatch = await bcrypt.compare(String(otp).trim(), doc.otpHash);

        if (!isMatch) {
            doc.attempts += 1;
            await doc.save();
            const left = 5 - doc.attempts;
            return res.status(400).json({
                success: false,
                detail: `Incorrect OTP. ${left} attempt${left !== 1 ? 's' : ''} remaining.`,
            });
        }

        // Issue 15-min verification token for signup
        const token = crypto.randomBytes(32).toString('hex');
        doc.token = token;
        doc.verified = true;
        
        // Remove the otpHash mechanics since it's verified
        doc.otpHash = 'VERIFIED';
        // Keep document alive for 15 mins to allow signup to complete
        doc.expiresAt = new Date(Date.now() + 15 * 60 * 1000); 
        await doc.save();

        res.json({ success: true, token, detail: 'Email verified! Complete your registration.' });

    } catch (err) {
        console.error('[OTP/verify-otp]', err);
        res.status(500).json({ success: false, detail: 'Verification failed. Please try again.' });
    }
});

module.exports = { router };
