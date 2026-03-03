/**
 * SAIOMS — Gemini AI Proxy Router
 * POST /api/gemini/enhance-nearby   — Nearby services via Gemini (primary search)
 * POST /api/gemini/chat             — AI chatbot for animal care queries
 * POST /api/gemini/vaccine-alerts   — Automated vaccine schedule via Gemini
 */
const express = require('express');
const axios = require('axios');
const router = express.Router();

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

async function callGemini(prompt, maxTokens = 1500) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('Gemini API key not configured');
    const res = await axios.post(`${GEMINI_URL}?key=${key}`, {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.5, maxOutputTokens: maxTokens },
    }, { timeout: 20000 });
    return res.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

/**
 * POST /api/gemini/enhance-nearby
 * Body: { city, state, category }
 * Returns AI-enhanced suggestions for nearby services
 */
router.post('/enhance-nearby', async (req, res) => {
    try {
        const { city, state, category } = req.body;
        if (!city) return res.status(400).json({ success: false, detail: 'city is required' });

        const statePart = state ? `, ${state}` : '';

        const prompt = `You are an expert on Indian animal welfare services and livestock management infrastructure.

List the top 8-10 well-known animal welfare services in or near ${city}${statePart}, India. Include ALL types: veterinary hospitals/clinics, gaushalas (cow shelters), animal welfare NGOs, and animal shelters.

For EACH place provide:
- name: Official name exactly as commonly known
- address: Full street address or area name (be as specific as possible)
- phone: Phone number if commonly available (or null)
- description: One sentence describing what they specialize in
- approxDistance: Approximate distance from ${city} city center (e.g. "2 km", "within city")
- category: one of "vet", "gaushala", "ngo", or "shelter"
- website: Website URL if known (or null)

Return ONLY a valid JSON array with these keys. No markdown, no explanation, no code block. Example:
[{"name":"...","address":"...","phone":"...","description":"...","approxDistance":"...","category":"vet","website":null}]

If you cannot find specific places for ${city}, return information about well-known animal services in nearby major cities of the same region. Do NOT return an empty array — always provide at least 4-6 results.`;

        const text = await callGemini(prompt, 2000);
        let suggestions = [];
        try {
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) suggestions = JSON.parse(jsonMatch[0]);
        } catch { suggestions = []; }

        res.json({ success: true, suggestions, source: 'gemini' });
    } catch (err) {
        console.error('[Gemini] enhance-nearby error:', err.message);
        res.json({ success: true, suggestions: [], source: 'gemini' });
    }
});

/**
 * POST /api/gemini/chat
 * Body: { message, context? }
 * Returns AI response for animal care queries
 */
router.post('/chat', async (req, res) => {
    try {
        const { message, context } = req.body;
        if (!message) return res.status(400).json({ success: false, detail: 'message is required' });

        const prompt = `You are SAIOMS AI Assistant — a helpful, knowledgeable expert on Indian livestock management, animal healthcare, breed identification, vaccination schedules, and government schemes for animal welfare in India. You help farmers, veterinarians, and animal welfare workers in Uttar Pradesh and across India.

${context ? `Context: ${context}\n` : ''}
User's question: ${message}

Provide a helpful, concise, and accurate response in the same language as the question (Hindi or English). If asked about specific medical emergencies, always recommend consulting a local veterinarian. Keep responses under 300 words. Be warm and professional.`;

        const text = await callGemini(prompt, 1024);
        res.json({ success: true, response: text });
    } catch (err) {
        console.error('[Gemini] chat error:', err.message);
        res.json({ success: true, response: 'Sorry, I am unable to respond right now. Please try again later.' });
    }
});

/**
 * POST /api/gemini/vaccine-alerts
 * Body: { animals: [{species, breed, age, vaccinations, district, state}], month (0-11) }
 * Returns AI-generated vaccine recommendations specific to each animal
 */
router.post('/vaccine-alerts', async (req, res) => {
    try {
        const { animals, month } = req.body;
        if (!animals || !animals.length) return res.json({ success: true, alerts: [] });

        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        const currentMonth = monthNames[month ?? new Date().getMonth()];
        const currentMonthNum = month ?? new Date().getMonth();
        // Next 60 days span two months
        const nextMonth = monthNames[(currentMonthNum + 1) % 12];

        const animalList = animals.map((a, i) =>
            `${i + 1}. ${a.species} - ${a.breed}, age: ${a.age || 'unknown'}, location: ${a.district || ''} ${a.state || 'Uttar Pradesh'}, vaccinations given: ${(a.vaccinations || []).map(v => v.vaccine).join(', ') || 'none recorded'}`
        ).join('\n');

        const prompt = `You are an expert veterinary advisor specializing in Indian livestock health in Uttar Pradesh.

Current month: ${currentMonth}. The farmer wants vaccination alerts for the next 60 days (${currentMonth} - ${nextMonth}).

Animals:
${animalList}

For EACH animal that needs a vaccination in the next 60 days, provide an alert with:
- animalIndex: (1-based index from the list above)
- vaccine: exact vaccine name
- urgency: "now" if due this month, "soon" if due next month
- notes: brief practical note (1-2 sentences max) about why, where to get it in UP
- isGovtFree: true if available free at govt camps in India

Consider Indian seasonal vaccination calendar:
- Pre-monsoon (May-Jun): HS, BQ vaccines critical
- Jan & Jul: FMD doses
- Every 3 months: Deworming
- Spring (Mar-Apr): Theileriosis/Tick fever
- Female calves once: Brucellosis

Return ONLY a valid JSON array. No markdown, no explanation:
[{"animalIndex":1,"vaccine":"FMD","urgency":"now","notes":"...","isGovtFree":true}]

If no animal needs vaccination in next 60 days, return [].`;

        const text = await callGemini(prompt, 1500);
        let alerts = [];
        try {
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) alerts = JSON.parse(jsonMatch[0]);
        } catch { alerts = []; }

        res.json({ success: true, alerts, month: currentMonth });
    } catch (err) {
        console.error('[Gemini] vaccine-alerts error:', err.message);
        res.json({ success: true, alerts: [], error: err.message });
    }
});

module.exports = router;
