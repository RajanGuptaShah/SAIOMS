/**
 * SAIOMS — Nearby Animal Services Router v2
 *
 * 4-tier cascade: SerpAPI → Overpass (OSM) → Nominatim → Gemini AI
 * Features: LRU in-memory cache (6h TTL), rate limiting, improved deduplication,
 *           richer result schema (rating, opening hours, verified flag).
 *
 * GET /api/nearby?city=Kanpur&state=Uttar Pradesh&radius=50
 */
const express = require('express');
const axios = require('axios');
const { LRUCache } = require('lru-cache');
const { nearbyLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
router.use(nearbyLimiter);

const NOM_UA = 'SAIOMS/2.0 (animal-management-system; contact@saioms.in)';
const RADIUS_KM = 50;
const MAX_RESULTS = 30;

// ── LRU cache: up to 200 cities, 6h TTL ──────────────────────────────────────
const cache = new LRUCache({
    max: 200,
    ttl: 6 * 60 * 60 * 1000, // 6 hours
});

// ── Haversine ─────────────────────────────────────────────────────────────────
function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371, toR = Math.PI / 180;
    const dLat = (lat2 - lat1) * toR, dLon = (lon2 - lon1) * toR;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin(dLon / 2) ** 2;
    return +(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);
}

// ── Levenshtein-based dedupe ─────────────────────────────────────────────────
function normalizeKey(name) {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30);
}

function stringSimilarity(a, b) {
    if (a === b) return 1;
    const la = a.length, lb = b.length;
    if (!la || !lb) return 0;
    const dp = Array.from({ length: la + 1 }, (_, i) => [i]);
    for (let j = 0; j <= lb; j++) dp[0][j] = j;
    for (let i = 1; i <= la; i++) {
        for (let j = 1; j <= lb; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return 1 - dp[la][lb] / Math.max(la, lb);
}

class DedupeSet {
    constructor() { this.keys = []; }
    isDuplicate(name) {
        const nk = normalizeKey(name);
        for (const k of this.keys) {
            if (stringSimilarity(nk, k) >= 0.82) return true;
        }
        this.keys.push(nk);
        return false;
    }
}

// ── Categorise ────────────────────────────────────────────────────────────────
function categorise(name = '', amenity = '', office = '') {
    const n = name.toLowerCase();
    if (n.includes('gaushala') || n.includes('goshala') || n.includes('gosadan') ||
        n.includes('cow shelter') || n.includes('gau raksha') || n.includes('gau sewa')) return 'gaushala';
    if (n.includes('ngo') || n.includes('welfare') || n.includes('spca') ||
        n.includes('pfa') || n.includes('people for animal') || n.includes('prani mitra') ||
        office === 'ngo') return 'ngo';
    if (n.includes('shelter') || n.includes('rescue') || amenity === 'animal_shelter') return 'shelter';
    return 'vet';
}

// ── Tier 1: SerpAPI Google Maps ───────────────────────────────────────────────
async function serpApiSearch(city, state, lat, lon) {
    const key = process.env.SERPAPI_KEY;
    if (!key) return [];
    const queries = [
        `veterinary hospital in ${city} ${state || ''} India`,
        `gaushala in ${city} ${state || ''} India`,
        `animal NGO in ${city} ${state || ''} India`,
    ];
    const results = [];
    for (const q of queries) {
        try {
            const r = await axios.get('https://serpapi.com/search', {
                params: { engine: 'google_maps', q, api_key: key, hl: 'en', gl: 'in' },
                timeout: 12000,
            });
            for (const place of r.data?.local_results || []) {
                const pLat = place.gps_coordinates?.latitude;
                const pLon = place.gps_coordinates?.longitude;
                const dist = (pLat && pLon && lat && lon)
                    ? haversine(lat, lon, pLat, pLon) : 999;
                if (dist > RADIUS_KM) continue;
                results.push({
                    name: place.title,
                    address: place.address || '',
                    phone: place.phone || null,
                    website: place.website || null,
                    rating: place.rating || null,
                    reviewCount: place.reviews || null,
                    openingHours: place.hours || null,
                    lat: pLat || null,
                    lon: pLon || null,
                    dist,
                    source: 'google_maps',
                    verified: true,
                    category: categorise(place.title || ''),
                });
            }
        } catch { continue; }
    }
    return results;
}

// ── Nominatim geocode ─────────────────────────────────────────────────────────
async function geocode(city, state) {
    const variants = [
        `${city}, ${state}, India`,
        `${city}, ${state}`,
        `${city} India`,
        `${city}`,
    ].filter(Boolean);
    for (const q of variants) {
        try {
            const r = await axios.get('https://nominatim.openstreetmap.org/search', {
                params: { q, format: 'json', limit: 3, countrycodes: 'in', addressdetails: 1 },
                headers: { 'Accept-Language': 'en', 'User-Agent': NOM_UA },
                timeout: 10000,
            });
            if (!r.data?.length) continue;
            const ranked = r.data.sort((a, b) => {
                const pri = { city: 0, town: 1, suburb: 2, district: 3, county: 4, state: 5 };
                return (pri[a.type] ?? 6) - (pri[b.type] ?? 6);
            });
            const loc = ranked[0];
            return {
                lat: parseFloat(loc.lat),
                lon: parseFloat(loc.lon),
                label: [loc.address?.city || loc.address?.town || city, loc.address?.state || state].filter(Boolean).join(', '),
            };
        } catch (_) { continue; }
    }
    throw new Error(`Could not geocode "${city}"`);
}

// ── Tier 2: Overpass (OSM tagged amenities) ───────────────────────────────────
async function overpassSearch(lat, lon) {
    const R = RADIUS_KM * 1000;
    const q = `[out:json][timeout:25];(
  node["amenity"="veterinary"](around:${R},${lat},${lon});
  way["amenity"="veterinary"](around:${R},${lat},${lon});
  node["healthcare"="veterinary"](around:${R},${lat},${lon});
  node["amenity"="animal_shelter"](around:${R},${lat},${lon});
  way["amenity"="animal_shelter"](around:${R},${lat},${lon});
  node["government"="veterinary"](around:${R},${lat},${lon});
  node["office"="ngo"](around:${R},${lat},${lon});
  node["amenity"="animal_boarding"](around:${R},${lat},${lon});
  node["name"~"gaushala|goshala|gosadan",i](around:${R},${lat},${lon});
  node["name"~"SPCA|prani|animal welfare",i](around:${R},${lat},${lon});
);out body center;`;
    for (const mirror of ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']) {
        try {
            const r = await axios.post(mirror, `data=${encodeURIComponent(q)}`, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': NOM_UA },
                timeout: 28000,
            });
            return (r.data?.elements || []).map(el => {
                const eLat = el.lat ?? el.center?.lat;
                const eLon = el.lon ?? el.center?.lon;
                if (!eLat || !eLon) return null;
                const name = el.tags?.['name:en'] || el.tags?.name;
                if (!name) return null;
                const dist = haversine(lat, lon, eLat, eLon);
                if (dist > RADIUS_KM) return null;
                return {
                    name,
                    address: [el.tags?.['addr:street'], el.tags?.['addr:suburb'] || el.tags?.['addr:city']].filter(Boolean).join(', '),
                    phone: el.tags?.phone || el.tags?.['contact:phone'] || null,
                    website: el.tags?.website || null,
                    rating: null,
                    openingHours: el.tags?.opening_hours || null,
                    lat: eLat, lon: eLon, dist,
                    amenity: el.tags?.amenity || '',
                    office: el.tags?.office || '',
                    source: 'osm', verified: false,
                };
            }).filter(Boolean);
        } catch { continue; }
    }
    return [];
}

// ── Tier 3: Nominatim keyword searches ────────────────────────────────────────
const KEYWORD_GROUPS = [
    ['veterinary hospital', 'vet'], ['animal hospital', 'vet'], ['veterinary clinic', 'vet'],
    ['pashu chikitsa', 'vet'], ['pashudhan vibhag', 'vet'], ['government veterinary', 'vet'],
    ['gaushala', 'gaushala'], ['goshala', 'gaushala'], ['gosadan', 'gaushala'],
    ['NGO animal welfare', 'ngo'], ['SPCA', 'ngo'], ['People for Animals', 'ngo'],
    ['animal shelter', 'shelter'], ['animal rescue', 'shelter'],
];

async function nominatimKeywordSearch(kw, categoryHint, lat, lon, cityHint) {
    try {
        const r = await axios.get('https://nominatim.openstreetmap.org/search', {
            params: { q: `${kw} ${cityHint} India`, format: 'json', limit: 6, countrycodes: 'in', addressdetails: 1 },
            headers: { 'Accept-Language': 'en', 'User-Agent': NOM_UA },
            timeout: 12000,
        });
        return (r.data || []).map(p => {
            const pLat = parseFloat(p.lat), pLon = parseFloat(p.lon);
            const dist = haversine(lat, lon, pLat, pLon);
            const name = p.display_name?.split(',')[0]?.trim();
            if (!name || name.length < 3 || dist > RADIUS_KM) return null;
            return {
                name,
                address: [p.address?.road, p.address?.suburb || p.address?.neighbourhood, p.address?.city || p.address?.town].filter(Boolean).join(', '),
                phone: null, website: null, rating: null, openingHours: null,
                lat: pLat, lon: pLon, dist,
                source: 'osm', verified: false,
                category: categoryHint,
            };
        }).filter(Boolean);
    } catch { return []; }
}

// ── Tier 4: Gemini fallback ───────────────────────────────────────────────────
async function callGeminiForNearby(city, state) {
    try {
        const key = process.env.GEMINI_API_KEY;
        if (!key) return [];
        const statePart = state ? `, ${state}` : '';
        const prompt = `List 8-10 well-known animal welfare services in or near ${city}${statePart}, India.
Include veterinary hospitals, gaushalas, NGOs, and animal shelters.
For each: name, address, phone (or null), description (1 line), category (vet/gaushala/ngo/shelter), website (or null).
Return ONLY a valid JSON array, no markdown:
[{"name":"...","address":"...","phone":null,"description":"...","category":"vet","website":null}]`;
        const res = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
            { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 2000 } },
            { timeout: 18000 }
        );
        const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) return [];
        return JSON.parse(jsonMatch[0]).map(s => ({
            name: s.name || 'Unknown Place',
            address: s.address || '',
            phone: s.phone || null,
            website: s.website || null,
            description: s.description || '',
            rating: null, openingHours: null,
            lat: null, lon: null, dist: 999,
            source: 'gemini', verified: false,
            category: s.category || 'vet',
            mapsUrl: `https://www.google.com/maps/search/${encodeURIComponent((s.name || '') + ' ' + (s.address || city))}`,
        }));
    } catch (e) {
        console.error('[Nearby/Gemini]', e.message);
        return [];
    }
}

// ── Combine & deduplicate ─────────────────────────────────────────────────────
function buildResult(item, cat) {
    const category = cat || categorise(item.name, item.amenity || '', item.office || '');
    return {
        name: item.name,
        category,
        address: item.address || '',
        phone: item.phone || null,
        website: item.website || null,
        description: item.description || null,
        rating: item.rating || null,
        openingHours: item.openingHours || null,
        verified: item.verified || false,
        lat: item.lat,
        lon: item.lon,
        dist: item.dist ?? 999,
        source: item.source || 'osm',
        mapsUrl: (item.mapsUrl) ? item.mapsUrl :
            (item.lat && item.lon)
                ? `https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lon}`
                : `https://www.google.com/maps/search/${encodeURIComponent(item.name + '+' + (item.address || ''))}`,
    };
}

// ── GET /api/nearby ───────────────────────────────────────────────────────────
/**
 * @swagger
 * /api/nearby:
 *   get:
 *     tags: [Nearby]
 *     summary: Find nearby animal welfare services
 *     security: []
 *     parameters:
 *       - in: query
 *         name: city
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: state
 *         schema: { type: string }
 *       - in: query
 *         name: radius
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200: { description: List of nearby services }
 */
router.get('/', async (req, res, next) => {
    try {
        const city = (req.query.city || '').trim();
        const state = (req.query.state || '').trim();
        if (!city) return res.status(400).json({ success: false, detail: 'city is required' });

        // Cache check
        const cacheKey = `${city.toLowerCase()}::${state.toLowerCase()}`;
        const cached = cache.get(cacheKey);
        if (cached) return res.json({ ...cached, cached: true });

        // Geocode
        let geoResult = null;
        try { geoResult = await geocode(city, state); } catch (_) { }

        if (!geoResult) {
            const geminiResults = await callGeminiForNearby(city, state);
            const payload = buildPayload(city, state, null, null, null, geminiResults, true);
            cache.set(cacheKey, payload);
            return res.json(payload);
        }

        const { lat, lon, label } = geoResult;

        // Run SerpAPI, Overpass, and Nominatim keyword searches in parallel
        const cityHint = state ? `${city} ${state}` : city;
        const [serpResults, overpassRaw, ...kwBatches] = await Promise.all([
            serpApiSearch(city, state, lat, lon),
            overpassSearch(lat, lon),
            ...KEYWORD_GROUPS.map(([kw, cat]) =>
                nominatimKeywordSearch(kw, cat, lat, lon, cityHint).then(arr => arr.map(r => ({ ...r, category: cat })))
            ),
        ]);

        const deduper = new DedupeSet();
        const combined = [];

        // Priority: SerpAPI → Overpass → Nominatim
        for (const item of serpResults) {
            if (!item.name || deduper.isDuplicate(item.name)) continue;
            combined.push(buildResult(item, item.category));
        }
        for (const item of overpassRaw) {
            if (!item.name || deduper.isDuplicate(item.name)) continue;
            combined.push(buildResult(item, categorise(item.name, item.amenity, item.office)));
        }
        for (const batch of kwBatches) {
            for (const item of batch) {
                if (!item.name || deduper.isDuplicate(item.name)) continue;
                combined.push(buildResult(item, item.category));
            }
        }

        combined.sort((a, b) => a.dist - b.dist);
        let topResults = combined.slice(0, MAX_RESULTS);

        // Gemini fallback if sparse
        if (topResults.length < 3) {
            const geminiResults = await callGeminiForNearby(city, state);
            for (const gr of geminiResults) {
                if (!deduper.isDuplicate(gr.name)) topResults.push(buildResult(gr, gr.category));
            }
        }

        const payload = buildPayload(city, state, lat, lon, label, topResults, false);
        cache.set(cacheKey, payload);
        res.json(payload);
    } catch (err) { next(err); }
});

function buildPayload(city, state, lat, lon, label, results, geminiPrimary) {
    const categoryCounts = results.reduce((acc, r) => { acc[r.category] = (acc[r.category] || 0) + 1; return acc; }, {});
    return {
        success: true,
        location: { city, state, lat, lon, label: label || [city, state].filter(Boolean).join(', ') },
        total: results.length,
        categoryCounts,
        gmapsLinks: {
            vet: `https://www.google.com/maps/search/veterinary+hospital+in+${encodeURIComponent(city + ' ' + state)}`,
            gaushala: `https://www.google.com/maps/search/gaushala+in+${encodeURIComponent(city + ' ' + state)}`,
            ngo: `https://www.google.com/maps/search/animal+NGO+welfare+in+${encodeURIComponent(city + ' ' + state)}`,
            shelter: `https://www.google.com/maps/search/animal+shelter+in+${encodeURIComponent(city + ' ' + state)}`,
        },
        results,
        geminiPrimary,
        geminiUsed: results.some(r => r.source === 'gemini'),
        serpApiUsed: results.some(r => r.source === 'google_maps'),
    };
}

module.exports = router;
