/**
 * SAIOMS — Social Profile API helpers
 * Added to existing api.js
 */
import axios from 'axios'

const envUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'https://saioms-backend.onrender.com'
const BASE = envUrl.replace(/\/api\/?$/, '')

const api = axios.create({
    baseURL: BASE,
    timeout: 30000,
    headers: { 'Content-Type': 'application/json' },
})

// Inject JWT token from localStorage into every request
api.interceptors.request.use(config => {
    const token = localStorage.getItem('saioms_token')
    if (token) config.headers['Authorization'] = `Bearer ${token}`
    return config
})

/* ── Animals ─────────────────────────────────────────── */
export const listAnimals = (params = {}) =>
    api.get('/api/animals', { params }).then(r => r.data)

export const getAnimal = (id) =>
    api.get(`/api/animals/${id}`).then(r => r.data)

export const registerAnimal = (body) =>
    api.post('/api/animals/register', body).then(r => r.data)

export const updateHealth = (id, body) =>
    api.put(`/api/animals/${id}/health`, body).then(r => r.data)

export const transferOwnership = (body) =>
    api.post('/api/animals/transfer', body).then(r => r.data)

export const lookupTransferUser = (email, phone) =>
    api.get('/api/animals/lookup-user', { params: { email, phone } }).then(r => r.data)

export const deleteAnimal = (id) =>
    api.delete(`/api/animals/${id}`).then(r => r.data)

export const regenerateQR = (animal_id) =>
    api.post(`/api/animals/${animal_id}/regenerate-qr`).then(r => r.data)

export const searchByTag = (tag) =>
    api.get(`/api/animals/${encodeURIComponent(tag.trim())}`).then(r => r.data)

/* ── QR ──────────────────────────────────────────────── */
export const qrImageUrl = (qrId) =>
    `${BASE}/api/animals/qr/${qrId}`

export const qrDownloadUrl = (qrId) =>
    `${BASE}/api/animals/qr/${qrId}?download=1`

export const decodeQR = (body) =>
    api.post('/api/animals/decode-qr', body).then(r => r.data)

/* ── Breed Detection ─────────────────────────────────── */
export const detectBreed = async (file) => {
    const form = new FormData()
    form.append('file', file)
    const r = await api.post('/api/breed/detect', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
    })
    return r.data
}

export const getBreedStatus = () =>
    api.get('/api/breed/status').then(r => r.data)

export const getBreedList = () =>
    api.get('/api/breed/list').then(r => r.data)

/* ── Auth ───────────────────────────────────────────────── */
export const loginUser = (body) =>
    api.post('/api/auth/login', body).then(r => r.data)

/** Register with optional FormData (includes avatar file upload) */
export const signupUser = (formDataOrBody) => {
    const isFormData = formDataOrBody instanceof FormData
    return api.post('/api/auth/register', formDataOrBody, {
        headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : {},
    }).then(r => r.data)
}

export const changePassword = (body) =>
    api.put('/api/auth/password', body).then(r => r.data)

export const getCurrentUser = () =>
    api.get('/api/auth/me').then(r => r.data)

/* ── Public QR Lookup ────────────────────────────────────── */
export const getAnimalByQR = (qrId) =>
    api.get(`/api/animals/by-qr/${encodeURIComponent(qrId)}`).then(r => r.data)

/* ── Stats ──────────────────────────────────────────────── */
export const getStats = () =>
    api.get('/api/stats').then(r => r.data)

/* ── Gemini AI ───────────────────────────────────────────── */
export const geminiEnhanceNearby = (body) =>
    api.post('/api/gemini/enhance-nearby', body).then(r => r.data)

export const geminiChat = (body) =>
    api.post('/api/gemini/chat', body).then(r => r.data)

export const getGeminiVaccineAlerts = (body) =>
    api.post('/api/gemini/vaccine-alerts', body, { timeout: 25000 }).then(r => r.data)

/* ── Chat ────────────────────────────────────────────────── */
export const createChatRoom = (body) =>
    api.post('/api/chat/room', body).then(r => r.data)

export const getChatRooms = () =>
    api.get('/api/chat/rooms').then(r => r.data)

export const sendChatMessage = (body) =>
    api.post('/api/chat/send', body).then(r => r.data)

export const getChatMessages = (room, after) =>
    api.get('/api/chat/messages', { params: { room, after } }).then(r => r.data)

export const getChatUsers = (search = '') =>
    api.get('/api/chat/users', { params: search ? { search } : {} }).then(r => r.data)

export const createPost = (body) =>
    api.post('/api/chat/post', body).then(r => r.data)

export const getPosts = (after) =>
    api.get('/api/chat/posts', { params: after ? { after } : {} }).then(r => r.data)

/* ── Nearby Services ─────────────────────────────────────── */
export const getNearbyVets = (city, state = '') =>
    api.get('/api/nearby', { params: { city, state }, timeout: 35000 }).then(r => r.data)

/* ── Social Profile (Users) ──────────────────────────────── */
export const getUserProfile = (userId) =>
    api.get(`/api/users/${userId}`).then(r => r.data)

export const getUserAnimals = (userId, page = 1) =>
    api.get(`/api/users/${userId}/animals`, { params: { page } }).then(r => r.data)

export const followUser = (userId) =>
    api.post(`/api/users/${userId}/follow`).then(r => r.data)

export const unfollowUser = (userId) =>
    api.delete(`/api/users/${userId}/follow`).then(r => r.data)

export const updateMyProfile = (body) =>
    api.put('/api/users/me/profile', body).then(r => r.data)

export const uploadAvatar = async (file) => {
    const form = new FormData()
    form.append('avatar', file)
    return api.post('/api/users/me/avatar', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
}

export const searchUsers = (q = '') =>
    api.get('/api/users', { params: q ? { q } : {} }).then(r => r.data)

export default api
