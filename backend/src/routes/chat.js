/**
 * SAIOMS — Chat Router
 * Real-time chat between users via simple polling (no external service needed)
 *
 * POST /api/chat/send          — Send a message
 * GET  /api/chat/messages      — Get messages for a room
 * GET  /api/chat/rooms         — List chat rooms for the user
 * POST /api/chat/room          — Create or get a chat room
 * POST /api/chat/post          — Create a community post
 * GET  /api/chat/posts         — Get recent community posts
 * GET  /api/chat/users         — List all users for starting DMs
 */
const express = require('express');
const mongoose = require('mongoose');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

/* ── Schemas ── */
const MessageSchema = new mongoose.Schema({
    room: { type: String, required: true, index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    senderName: String,
    text: String,
    image: String,         // base64 data URL for image messages
    type: { type: String, enum: ['text', 'image', 'post'], default: 'text' },
    createdAt: { type: Date, default: Date.now, index: true },
});

const RoomSchema = new mongoose.Schema({
    roomId: { type: String, unique: true, required: true },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    participantNames: [String],
    lastMessage: String,
    lastMessageAt: { type: Date, default: Date.now },
    isGlobal: { type: Boolean, default: false },
});

/* ── Community Post Schema ── */
const PostSchema = new mongoose.Schema({
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    authorName: { type: String, required: true },
    text: { type: String, required: true, maxlength: 1000 },
    likes: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now, index: true },
});

const Message = mongoose.models.Message || mongoose.model('Message', MessageSchema);
const Room = mongoose.models.Room || mongoose.model('Room', RoomSchema);
const Post = mongoose.models.CommunityPost || mongoose.model('CommunityPost', PostSchema);

/* ── Create/join room ── */
router.post('/room', protect, async (req, res, next) => {
    try {
        const { targetUserId, isGlobal } = req.body;

        if (isGlobal) {
            let room = await Room.findOne({ isGlobal: true });
            if (!room) {
                room = await Room.create({
                    roomId: 'global-community',
                    participants: [req.user._id],
                    participantNames: [req.user.name],
                    isGlobal: true,
                    lastMessage: 'Community chat created',
                });
            }
            if (!room.participants.some(p => p.toString() === req.user._id.toString())) {
                room.participants.push(req.user._id);
                room.participantNames.push(req.user.name);
                await room.save();
            }
            return res.json({ success: true, room });
        }

        if (!targetUserId) return res.status(400).json({ success: false, detail: 'targetUserId required' });

        const User = require('../models/User');
        const target = await User.findById(targetUserId);
        if (!target) return res.status(404).json({ success: false, detail: 'User not found' });

        const ids = [req.user._id.toString(), targetUserId].sort();
        const roomId = `dm-${ids[0]}-${ids[1]}`;

        let room = await Room.findOne({ roomId });
        if (!room) {
            room = await Room.create({
                roomId,
                participants: [req.user._id, target._id],
                participantNames: [req.user.name, target.name],
                lastMessage: 'Chat started',
            });
        }
        res.json({ success: true, room });
    } catch (err) { next(err); }
});

/* ── List rooms ── */
router.get('/rooms', protect, async (req, res, next) => {
    try {
        const rooms = await Room.find({
            $or: [
                { participants: req.user._id },
                { isGlobal: true },
            ]
        }).sort({ lastMessageAt: -1 }).lean();

        res.json({ success: true, rooms });
    } catch (err) { next(err); }
});

/* ── Send message ── */
router.post('/send', protect, async (req, res, next) => {
    try {
        const { room, text, image } = req.body;
        if (!room) return res.status(400).json({ success: false, detail: 'room is required' });
        if (!text && !image) return res.status(400).json({ success: false, detail: 'text or image is required' });

        const type = image ? 'image' : 'text';
        const msg = await Message.create({
            room,
            sender: req.user._id,
            senderName: req.user.name,
            text: text || '',
            image: image || '',
            type,
        });

        // Update room's last message
        await Room.findOneAndUpdate({ roomId: room }, {
            lastMessage: type === 'image' ? '📷 Image' : (text || '').slice(0, 100),
            lastMessageAt: new Date(),
        });

        res.json({ success: true, message: msg });
    } catch (err) { next(err); }
});

/* ── Get messages (polling) ── */
router.get('/messages', protect, async (req, res, next) => {
    try {
        const { room, after } = req.query;
        if (!room) return res.status(400).json({ success: false, detail: 'room is required' });

        const filter = { room };
        if (after) filter.createdAt = { $gt: new Date(after) };

        const messages = await Message.find(filter)
            .sort({ createdAt: 1 })
            .limit(100)
            .lean();

        res.json({ success: true, messages });
    } catch (err) { next(err); }
});

/* ── List users (searchable) ── */
router.get('/users', protect, async (req, res, next) => {
    try {
        const User = require('../models/User');
        const { search } = req.query;
        const query = { _id: { $ne: req.user._id } };
        if (search && search.trim()) {
            const s = search.trim();
            query.$or = [
                { name: { $regex: s, $options: 'i' } },
                { email: { $regex: s, $options: 'i' } },
            ];
        }
        const users = await User.find(query)
            .select('name email')
            .limit(50)
            .lean();
        res.json({ success: true, users: users.map(u => ({ id: u._id, name: u.name, email: u.email })) });
    } catch (err) { next(err); }
});

/* ── Create community post ── */
router.post('/post', protect, async (req, res, next) => {
    try {
        const { text } = req.body;
        if (!text || !text.trim()) return res.status(400).json({ success: false, detail: 'text is required' });

        const post = await Post.create({
            author: req.user._id,
            authorName: req.user.name,
            text: text.trim().slice(0, 1000),
        });

        res.json({ success: true, post });
    } catch (err) { next(err); }
});

/* ── Get community posts ── */
router.get('/posts', protect, async (req, res, next) => {
    try {
        const { after } = req.query;
        const filter = {};
        if (after) filter.createdAt = { $gt: new Date(after) };

        const posts = await Post.find(filter)
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        res.json({ success: true, posts });
    } catch (err) { next(err); }
});

module.exports = router;
