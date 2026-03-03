/**
 * SAIOMS — Users Router (Social Profile System)
 *
 * GET    /api/users/:id              Public profile
 * GET    /api/users/:id/animals      User's registered animals (paginated)
 * POST   /api/users/:id/follow       Follow a user
 * DELETE /api/users/:id/follow       Unfollow a user
 * PUT    /api/users/me/profile       Update own profile
 * POST   /api/users/me/avatar        Upload/update profile photo
 */
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const User = require('../models/User');
const Animal = require('../models/Animal');
const { protect } = require('../middleware/authMiddleware');
const { validateProfileUpdate, handleValidationErrors } = require('../middleware/validate');
const { upload, saveAvatar } = require('../services/upload');
const { uploadLimiter } = require('../middleware/rateLimiter');
const { param } = require('express-validator');

// ── Helper ────────────────────────────────────────────────────────────────────
function isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id);
}

// ── GET /api/users/:id — Public profile ──────────────────────────────────────
router.get('/:id', async (req, res, next) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, detail: 'Invalid user ID' });
        }
        const user = await User.findById(req.params.id).select('-password -__v');
        if (!user) return res.status(404).json({ success: false, detail: 'User not found' });
        if (!user.isPublic) {
            return res.json({ success: true, user: { _id: user._id, name: user.name, isPublic: false } });
        }

        const animalsCount = await Animal.countDocuments({ owner_user_id: user._id });

        res.json({
            success: true,
            user: {
                ...user.toPublicJSON(),
                animalsCount,
            },
        });
    } catch (err) { next(err); }
});

// ── GET /api/users/:id/animals — User's animals ────────────────────────────
router.get('/:id/animals', async (req, res, next) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, detail: 'Invalid user ID' });
        }
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(20, parseInt(req.query.limit) || 12);
        const skip = (page - 1) * limit;

        const user = await User.findById(req.params.id).select('isPublic name');
        if (!user) return res.status(404).json({ success: false, detail: 'User not found' });
        if (!user.isPublic) return res.json({ success: true, animals: [], total: 0 });

        const [animals, total] = await Promise.all([
            Animal.find({ owner_user_id: req.params.id })
                .select('animal_id species breed gender health_status registered_at qr_path city state district')
                .sort({ registered_at: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Animal.countDocuments({ owner_user_id: req.params.id }),
        ]);

        res.json({ success: true, animals, total, page, pages: Math.ceil(total / limit) });
    } catch (err) { next(err); }
});

// ── POST /api/users/:id/follow — Follow ───────────────────────────────────────
router.post('/:id/follow', protect, async (req, res, next) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, detail: 'Invalid user ID' });
        }
        const targetId = req.params.id;
        const myId = req.user._id.toString();

        if (targetId === myId) {
            return res.status(400).json({ success: false, detail: 'You cannot follow yourself' });
        }

        const target = await User.findById(targetId);
        if (!target) return res.status(404).json({ success: false, detail: 'User not found' });

        // Idempotent add
        await User.findByIdAndUpdate(targetId, { $addToSet: { followers: myId } });
        await User.findByIdAndUpdate(myId, { $addToSet: { following: targetId } });

        res.json({ success: true, message: `Now following ${target.name}` });
    } catch (err) { next(err); }
});

// ── DELETE /api/users/:id/follow — Unfollow ──────────────────────────────────
router.delete('/:id/follow', protect, async (req, res, next) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, detail: 'Invalid user ID' });
        }
        const targetId = req.params.id;
        const myId = req.user._id.toString();

        await User.findByIdAndUpdate(targetId, { $pull: { followers: myId } });
        await User.findByIdAndUpdate(myId, { $pull: { following: targetId } });

        res.json({ success: true, message: 'Unfollowed successfully' });
    } catch (err) { next(err); }
});

// ── PUT /api/users/me/profile — Update own profile ───────────────────────────
router.put('/me/profile', protect, validateProfileUpdate, async (req, res, next) => {
    try {
        const { name, bio, location, isPublic } = req.body;
        const updates = {};
        if (name !== undefined) updates.name = name.trim();
        if (bio !== undefined) updates.bio = bio.trim();
        if (location !== undefined) updates.location = location.trim();
        if (isPublic !== undefined) updates.isPublic = Boolean(isPublic);

        const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select('-password -__v');
        res.json({ success: true, user });
    } catch (err) { next(err); }
});

// ── POST /api/users/me/avatar — Upload profile photo ─────────────────────────
router.post('/me/avatar', protect, uploadLimiter, upload.single('avatar'), async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, detail: 'No image file provided' });
        const url = await saveAvatar(req.file.buffer, req.user._id.toString());
        await User.findByIdAndUpdate(req.user._id, { profilePhoto: url });
        res.json({ success: true, profilePhoto: url });
    } catch (err) { next(err); }
});

// ── GET /api/users — Search users (admin or public) ───────────────────────────
router.get('/', async (req, res, next) => {
    try {
        const q = (req.query.q || '').trim();
        const limit = Math.min(20, parseInt(req.query.limit) || 10);
        const filter = { isPublic: true };
        if (q) filter.$text = { $search: q };
        const users = await User.find(filter)
            .select('name bio location profilePhoto role followers following')
            .limit(limit)
            .lean();
        res.json({
            success: true,
            users: users.map(u => ({
                _id: u._id,
                name: u.name,
                bio: u.bio,
                location: u.location,
                profilePhoto: u.profilePhoto,
                role: u.role,
                followersCount: u.followers?.length || 0,
            })),
        });
    } catch (err) { next(err); }
});

module.exports = router;
