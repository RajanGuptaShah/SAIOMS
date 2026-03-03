/**
 * SAIOMS — File Upload Service
 * Multer + Sharp pipeline: accepts images, resizes & converts to WebP.
 */
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const AVATARS_DIR = path.join(__dirname, '..', '..', 'static', 'avatars');
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// Ensure directory exists
fs.mkdirSync(AVATARS_DIR, { recursive: true });

// Memory storage — we process with sharp before writing to disk
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only JPEG, PNG, WebP, or GIF images are accepted'), false);
    }
};

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_SIZE_BYTES } });

/**
 * Process and save an avatar image.
 * Resizes to 400×400, converts to WebP with quality 85.
 * @param {Buffer} buffer  Raw image buffer from multer
 * @param {string} userId  User ID used as filename
 * @returns {string} Public URL path like /static/avatars/{userId}.webp
 */
async function saveAvatar(buffer, userId) {
    const filename = `${userId}.webp`;
    const outputPath = path.join(AVATARS_DIR, filename);
    await sharp(buffer)
        .resize(400, 400, { fit: 'cover', position: 'attention' })
        .webp({ quality: 85 })
        .toFile(outputPath);
    return `/static/avatars/${filename}`;
}

/**
 * Delete an existing avatar file (best-effort).
 * @param {string} userId
 */
function deleteAvatar(userId) {
    const filePath = path.join(AVATARS_DIR, `${userId}.webp`);
    try { fs.unlinkSync(filePath); } catch (_) { }
}

module.exports = { upload, saveAvatar, deleteAvatar };
