/**
 * SAIOMS — Global Error Handler
 * Express error-handling middleware (4 args).
 * Logs errors to console (structured) and returns a clean JSON response.
 */

/** @type {import('express').ErrorRequestHandler} */
function errorHandler(err, req, res, next) {     // eslint-disable-line no-unused-vars
    const status = err.status || err.statusCode || 500;
    const isDev = process.env.NODE_ENV !== 'production';

    console.error('[Error]', {
        status,
        method: req.method,
        url: req.originalUrl,
        message: err.message,
        ...(isDev ? { stack: err.stack } : {}),
    });

    // Mongoose validation
    if (err.name === 'ValidationError') {
        const details = Object.values(err.errors).map(e => e.message).join('; ');
        return res.status(400).json({ success: false, detail: details });
    }
    // Mongoose bad cast
    if (err.name === 'CastError') {
        return res.status(400).json({ success: false, detail: 'Invalid ID format.' });
    }
    // MongoDB duplicate key
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue || {})[0] || 'field';
        return res.status(409).json({ success: false, detail: `An account with this ${field} already exists.` });
    }
    // JWT
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, detail: 'Invalid or expired token. Please log in again.' });
    }
    // Multer
    if (err.name === 'MulterError') {
        let msg = 'File upload error.';
        if (err.code === 'LIMIT_FILE_SIZE') msg = 'File too large. Maximum size is 5 MB.';
        if (err.code === 'LIMIT_UNEXPECTED_FILE') msg = 'Unexpected file field.';
        return res.status(400).json({ success: false, detail: msg });
    }
    if (err.message?.includes('Only JPEG')) {
        return res.status(400).json({ success: false, detail: err.message });
    }
    // Generic
    res.status(status).json({
        success: false,
        detail: isDev ? err.message : 'Something went wrong. Please try again.',
    });
}

module.exports = errorHandler;
