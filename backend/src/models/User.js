/**
 * SAIOMS — User Mongoose Schema (v2)
 * Extended with social profile fields: bio, location, profilePhoto,
 * followers/following, privacy settings.
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Schema } = mongoose;

const UserSchema = new Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    phone: { type: String, required: true, unique: true, trim: true, index: true },
    password: { type: String, required: true, minlength: 8 },
    role: { type: String, enum: ['farmer', 'vet', 'admin'], default: 'farmer' },

    // ── Social Profile ───────────────────────────────────────────────────────
    bio: { type: String, maxlength: 300, default: '' },
    location: { type: String, maxlength: 100, default: '' },
    profilePhoto: { type: String, default: '' },  // /static/avatars/{userId}.webp
    isPublic: { type: Boolean, default: true },

    // Follow system — store just IDs; counts derived at query time
    followers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    following: [{ type: Schema.Types.ObjectId, ref: 'User' }],
}, {
    timestamps: true,
});

// ── Indexes ───────────────────────────────────────────────────────────────────
UserSchema.index({ name: 'text' });

// ── Hash password before save ──────────────────────────────────────────────────
UserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// ── Instance methods ──────────────────────────────────────────────────────────
UserSchema.methods.comparePassword = function (plain) {
    return bcrypt.compare(plain, this.password);
};

/** Public profile — safe to expose via API */
UserSchema.methods.toPublicJSON = function () {
    return {
        _id: this._id,
        name: this.name,
        location: this.location,
        bio: this.bio,
        profilePhoto: this.profilePhoto,
        role: this.role,
        isPublic: this.isPublic,
        followersCount: this.followers.length,
        followingCount: this.following.length,
        joinedAt: this.createdAt,
    };
};

// Strip sensitive fields from default JSON output
UserSchema.set('toJSON', {
    transform: (doc, ret) => {
        delete ret.password;
        delete ret.__v;
        return ret;
    },
});

module.exports = mongoose.model('User', UserSchema);
