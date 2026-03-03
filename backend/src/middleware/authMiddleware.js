/**
 * SAIOMS — JWT Authentication Middleware
 */
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'saioms-super-secret-jwt-key-change-in-prod';

/**
 * protect — requires valid JWT
 * Attaches req.user with full user document (no password)
 */
async function protect(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, detail: 'Not authorised — no token' });
    }
    try {
        const token = header.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');
        if (!user) return res.status(401).json({ success: false, detail: 'User no longer exists' });
        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, detail: 'Invalid or expired token' });
    }
}

/**
 * optionalAuth — does NOT fail if no token; attaches req.user if valid token present
 */
async function optionalAuth(req, res, next) {
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
        try {
            const token = header.split(' ')[1];
            const decoded = jwt.verify(token, JWT_SECRET);
            const user = await User.findById(decoded.id).select('-password');
            if (user) req.user = user;
        } catch (_) { /* ignore */ }
    }
    next();
}

module.exports = { protect, optionalAuth };
