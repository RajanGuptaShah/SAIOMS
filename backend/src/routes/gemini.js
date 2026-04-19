/**
 * SAIOMS — Gemini AI Proxy Router v4
 * Uses gemini-1.5-flash (higher free-tier RPM limits) with a compact system prompt
 * POST /api/gemini/chat             — General-purpose AI assistant (SAIOMS-aware)
 * POST /api/gemini/enhance-nearby   — Nearby services
 * POST /api/gemini/vaccine-alerts   — Vaccine schedule
 * GET  /api/gemini/status           — API key health check
 */
const express = require('express');
const axios = require('axios');
const router = express.Router();

// Use Pollinations AI (free, no strict rate limits)
const GEMINI_URL = 'https://text.pollinations.ai/openai';

/* ── Core Gemini call ─────────────────────────────────────────────────────── */
async function callGemini(contents, maxTokens = 1024, temperature = 0.7) {
    // Translate Gemini contents (role/parts) to OpenAI messages (role/content)
    const messages = contents.map(c => ({
        role: c.role === 'model' ? 'assistant' : 'user',
        content: c.parts[0].text
    }));

    const res = await axios.post(GEMINI_URL, {
        messages,
        model: 'openai',
        temperature,
        max_tokens: maxTokens
    }, { 
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000 
    });

    const text = typeof res.data === 'string' ? res.data : (res.data.choices?.[0]?.message?.content || JSON.stringify(res.data));
    if (!text) throw new Error('Empty response from AI API');
    return text;
}

/* ── Compact SAIOMS system context (reduces tokens per request) ──────────── */
const SYSTEM_CONTEXT = `You are SAIOMS AI — a smart, friendly, general-purpose AI assistant embedded in the Smart Animal ID & Management System.

Here is exactly how users can use SAIOMS features:
1. QR Scanner: Go to the Dashboard or tap the central Scan icon in the navigation. You can scan a QR code using your camera or enter a 6-digit manual ID to view an animal's profile.
2. AI Breed Detector: Go to Dashboard -> "Detect Breed" (or ML Service). Upload an animal's photo or use the camera, and the AI will predict its breed.
3. Help Nearby: Tap "Nearby" in the navigation. Allow location access or manually type your City/State to find Veterinary Hospitals, Gaushalas, and NGOs on Google Maps.
4. My Animals & Add Animal: Go to "My Animals" from the Dashboard. Tap "Add New Animal" to register a new animal with its details (species, breed, age). You can also link a QR tracker tag here.
5. Chat & Community: Tap "Chat" in navigation. Here you can chat with me (AI), post on the global community board, or direct message other farmers and vets.
6. Vaccine Alerts: View overdue or upcoming vaccine schedules on your User Profile or Dashboard notifications. It automatically tracks FMD, HS/BQ, etc. based on your registered animals.

You can answer ANY question — animal health, breeds, farming, vaccinations, government schemes, science, technology, general knowledge, India/Nepal geography — anything the user asks.

For SAIOMS features: use the exact instructions above to guide users step-by-step.
For animal health emergencies: strongly recommend a local vet.
Reply in the SAME LANGUAGE as the user (Hindi or English).
Be helpful, warm, and concise (under 400 words). Use bullet points and emojis.`;

/* ── GET /status — health check ───────────────────────────────────────────── */
router.get('/status', async (req, res) => {
    try {
        await callGemini([{ role: 'user', parts: [{ text: 'Say OK' }] }], 5, 0.1);
        res.json({ ok: true, model: 'pollinations-ai', message: 'AI API working' });
    } catch (err) {
        res.json({ ok: false, error: err.message });
    }
});

/* ── POST /chat — general-purpose AI assistant ────────────────────────────── */
router.post('/chat', async (req, res) => {
    try {
        const { message, history = [] } = req.body;
        if (!message?.trim()) return res.status(400).json({ success: false, detail: 'message required' });

        const contents = [
            // System context as first user message (Gemini doesn't have a system role)
            { role: 'user', parts: [{ text: SYSTEM_CONTEXT }] },
            { role: 'model', parts: [{ text: 'Got it! I\'m SAIOMS AI. Ask me anything — animal health, breeds, how to use SAIOMS, general questions, or anything else!' }] },
            // Conversation history (last 8 turns for context)
            ...history.slice(-8).map(h => ({
                role: h.role === 'user' ? 'user' : 'model',
                parts: [{ text: h.text }]
            })),
            // Current message
            { role: 'user', parts: [{ text: message.trim() }] }
        ];

        const text = await callGemini(contents, 1024, 0.7);
        res.json({ success: true, response: text });

    } catch (err) {
        console.error('[Gemini/chat]', err.message);
        const isQuota = err.message.includes('429') || err.message.toLowerCase().includes('quota') || err.message.toLowerCase().includes('rate');
        const isKey = err.message.includes('API_KEY') || err.message.includes('GEMINI_API_KEY') || err.message.includes('400');
        let response;
        if (isKey) response = '🔑 AI key is not configured. Please set GEMINI_API_KEY and restart the backend.';
        else if (isQuota) response = '⏳ Too many requests — please wait 30 seconds and try again. (Free tier limit reached)';
        else response = `❌ AI error: ${err.message}`;
        res.json({ success: false, response });
    }
});

/* ── POST /enhance-nearby ─────────────────────────────────────────────────── */
router.post('/enhance-nearby', async (req, res) => {
    try {
        const { city, state } = req.body;
        if (!city) return res.status(400).json({ success: false, detail: 'city required' });
        const statePart = state ? `, ${state}` : '';
        const prompt = `List 8-10 animal welfare services near ${city}${statePart}, India/Nepal. Include vet hospitals, gaushalas, NGOs, shelters.
For each: name, address, phone (null if unknown), description (1 line), category (vet/gaushala/ngo/shelter), website (null).
Return ONLY valid JSON array: [{"name":"...","address":"...","phone":null,"description":"...","category":"vet","website":null}]`;
        const text = await callGemini([{ role: 'user', parts: [{ text: prompt }] }], 2000, 0.2);
        let suggestions = [];
        try { const m = text.match(/\[[\s\S]*\]/); if (m) suggestions = JSON.parse(m[0]); } catch { }
        res.json({ success: true, suggestions, source: 'gemini' });
    } catch (err) {
        console.error('[Gemini/enhance-nearby]', err.message);
        res.json({ success: true, suggestions: [], source: 'gemini' });
    }
});

/* ── POST /vaccine-alerts ─────────────────────────────────────────────────── */
router.post('/vaccine-alerts', async (req, res) => {
    try {
        const { animals, month } = req.body;
        if (!animals?.length) return res.json({ success: true, alerts: [] });
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const cur = month ?? new Date().getMonth();
        const currentMonth = monthNames[cur];
        const nextMonth = monthNames[(cur + 1) % 12];
        const animalList = animals.map((a, i) =>
            `${i + 1}. ${a.species} - ${a.breed}, age: ${a.age || '?'}, vaccines: ${(a.vaccinations || []).map(v => v.vaccine).join(', ') || 'none'}`
        ).join('\n');
        const prompt = `Veterinary advisor for Indian livestock. Month: ${currentMonth}. Next 60 days: ${currentMonth}-${nextMonth}.
Animals:\n${animalList}
Indian vaccine calendar: Jan+Jul=FMD, May-Jun=HS/BQ, every 3mo=Deworming, Mar-Apr=Tick fever, female calves once=Brucellosis.
Return ONLY valid JSON array for animals needing vaccination: [{"animalIndex":1,"vaccine":"FMD","urgency":"now","notes":"...","isGovtFree":true}]
If none needed return [].`;
        const text = await callGemini([{ role: 'user', parts: [{ text: prompt }] }], 1000, 0.2);
        let alerts = [];
        try { const m = text.match(/\[[\s\S]*\]/); if (m) alerts = JSON.parse(m[0]); } catch { }
        res.json({ success: true, alerts, month: currentMonth });
    } catch (err) {
        console.error('[Gemini/vaccine-alerts]', err.message);
        res.json({ success: true, alerts: [], error: err.message });
    }
});

module.exports = router;
