/**
 * SAIOMS — Rate Limiters
 * Tiered rate limiting for API, auth, and upload endpoints.
 */
const rateLimit = require('express-rate-limit');

const handler = (req, res) => {
    res.status(429).json({
        success: false,
        detail: 'Too many requests — please slow down and try again later.',
    });
};

/** General API limiter: 100 requests per 15 minutes */
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    handler,
});

/** Auth limiter: 15 attempts per 15 minutes (login/register) */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    handler,
});

/** Upload limiter: 30 uploads per hour */
const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    handler,
});

/** Nearby search limiter: 30 requests per 5 minutes (geocoding APIs are sensitive) */
const nearbyLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    handler,
});

module.exports = { apiLimiter, authLimiter, uploadLimiter, nearbyLimiter };
