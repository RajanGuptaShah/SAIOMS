/**
 * SAIOMS — Input Validation Middleware
 * Uses express-validator to validate and sanitize inputs.
 */
const { body, param, validationResult } = require('express-validator');

/** Extract validation errors and respond with 400 */
function handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            detail: errors.array()[0].msg,
            errors: errors.array(),
        });
    }
    next();
}

/** Auth: Register */
const validateRegister = [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }).withMessage('Name too long'),
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('phone').trim().notEmpty().withMessage('Phone is required').matches(/^\+?[\d\s\-]{7,15}$/).withMessage('Invalid phone number'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    handleValidationErrors,
];

/** Auth: Login */
const validateLogin = [
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
    handleValidationErrors,
];

/** User: Update profile */
const validateProfileUpdate = [
    body('bio').optional().trim().isLength({ max: 300 }).withMessage('Bio must be under 300 characters'),
    body('location').optional().trim().isLength({ max: 100 }).withMessage('Location too long').escape(),
    body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
    handleValidationErrors,
];

/** Param: MongoDB ObjectId */
const validateObjectId = [
    param('id').isMongoId().withMessage('Invalid ID format'),
    handleValidationErrors,
];

module.exports = { validateRegister, validateLogin, validateProfileUpdate, validateObjectId, handleValidationErrors };
