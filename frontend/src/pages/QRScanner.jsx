import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { getAnimalByQR, decodeQR } from '../services/api'
import jsQR from 'jsqr'

/* ─── Nearby Vets/NGOs — Multi-strategy search ────────────────────────────── */

/** Haversine distance in km between two lat/lon points */
function _haversine(lat1, lon1, lat2, lon2) {
    const R = 6371
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

async function fetchNearbyVets(pincode, city, state) {
    try {
        // ── Step 1: Geocode the location ──────────────────────────────────────
        const locationStr = [pincode, city, state].filter(Boolean).join(', ')
        const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationStr + ' India')}&format=json&limit=1`,
            { headers: { 'Accept-Language': 'en', 'User-Agent': 'SAIOMS/1.0' } }
        )
        const geoData = await geoRes.json()
        if (!geoData?.length) return []

        const lat = parseFloat(geoData[0].lat)
        const lon = parseFloat(geoData[0].lon)
        const radius = 30000   // 30 km — wide enough for rural India

        // ── Step 2: Overpass — comprehensive tag set for Indian context ────────
        // Covers: private vet clinics, govt animal husbandry depts,
        // animal hospitals, shelters, SPCA, NGOs
        const overpassQuery = `
[out:json][timeout:30];
(
  node["amenity"="veterinary"](around:${radius},${lat},${lon});
  way["amenity"="veterinary"](around:${radius},${lat},${lon});
  relation["amenity"="veterinary"](around:${radius},${lat},${lon});
  node["healthcare"="veterinary"](around:${radius},${lat},${lon});
  way["healthcare"="veterinary"](around:${radius},${lat},${lon});
  node["amenity"="animal_shelter"](around:${radius},${lat},${lon});
  way["amenity"="animal_shelter"](around:${radius},${lat},${lon});
  node["amenity"="animal_boarding"](around:${radius},${lat},${lon});
  node["shop"="pet"](around:${radius},${lat},${lon});
  node["government"="veterinary"](around:${radius},${lat},${lon});
  way["government"="veterinary"](around:${radius},${lat},${lon});
  node["office"="government"]["name"~"animal|veterinary|pashu|pashudhan",i](around:${radius},${lat},${lon});
  node["office"="ngo"](around:${radius},${lat},${lon});
  way["office"="ngo"](around:${radius},${lat},${lon});
  node["association"="animal_welfare"](around:${radius},${lat},${lon});
);
out body center;`

        // Try primary Overpass mirror, fallback to secondary
        let ovElements = []
        for (const mirror of [
            'https://overpass-api.de/api/interpreter',
            'https://overpass.kumi.systems/api/interpreter',
        ]) {
            try {
                const r = await fetch(`${mirror}?data=${encodeURIComponent(overpassQuery)}`, { signal: AbortSignal.timeout(28000) })
                if (!r.ok) continue
                const d = await r.json()
                ovElements = d.elements || []
                break
            } catch (_) { continue }
        }

        // ── Step 3: Map Overpass elements → result objects ────────────────────
        const typeOf = (el) => {
            const a = el.tags?.amenity || ''
            const g = el.tags?.government || ''
            const o = el.tags?.office || ''
            if (a === 'veterinary' || g === 'veterinary') return 'vet'
            if (a === 'animal_shelter' || a === 'animal_boarding') return 'shelter'
            if (o === 'ngo' || el.tags?.association === 'animal_welfare') return 'ngo'
            if (a === 'shop' || o === 'shop') return 'petshop'
            return 'vet'
        }

        const seen = new Set()
        let results = ovElements
            .map(el => {
                const elLat = el.lat ?? el.center?.lat
                const elLon = el.lon ?? el.center?.lon
                return {
                    name: el.tags?.['name:en'] || el.tags?.name || el.tags?.['name:hi'] || null,
                    type: typeOf(el),
                    address: [
                        el.tags?.['addr:housename'],
                        el.tags?.['addr:street'],
                        el.tags?.['addr:suburb'] || el.tags?.['addr:city'] || city,
                    ].filter(Boolean).join(', ') || city || state || '',
                    phone: el.tags?.phone || el.tags?.['contact:phone'] || el.tags?.['mobile'] || null,
                    website: el.tags?.website || el.tags?.['contact:website'] || null,
                    lat: elLat,
                    lon: elLon,
                    dist: (elLat && elLon) ? _haversine(lat, lon, elLat, elLon) : 999,
                    source: 'osm',
                }
            })
            .filter(el => {
                // Keep if it has a real name (not just coordinates)
                if (!el.name) return false
                const key = el.name.toLowerCase().replace(/\s+/g, '')
                if (seen.has(key)) return false
                seen.add(key)
                return true
            })
            .sort((a, b) => a.dist - b.dist)
            .slice(0, 12)

        // ── Step 4: Nominatim keyword fallback if Overpass returns < 3 results ─
        if (results.length < 3) {
            const keywords = ['veterinary hospital', 'animal hospital', 'pashu chikitsa', 'SPCA', 'animal shelter']
            const searchCity = city || state || locationStr
            for (const kw of keywords) {
                try {
                    const nRes = await fetch(
                        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(kw + ' ' + searchCity + ' India')}&format=json&limit=5&countrycodes=in&addressdetails=0`,
                        { headers: { 'Accept-Language': 'en', 'User-Agent': 'SAIOMS/1.0' }, signal: AbortSignal.timeout(8000) }
                    )
                    const nData = await nRes.json()
                    for (const place of (nData || [])) {
                        const pLat = parseFloat(place.lat)
                        const pLon = parseFloat(place.lon)
                        const dist = _haversine(lat, lon, pLat, pLon)
                        if (dist > radius / 1000) continue  // outside radius
                        const name = place.display_name?.split(',')[0]?.trim()
                        if (!name) continue
                        const key = name.toLowerCase().replace(/\s+/g, '')
                        if (seen.has(key)) continue
                        seen.add(key)
                        results.push({
                            name,
                            type: kw.includes('NGO') || kw.includes('SPCA') || kw.includes('shelter') ? 'ngo' : 'vet',
                            address: place.display_name?.split(',').slice(1, 4).join(',').trim() || city || '',
                            phone: null,
                            website: null,
                            lat: pLat,
                            lon: pLon,
                            dist,
                            source: 'nominatim',
                        })
                    }
                } catch (_) { continue }
                if (results.length >= 8) break
            }
            results = results.sort((a, b) => a.dist - b.dist).slice(0, 12)
        }

        return results
    } catch (_) {
        return []
    }
}

/* ─── Result Tabs ──────────────────────────────────────────────────────────── */
function OwnerHistoryTab({ animal }) {
    const transfers = animal.transfer_history || []
    const currentOwner = { name: animal.owner_name, phone: animal.owner_phone, district: animal.district, state: animal.state }

    const owners = [
        ...transfers.map((t, i) => ({ name: t.from_owner, date: t.date?.slice(0, 10), reason: t.reason, isCurrent: false, idx: i })),
        { name: currentOwner.name, phone: currentOwner.phone, location: `${currentOwner.district || ''}, ${currentOwner.state || ''}`.trim().replace(/^,\s*/, ''), date: 'Current', isCurrent: true, idx: transfers.length },
    ]

    return (
        <div>
            <div className="sec-head">👤 Owner History</div>
            {owners.length === 1 ? (
                <div style={{ background: 'rgba(45,106,79,0.07)', border: '1.5px solid rgba(45,106,79,0.18)', borderRadius: 18, padding: '20px 22px', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    <div style={{ fontSize: 36, lineHeight: 1 }}>👤</div>
                    <div>
                        <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--primary)' }}>{owners[0].name}</div>
                        {owners[0].phone && <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>📞 {owners[0].phone}</div>}
                        {owners[0].location && <div style={{ color: 'var(--muted)', fontSize: 13 }}>📍 {owners[0].location}</div>}
                        <span style={{ marginTop: 8, display: 'inline-block', background: 'rgba(45,106,79,0.12)', color: 'var(--primary)', padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>✅ Original &amp; Current Owner</span>
                    </div>
                </div>
            ) : (
                <div style={{ position: 'relative', paddingLeft: 28 }}>
                    <div style={{ position: 'absolute', left: 11, top: 16, bottom: 16, width: 2, background: 'rgba(45,106,79,0.15)' }} />
                    {owners.map((o, i) => (
                        <div key={i} style={{ display: 'flex', gap: 16, marginBottom: 16, position: 'relative' }}>
                            <div style={{ position: 'absolute', left: -28, top: 6, width: 22, height: 22, borderRadius: '50%', background: o.isCurrent ? 'var(--accent)' : '#E5E0D8', border: `2.5px solid ${o.isCurrent ? 'var(--primary)' : '#C5BFBB'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: o.isCurrent ? '#fff' : '#888' }}>
                                {o.isCurrent ? '★' : i + 1}
                            </div>
                            <div style={{ flex: 1, background: o.isCurrent ? 'rgba(45,106,79,0.08)' : '#fff', border: `1.5px solid ${o.isCurrent ? 'rgba(45,106,79,0.20)' : '#E5E0D8'}`, borderRadius: 14, padding: '12px 16px' }}>
                                <div style={{ fontWeight: 700, color: 'var(--primary)' }}>{o.name}</div>
                                {o.date && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{o.isCurrent ? '📍 Current Owner' : `📅 Until: ${o.date}`}{o.reason ? ` · ${o.reason}` : ''}</div>}
                                {o.location && <div style={{ fontSize: 12, color: 'var(--muted)' }}>📍 {o.location}</div>}
                                {o.phone && <div style={{ fontSize: 12, color: 'var(--muted)' }}>📞 {o.phone}</div>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

function VaccinationTab({ animal }) {
    const vacs = animal.vaccinations || []
    return (
        <div>
            <div className="sec-head">💉 Vaccination History</div>
            {vacs.length === 0 ? (
                <div className="empty-state">
                    <span className="empty-icon">💉</span>
                    <p className="empty-title">No vaccination records</p>
                    <p className="empty-sub">No vaccinations have been recorded yet</p>
                </div>
            ) : (
                <div className="table-wrap">
                    <table>
                        <thead><tr><th>Vaccine</th><th>Date Given</th><th>Next Due</th><th>Veterinarian</th><th>Clinic</th></tr></thead>
                        <tbody>
                            {vacs.map((v, i) => (
                                <tr key={i}>
                                    <td><strong>{v.vaccine}</strong></td>
                                    <td>{v.date}</td>
                                    <td style={{ color: v.next_due ? 'inherit' : 'var(--muted)' }}>{v.next_due || '—'}</td>
                                    <td>{v.vet_name || '—'}</td>
                                    <td>{v.clinic || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

function AnimalInfoTab({ animal }) {
    const emoji = animal.species === 'buffalo' ? '🐃' : '🐄'
    const age = animal.dob ? (() => {
        const ms = Date.now() - new Date(animal.dob).getTime()
        const yrs = Math.floor(ms / (365.25 * 24 * 3600 * 1000))
        const mos = Math.floor((ms % (365.25 * 24 * 3600 * 1000)) / (30.44 * 24 * 3600 * 1000))
        return yrs > 0 ? `${yrs}y ${mos}m` : `${mos} months`
    })() : null

    const items = [
        { k: 'Species', v: animal.species, cap: true },
        { k: 'Breed', v: animal.breed },
        { k: 'Gender', v: animal.gender, cap: true },
        { k: 'Date of Birth', v: animal.dob },
        { k: 'Age', v: age },
        { k: 'Weight', v: animal.weight_kg ? `${animal.weight_kg} kg` : null },
        { k: 'Ear Tag', v: animal.ear_tag },
        { k: 'Health Status', v: animal.health_status?.replace('_', ' '), cap: true },
        { k: 'Colour / Markings', v: animal.color_markings },
        { k: 'AI Breed (ML)', v: animal.ai_breed ? `${animal.ai_breed} (${(animal.ai_confidence * 100).toFixed(0)}%)` : null },
        { k: 'Last Vet Visit', v: animal.last_vet_visit },
        { k: 'Registered On', v: animal.registered_at?.slice(0, 10) },
        { k: 'Animal ID', v: animal.animal_id, mono: true },
    ].filter(x => x.v)

    return (
        <div>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 64 }}>{emoji}</div>
                <div style={{ fontFamily: '"Playfair Display",serif', fontSize: 26, fontWeight: 800, color: 'var(--primary)' }}>{animal.breed}</div>
                <div style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>
                    {animal.species} · {animal.gender} {animal.health_status && `· ${animal.health_status.replace('_', ' ')}`}
                </div>
            </div>
            <div className="detail-grid">
                {items.map(({ k, v, cap, mono }) => (
                    <div className="detail-item" key={k}>
                        <div className="detail-key">{k}</div>
                        <div className="detail-val" style={{ textTransform: cap ? 'capitalize' : 'none', fontFamily: mono ? '"Space Mono",monospace' : 'inherit', fontSize: mono ? 11 : 'inherit' }}>{v}</div>
                    </div>
                ))}
            </div>
        </div>
    )
}

function LocationTab({ animal, vets, vetsLoading, onSearchLocation }) {
    const [cityInput, setCityInput] = useState(animal.city || animal.district || '')
    const [searching, setSearching] = useState(false)

    const TYPE_META = {
        vet: { emoji: '🏥', label: 'Veterinary', bg: 'rgba(45,106,79,0.10)', color: 'var(--primary)' },
        shelter: { emoji: '🏠', label: 'Animal Shelter', bg: 'rgba(99,102,241,0.10)', color: '#4f46e5' },
        ngo: { emoji: '🤝', label: 'NGO / Welfare', bg: 'rgba(184,134,11,0.10)', color: 'var(--accent)' },
        petshop: { emoji: '🐾', label: 'Pet / Feed Shop', bg: 'rgba(239,68,68,0.10)', color: '#dc2626' },
    }

    const handleSearch = async (e) => {
        e?.preventDefault()
        if (!cityInput.trim()) return
        setSearching(true)
        await onSearchLocation(cityInput.trim(), animal.state)
        setSearching(false)
    }

    return (
        <div>
            <div className="sec-head">📍 Animal Location</div>
            <div className="detail-grid" style={{ marginBottom: 20 }}>
                {animal.pincode && <div className="detail-item"><div className="detail-key">PIN Code</div><div className="detail-val" style={{ fontFamily: '"Space Mono",monospace' }}>{animal.pincode}</div></div>}
                {animal.city && <div className="detail-item"><div className="detail-key">City / Town</div><div className="detail-val">{animal.city}</div></div>}
                {animal.district && <div className="detail-item"><div className="detail-key">District</div><div className="detail-val">{animal.district}</div></div>}
                {animal.state && <div className="detail-item"><div className="detail-key">State</div><div className="detail-val">{animal.state}</div></div>}
            </div>

            <div className="sec-head">🏥 Find Nearby Veterinary Services & NGOs</div>

            {/* Manual city search — works WITHOUT GPS */}
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
                <input
                    value={cityInput}
                    onChange={e => setCityInput(e.target.value)}
                    placeholder="Enter city, district or PIN code (e.g. Kanpur, Lucknow, 208001)"
                    style={{ flex: 1, minWidth: 200, padding: '9px 12px', border: '1.5px solid #E5E0D8', borderRadius: 10, fontSize: 13, fontFamily: 'inherit', background: '#FAFAF9', outline: 'none' }}
                />
                <button
                    type="submit"
                    disabled={searching || vetsLoading || !cityInput.trim()}
                    style={{ padding: '9px 18px', border: 'none', borderRadius: 10, background: '#D4A017', color: '#1f2a1f', fontWeight: 800, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}
                >
                    {searching || vetsLoading ? '🔍 Searching…' : '🔍 Search'}
                </button>
            </form>

            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, marginTop: -10 }}>
                Searching government vet hospitals, private clinics, animal shelters & NGOs within 30 km. <strong>No GPS needed</strong> — just type a location above.
            </p>

            {vetsLoading ? (
                <div className="spinner-page"><div className="spinner" /><span>Searching nearby resources…</span></div>
            ) : vets.length === 0 ? (
                <div className="empty-state">
                    <span className="empty-icon">🗺️</span>
                    <p className="empty-title">No nearby services found</p>
                    <p className="empty-sub">
                        Try a broader search (district or state). Or search on{' '}
                        <a href={`https://www.google.com/maps/search/veterinary+hospital+near+${encodeURIComponent(cityInput || [animal.city, animal.district, animal.state].filter(Boolean).join(', '))}`}
                            target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontWeight: 700 }}>
                            Google Maps →
                        </a>
                    </p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 14 }}>
                    {vets.map((v, i) => {
                        const meta = TYPE_META[v.type] || TYPE_META.vet
                        const distLabel = v.dist < 999 ? `${v.dist.toFixed(1)} km` : null
                        const mapsUrl = v.lat && v.lon
                            ? `https://www.google.com/maps/dir/?api=1&destination=${v.lat},${v.lon}`
                            : `https://www.google.com/maps/search/${encodeURIComponent(v.name + ' ' + v.address)}`
                        return (
                            <div key={i} style={{ background: '#fff', border: '1.5px solid #E5E0D8', borderRadius: 18, padding: '16px 18px', boxShadow: '0 6px 24px rgba(27,67,50,0.07)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                    <div style={{ fontSize: 26, lineHeight: 1, flexShrink: 0 }}>{meta.emoji}</div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 13, lineHeight: 1.35 }}>{v.name}</div>
                                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4, alignItems: 'center' }}>
                                            <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 999, background: meta.bg, color: meta.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                                {meta.label}
                                            </span>
                                            {distLabel && (
                                                <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 999, background: 'rgba(27,67,50,0.06)', color: 'var(--muted)', fontWeight: 600 }}>
                                                    📍 {distLabel}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {v.address && <div style={{ color: 'var(--muted)', fontSize: 12 }}>📍 {v.address}</div>}
                                {v.phone && <div style={{ fontSize: 12 }}>📞 <a href={`tel:${v.phone}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>{v.phone}</a></div>}
                                {v.website && <div style={{ fontSize: 12 }}>🌐 <a href={v.website} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontWeight: 600 }}>Visit Website</a></div>}
                                <a href={mapsUrl} target="_blank" rel="noreferrer"
                                    style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' }}>
                                    🗺️ Get Directions →
                                </a>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}


/* ─── Main Component ───────────────────────────────────────────────────────── */
const TABS = ['animal', 'owner', 'vaccination', 'location']
const TAB_LABELS = { animal: '🐄 Animal', owner: '👤 Owners', vaccination: '💉 Vaccines', location: '📍 Location' }

export default function QRScanner() {
    const [mode, setMode] = useState('camera')
    const [result, setResult] = useState(null)
    const [error, setError] = useState(null)
    const [loading, setLoading] = useState(false)
    const [scanning, setScanning] = useState(false)
    const [tab, setTab] = useState('animal')
    const [vets, setVets] = useState([])
    const [vetsLoading, setVetsLoading] = useState(false)
    const [selectedFile, setSelectedFile] = useState(null)
    const [filePreview, setFilePreview] = useState(null)
    const [camError, setCamError] = useState(null)

    const videoRef = useRef(null)
    const canvasRef = useRef(null)
    const streamRef = useRef(null)
    const rafRef = useRef(null)
    const detectorRef = useRef(null)
    const isDecodingRef = useRef(false)
    const fileInputRef = useRef(null)

    useEffect(() => {
        if ('BarcodeDetector' in window) {
            try { detectorRef.current = new window.BarcodeDetector({ formats: ['qr_code'] }) } catch (_) { }
        }
    }, [])

    const stopCamera = useCallback(() => {
        cancelAnimationFrame(rafRef.current)
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop())
            streamRef.current = null
        }
        if (videoRef.current) videoRef.current.srcObject = null
        isDecodingRef.current = false
        setScanning(false)
    }, [])

    const handleDecoded = useCallback(async (qrText) => {
        if (isDecodingRef.current) return
        isDecodingRef.current = true
        stopCamera()
        setLoading(true); setError(null); setCamError(null)
        try {
            // ── Step 1: Try to extract IDs from the raw text (works for plain/local QRs) ──
            let extractedQrId = null
            let extractedAnimalId = null
            const raw = qrText.trim()

            // Plain text UUID? Could be qr_id directly
            const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            if (uuidRe.test(raw)) {
                extractedQrId = raw
            } else if (raw.startsWith('{')) {
                // Plain JSON payload (locally generated QR)
                try {
                    const p = JSON.parse(raw)
                    extractedQrId = p.qr_id || p.qrId || null
                    extractedAnimalId = p.animal_id || p.animalId || null
                } catch (_) { }
            } else if (raw.includes('/api/animals/by-qr/')) {
                extractedQrId = raw.split('/api/animals/by-qr/').pop().split('?')[0]
            } else if (raw.includes('/api/animals/')) {
                extractedAnimalId = raw.split('/api/animals/').pop().split('?')[0].split('/')[0]
            }

            let animal = null

            // ── Step 2: Fast DB lookup if we extracted IDs ──
            if (extractedQrId || extractedAnimalId) {
                // Try qr_id first (handles both locally & ML-generated)
                if (extractedQrId) {
                    try {
                        const res = await getAnimalByQR(extractedQrId)
                        const a = res?.animal || (res?.animal_id ? res : null)
                        if (a?.animal_id) animal = a
                    } catch (_) { }
                }
                // Try animal_id as fallback
                if (!animal && extractedAnimalId) {
                    try {
                        const res = await getAnimalByQR(extractedAnimalId)
                        const a = res?.animal || (res?.animal_id ? res : null)
                        if (a?.animal_id) animal = a
                    } catch (_) { }
                }
            }

            // ── Step 3: Send the full raw QR text to decode-qr backend  ──
            // This handles ML-encrypted Fernet QR codes — backend decrypts and returns full DB record
            if (!animal) {
                try {
                    const res = await decodeQR({ payload: raw, qr_id: extractedQrId || raw })
                    const a = res?.animal || (res?.animal_id ? res : null)
                    if (a?.animal_id) animal = a
                } catch (_) { }
            }

            if (!animal || !animal.animal_id) {
                throw new Error('Animal not found. Make sure you are scanning a valid SAIOMS QR code.')
            }

            setResult(animal); setTab('animal')

            if (animal.pincode || animal.city || animal.district) {
                setVetsLoading(true)
                fetchNearbyVets(animal.pincode, animal.city || animal.district, animal.state)
                    .then(d => setVets(d)).finally(() => setVetsLoading(false))
            }
        } catch (err) {
            setError(err.message || 'Could not verify QR code.')
            isDecodingRef.current = false
        } finally { setLoading(false) }
    }, [stopCamera])

    // ── Multi-pass scan: normal → inverted → contrast-boosted for bad lighting
    const scanFrame = useCallback(async () => {
        const video = videoRef.current
        const canvas = canvasRef.current
        if (!video || !canvas || video.readyState < 2 || isDecodingRef.current) {
            rafRef.current = requestAnimationFrame(scanFrame)
            return
        }
        const { videoWidth: w, videoHeight: h } = video
        if (!w || !h) { rafRef.current = requestAnimationFrame(scanFrame); return }

        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        ctx.drawImage(video, 0, 0, w, h)

        let decoded = null
        try {
            // Pass 1: Native BarcodeDetector (hardware ~1-2ms)
            if (detectorRef.current) {
                const codes = await detectorRef.current.detect(canvas)
                if (codes.length > 0) decoded = codes[0].rawValue
            }
            // Pass 2: jsQR normal
            if (!decoded) {
                const imgData = ctx.getImageData(0, 0, w, h)
                const code = jsQR(imgData.data, w, h, { inversionAttempts: 'dontInvert' })
                if (code) decoded = code.data
            }
            // Pass 3: jsQR inverted (white-on-dark QR)
            if (!decoded) {
                const imgData = ctx.getImageData(0, 0, w, h)
                const code = jsQR(imgData.data, w, h, { inversionAttempts: 'onlyInvert' })
                if (code) decoded = code.data
            }
            // Pass 4: contrast-boosted canvas (bad lighting)
            if (!decoded) {
                const boostCanvas = document.createElement('canvas')
                boostCanvas.width = w; boostCanvas.height = h
                const bCtx = boostCanvas.getContext('2d', { willReadFrequently: true })
                bCtx.filter = 'contrast(1.8) brightness(1.1) grayscale(1)'
                bCtx.drawImage(video, 0, 0, w, h)
                const imgData = bCtx.getImageData(0, 0, w, h)
                const code = jsQR(imgData.data, w, h, { inversionAttempts: 'attemptBoth' })
                if (code) decoded = code.data
            }
        } catch (_) { }

        if (decoded) { handleDecoded(decoded); return }
        rafRef.current = requestAnimationFrame(scanFrame)
    }, [handleDecoded])

    const startCamera = useCallback(async () => {
        setError(null); setCamError(null); setResult(null)
        isDecodingRef.current = false
        try {
            // Use safe cross-browser constraints — no focusMode/zoom (not supported on most browsers)
            const constraints = {
                video: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                }
            }
            let stream
            try {
                stream = await navigator.mediaDevices.getUserMedia(constraints)
            } catch (_) {
                // Fallback: minimal constraints if advanced ones fail
                stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
            }
            streamRef.current = stream
            if (videoRef.current) {
                videoRef.current.srcObject = stream
                // Wait for metadata so video dimensions are real before scanning
                await new Promise(resolve => {
                    if (videoRef.current.readyState >= 1) return resolve()
                    videoRef.current.onloadedmetadata = resolve
                })
                try { await videoRef.current.play() } catch (_) { /* already playing or autoplay blocked */ }
            }
            setScanning(true)
            rafRef.current = requestAnimationFrame(scanFrame)
        } catch (err) {
            setCamError(
                err.name === 'NotAllowedError'
                    ? 'Camera permission denied. Please allow camera access in your browser settings.'
                    : err.name === 'NotFoundError'
                        ? 'No camera found on this device. Use File Upload mode instead.'
                        : `Camera error: ${err.message}`
            )
        }
    }, [scanFrame])

    useEffect(() => () => stopCamera(), [stopCamera])

    const handleFileScan = async () => {
        if (!selectedFile) return
        setLoading(true); setError(null)
        try {
            const img = await new Promise((res, rej) => {
                const i = new Image()
                i.onload = () => res(i)
                i.onerror = rej
                i.src = filePreview
            })
            const c = document.createElement('canvas')
            c.width = img.naturalWidth; c.height = img.naturalHeight
            const ctx = c.getContext('2d')
            ctx.drawImage(img, 0, 0)
            const imgData = ctx.getImageData(0, 0, c.width, c.height)
            const code = jsQR(imgData.data, c.width, c.height, { inversionAttempts: 'attemptBoth' })
            if (code?.data) { await handleDecoded(code.data); return }
            if (detectorRef.current) {
                const codes = await detectorRef.current.detect(c)
                if (codes.length > 0) { await handleDecoded(codes[0].rawValue); return }
            }
            throw new Error('No QR code found in this image.')
        } catch (err) {
            setError(err.message || 'Could not read QR code from image.')
        } finally { setLoading(false) }
    }

    const handleFileSelected = (e) => {
        const f = e.target.files?.[0]
        if (!f) return
        setSelectedFile(f)
        setError(null)
        const r = new FileReader()
        r.onload = ev => setFilePreview(ev.target.result)
        r.readAsDataURL(f)
    }

    const reset = () => {
        stopCamera()
        setResult(null); setError(null); setCamError(null); setScanning(false)
        setVets([]); setVetsLoading(false); setTab('animal')
        setSelectedFile(null); setFilePreview(null)
        isDecodingRef.current = false
    }

    const handleLocationSearch = useCallback(async (city, state) => {
        setVetsLoading(true)
        setVets([])
        const results = await fetchNearbyVets(null, city, state)
        setVets(results)
        setVetsLoading(false)
    }, [])

    return (
        <div style={{ paddingTop: 'calc(var(--nav-h) + 28px)', paddingBottom: 60, minHeight: '100vh', background: '#FAF7F0' }}>
            <div style={{ width: 'min(800px, calc(100% - 40px))', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
                    <div>
                        <h1 style={{ fontFamily: '"Playfair Display",serif', fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: 800, color: '#1B4332', marginBottom: 4 }}>📷 QR Identity Scan</h1>
                        <p style={{ color: '#6B7280', fontSize: 14 }}>Scan any animal QR code to instantly view full profile &amp; owner history</p>
                    </div>
                    <Link to="/" style={{ padding: '8px 14px', border: '1.5px solid #E5E0D8', borderRadius: 10, background: '#fff', color: '#1B4332', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>← Home</Link>
                </div>

                {/* Mode toggle */}
                {!result && (
                    <div style={{ display: 'flex', gap: 6, marginBottom: 22, padding: 5, background: '#fff', border: '1.5px solid #E5E0D8', borderRadius: 999, width: 'fit-content' }}>
                        <button onClick={() => { setMode('camera'); reset() }} style={{ padding: '7px 18px', border: 'none', borderRadius: 999, cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', background: mode === 'camera' ? '#D4A017' : 'transparent', color: mode === 'camera' ? '#1f2a1f' : '#6B7280', transition: 'all 0.2s' }}>📷 Camera Scan</button>
                        <button onClick={() => { setMode('upload'); reset() }} style={{ padding: '7px 18px', border: 'none', borderRadius: 999, cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', background: mode === 'upload' ? '#D4A017' : 'transparent', color: mode === 'upload' ? '#1f2a1f' : '#6B7280', transition: 'all 0.2s' }}>🖼 Upload Image</button>
                    </div>
                )}

                {/* Result panel */}
                {result && (
                    <div style={{ animation: 'fadeSlideIn 0.4s ease both' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'linear-gradient(135deg, rgba(45,106,79,0.10) 0%, rgba(45,106,79,0.04) 100%)', border: '1.5px solid rgba(45,106,79,0.20)', borderRadius: 22, padding: '18px 22px', marginBottom: 20, flexWrap: 'wrap' }}>
                            <div style={{ fontSize: 52 }}>{result.species === 'buffalo' ? '🐃' : '🐄'}</div>
                            <div style={{ flex: 1, minWidth: 200 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                    <div style={{ fontFamily: '"Playfair Display",serif', fontSize: 24, fontWeight: 800, color: 'var(--primary)' }}>{result.breed}</div>
                                    <span className="badge badge-healthy">✓ Verified</span>
                                </div>
                                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                                    {result.animal_id} · Owner: <strong>{result.owner_name}</strong> · {[result.city, result.district, result.state].filter(Boolean).join(', ')}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                                <Link to={`/animal/${result.animal_id}`} className="btn btn-green btn-sm">Full Profile →</Link>
                                <button className="btn btn-ghost btn-sm" onClick={reset}>🔄 Rescan</button>
                            </div>
                        </div>
                        <div className="tab-bar" style={{ marginBottom: 20 }}>
                            {TABS.map(t => (
                                <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{TAB_LABELS[t]}</button>
                            ))}
                        </div>
                        <div className="card">
                            <div className="card-body">
                                {tab === 'animal' && <AnimalInfoTab animal={result} />}
                                {tab === 'owner' && <OwnerHistoryTab animal={result} />}
                                {tab === 'vaccination' && <VaccinationTab animal={result} />}
                                {tab === 'location' && <LocationTab animal={result} vets={vets} vetsLoading={vetsLoading} onSearchLocation={handleLocationSearch} />}
                            </div>
                        </div>
                    </div>
                )}

                {/* Scanner UI */}
                {!result && (
                    <>
                        {mode === 'camera' && (
                            <div style={{ background: '#fff', border: '1.5px solid #E5E0D8', borderRadius: 22, overflow: 'hidden', boxShadow: '0 4px 20px rgba(27,67,50,0.08)' }}>
                                {/* Start screen */}
                                {!scanning && !loading && (
                                    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                                        <div style={{ fontSize: 64, marginBottom: 14 }}>📷</div>
                                        <h3 style={{ fontFamily: '"Playfair Display",serif', color: '#1B4332', marginBottom: 10, fontSize: 22 }}>Ready to Scan</h3>
                                        <p style={{ color: '#6B7280', marginBottom: 24, maxWidth: '36ch', margin: '0 auto 24px', fontSize: 14, lineHeight: 1.5 }}>
                                            Uses hardware-accelerated detection. Point camera steadily at the QR code — detection is near-instant.
                                        </p>
                                        {camError && <div style={{ color: '#991b1b', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.18)', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 18, maxWidth: 400, margin: '0 auto 18px' }}>⚠️ {camError}</div>}
                                        <button onClick={startCamera} style={{ padding: '12px 32px', border: 'none', borderRadius: 14, background: '#D4A017', color: '#1f2a1f', fontWeight: 800, cursor: 'pointer', fontSize: 15, fontFamily: 'inherit' }}>📷 Start Camera</button>
                                    </div>
                                )}
                                {/* Verifying spinner */}
                                {loading && (
                                    <div style={{ textAlign: 'center', padding: '48px 20px' }}>
                                        <div style={{ width: 40, height: 40, border: '3px solid rgba(45,106,79,0.20)', borderTopColor: '#1B4332', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 14px' }} />
                                        <span style={{ color: '#6B7280', fontSize: 14 }}>Verifying QR code…</span>
                                    </div>
                                )}
                                {/* ── Live camera feed ── */}
                                {scanning && !loading && (
                                    <div style={{ position: 'relative', background: '#000', lineHeight: 0 }}>
                                        {/*
                                          KEY FIX: video sits in NORMAL FLOW with aspect-ratio: 16/9.
                                          This guarantees the browser gives it a real computed height
                                          so the camera stream always renders (never black-screens).
                                          Overlays then stack on top via position:absolute.
                                        */}
                                        <video
                                            ref={videoRef}
                                            muted
                                            playsInline
                                            autoPlay
                                            style={{
                                                display: 'block',
                                                width: '100%',
                                                aspectRatio: '16/9',
                                                objectFit: 'cover',
                                                background: '#000',
                                            }}
                                        />
                                        {/* All overlays — parent sized naturally by the video above */}
                                        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                                            {/* Radial vignette */}
                                            <div style={{
                                                position: 'absolute', inset: 0,
                                                background: 'radial-gradient(ellipse 62% 62% at 50% 47%, transparent 46%, rgba(0,0,0,0.68) 100%)',
                                            }} />
                                            {/* Scan window */}
                                            <div style={{
                                                position: 'absolute', top: '50%', left: '50%',
                                                transform: 'translate(-50%, -50%)',
                                                width: 'min(68vw, 280px)', height: 'min(68vw, 280px)',
                                            }}>
                                                {/* Glow ring */}
                                                <div style={{
                                                    position: 'absolute', inset: -4, borderRadius: 20,
                                                    boxShadow: '0 0 0 2px rgba(212,160,23,0.3), 0 0 28px 6px rgba(212,160,23,0.15)',
                                                    animation: 'qrPulse 2.4s ease-in-out infinite',
                                                }} />
                                                {/* Corner brackets */}
                                                {[
                                                    { pos: { top: 0, left: 0 }, bw: '3px 0 0 3px', br: '10px 0 0 10px' },
                                                    { pos: { top: 0, right: 0 }, bw: '3px 3px 0 0', br: '0 10px 0 0' },
                                                    { pos: { bottom: 0, left: 0 }, bw: '0 0 3px 3px', br: '0 0 0 10px' },
                                                    { pos: { bottom: 0, right: 0 }, bw: '0 3px 3px 0', br: '0 0 10px 0' },
                                                ].map((c, i) => (
                                                    <div key={i} style={{
                                                        position: 'absolute', ...c.pos,
                                                        width: 44, height: 44,
                                                        borderColor: '#D4A017', borderStyle: 'solid',
                                                        borderWidth: c.bw, borderRadius: c.br,
                                                        boxShadow: '0 0 10px rgba(212,160,23,0.6)',
                                                        animation: 'qrCornerPulse 2.4s ease-in-out infinite',
                                                    }} />
                                                ))}
                                                {/* Center dot */}
                                                <div style={{
                                                    position: 'absolute', top: '50%', left: '50%',
                                                    transform: 'translate(-50%,-50%)',
                                                    width: 10, height: 10, borderRadius: '50%',
                                                    background: 'rgba(212,160,23,0.8)',
                                                    boxShadow: '0 0 8px 3px rgba(212,160,23,0.4)',
                                                    animation: 'qrDotPulse 1.6s ease-in-out infinite',
                                                }} />
                                                {/* Laser scan line */}
                                                <div style={{
                                                    position: 'absolute', left: 6, right: 6, height: 2.5,
                                                    background: 'linear-gradient(90deg, transparent 0%, rgba(212,160,23,0.3) 15%, #D4A017 50%, rgba(212,160,23,0.3) 85%, transparent 100%)',
                                                    boxShadow: '0 0 8px 3px rgba(212,160,23,0.5)',
                                                    borderRadius: 2,
                                                    animation: 'qrscan 2s cubic-bezier(0.45,0,0.55,1) infinite',
                                                }} />
                                                {/* Crosshair guides */}
                                                <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                                                <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.06)' }} />
                                            </div>
                                        </div>
                                        {/* Top hint bar */}
                                        <div style={{
                                            position: 'absolute', top: 0, left: 0, right: 0,
                                            background: 'linear-gradient(rgba(0,0,0,0.6), transparent)',
                                            padding: '12px 16px 24px', textAlign: 'center',
                                        }}>
                                            <p style={{ color: '#fff', fontSize: 13, fontWeight: 600, letterSpacing: 0.3, textShadow: '0 1px 4px rgba(0,0,0,0.9)', margin: 0 }}>
                                                📷 Align the QR code inside the frame
                                            </p>
                                        </div>
                                        {/* Bottom bar */}
                                        <div style={{
                                            position: 'absolute', bottom: 0, left: 0, right: 0,
                                            background: 'linear-gradient(transparent, rgba(0,0,0,0.78))',
                                            padding: '24px 16px 14px',
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <span style={{
                                                    display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                                                    background: '#4ade80', boxShadow: '0 0 6px 2px rgba(74,222,128,0.6)',
                                                    animation: 'livePulse 1.2s ease-in-out infinite',
                                                }} />
                                                <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: 600, letterSpacing: 0.3 }}>Scanning — auto-detects instantly</span>
                                            </div>
                                            <button
                                                onClick={() => { stopCamera() }}
                                                style={{
                                                    padding: '8px 22px',
                                                    border: '1.5px solid rgba(255,255,255,0.35)',
                                                    borderRadius: 12,
                                                    background: 'rgba(0,0,0,0.5)',
                                                    color: '#fff', fontWeight: 700, cursor: 'pointer',
                                                    fontSize: 13, fontFamily: 'inherit',
                                                    backdropFilter: 'blur(10px)',
                                                }}
                                            >✕ Stop</button>
                                        </div>
                                    </div>
                                )}
                                <canvas ref={canvasRef} style={{ display: 'none' }} />
                            </div>
                        )}

                        {mode === 'upload' && (
                            <div className="card">
                                <div className="card-body">
                                    {loading ? (
                                        <div className="spinner-page" style={{ padding: '48px 24px' }}>
                                            <div className="spinner" />
                                            <span>Reading QR code…</span>
                                        </div>
                                    ) : filePreview ? (
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ position: 'relative', display: 'inline-block', border: '2px solid var(--border)', borderRadius: 16, overflow: 'hidden', marginBottom: 20, boxShadow: '0 8px 24px rgba(27,67,50,0.10)' }}>
                                                <img src={filePreview} alt="QR preview" style={{ maxWidth: 280, maxHeight: 280, display: 'block' }} />
                                            </div>
                                            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>📄 {selectedFile?.name}</div>
                                            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                                                <button className="btn btn-gold btn-lg" onClick={handleFileScan} style={{ minWidth: 180 }}>🔍 Scan This QR</button>
                                                <button className="btn btn-ghost btn-sm" onClick={() => { setSelectedFile(null); setFilePreview(null); setError(null) }}>✕ Change Image</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <label htmlFor="qr-file-input" style={{ display: 'block', cursor: 'pointer' }}>
                                            <div style={{ border: '2.5px dashed rgba(45,106,79,0.25)', borderRadius: 20, padding: '48px 24px', textAlign: 'center', background: 'rgba(45,106,79,0.03)', transition: 'border-color 0.2s, background 0.2s', cursor: 'pointer' }}
                                                onDragOver={e => e.preventDefault()}
                                                onDrop={e => {
                                                    e.preventDefault()
                                                    const f = e.dataTransfer.files?.[0]
                                                    if (f) { setSelectedFile(f); const r = new FileReader(); r.onload = ev => setFilePreview(ev.target.result); r.readAsDataURL(f) }
                                                }}
                                            >
                                                <div style={{ fontSize: 64, marginBottom: 12 }}>🖼️</div>
                                                <h3 style={{ fontFamily: '"Playfair Display",serif', color: 'var(--primary)', marginBottom: 8 }}>Upload QR Image</h3>
                                                <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 20 }}>Drag &amp; drop your QR image here, or click to browse</p>
                                                <span className="btn btn-green">📷 Choose Image</span>
                                            </div>
                                            <input id="qr-file-input" ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelected} style={{ display: 'none' }} />
                                        </label>
                                    )}
                                </div>
                            </div>
                        )}

                        {error && (
                            <div style={{ marginTop: 14, padding: '12px 16px', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.20)', borderRadius: 12, color: '#991b1b', fontSize: 14, fontWeight: 600 }}>⚠️ {error}</div>
                        )}

                        {/* How it works */}
                        <div style={{ marginTop: 28 }}>
                            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#6B7280', marginBottom: 12 }}>How It Works</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                                {[
                                    { n: '01', e: '📷', t: 'Scan', d: 'Point camera or upload QR image.' },
                                    { n: '02', e: '⚡', t: 'Instant Detect', d: 'Hardware-accelerated or jsQR fallback.' },
                                    { n: '03', e: '✅', t: 'Verify', d: 'Full profile & owner history shown.' },
                                    { n: '04', e: '🏥', t: 'Find Help', d: 'Nearby vets shown by location.' },
                                ].map((s, i) => (
                                    <div key={i} style={{ background: '#fff', border: '1.5px solid #E5E0D8', borderRadius: 16, padding: '14px', boxShadow: '0 2px 12px rgba(27,67,50,0.06)' }}>
                                        <div style={{ fontFamily: '"Space Mono",monospace', fontWeight: 900, fontSize: 16, color: '#D4A017', marginBottom: 6 }}>{s.n}</div>
                                        <div style={{ fontSize: 24, marginBottom: 6 }}>{s.e}</div>
                                        <div style={{ fontWeight: 800, color: '#1B4332', marginBottom: 4, fontSize: 13 }}>{s.t}</div>
                                        <div style={{ fontSize: 12, color: '#6B7280' }}>{s.d}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>
            <style>{`
                @keyframes spin { to { transform: rotate(360deg) } }
                @keyframes qrscan {
                    0%   { top: 6%;  opacity: 0; }
                    5%   { opacity: 1; }
                    50%  { top: 91%; opacity: 1; }
                    95%  { opacity: 1; }
                    100% { top: 91%; opacity: 0; }
                }
                @keyframes qrPulse {
                    0%,100% { box-shadow: 0 0 0 2px rgba(212,160,23,0.25), 0 0 24px 4px rgba(212,160,23,0.10); }
                    50%     { box-shadow: 0 0 0 3px rgba(212,160,23,0.45), 0 0 40px 10px rgba(212,160,23,0.22); }
                }
                @keyframes qrCornerPulse {
                    0%,100% { opacity: 0.85; box-shadow: 0 0 8px 2px rgba(212,160,23,0.45); }
                    50%     { opacity: 1;    box-shadow: 0 0 16px 5px rgba(212,160,23,0.75); }
                }
                @keyframes qrDotPulse {
                    0%,100% { transform: translate(-50%,-50%) scale(1);   opacity: 0.7; }
                    50%     { transform: translate(-50%,-50%) scale(1.5); opacity: 1; }
                }
                @keyframes livePulse {
                    0%,100% { opacity: 1; transform: scale(1); }
                    50%     { opacity: 0.5; transform: scale(0.75); }
                }
                @keyframes fadeSlideIn {
                    from { opacity: 0; transform: translateY(12px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    )
}
