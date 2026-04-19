import { useState, useCallback, useRef } from 'react'
import { useLang } from '../context/LanguageContext'

const BASE = import.meta.env.VITE_API_BASE_URL || ''

/* ── Category definitions ─────────────────────────────────────────────────── */
const CATEGORIES = [
    {
        id: 'vet',
        emoji: '🏥',
        label: 'Vet Hospital / Clinic',
        labelHi: 'पशु चिकित्सालय',
        query: 'veterinary hospital OR veterinary clinic OR pashu chikitsa',
        color: '#1B4332', bg: 'rgba(45,106,79,0.10)',
    },
    {
        id: 'gaushala',
        emoji: '🐄',
        label: 'Gaushala',
        labelHi: 'गौशाला',
        query: 'gaushala OR goshala OR gosadan OR cow shelter',
        color: '#065f46', bg: 'rgba(16,185,129,0.12)',
    },
    {
        id: 'ngo',
        emoji: '🤝',
        label: 'NGO / Animal Welfare',
        labelHi: 'एनजीओ / पशु कल्याण',
        query: 'animal welfare NGO OR SPCA OR animal rescue',
        color: '#92400e', bg: 'rgba(212,160,23,0.12)',
    },
    {
        id: 'shelter',
        emoji: '🏠',
        label: 'Animal Shelter',
        labelHi: 'पशु आश्रय',
        query: 'animal shelter OR dog shelter OR stray animal shelter',
        color: '#4f46e5', bg: 'rgba(99,102,241,0.10)',
    },
]

const QUICK_PLACES = [
    { label: 'Kanpur', q: 'Kanpur, Uttar Pradesh' },
    { label: 'Lucknow', q: 'Lucknow, Uttar Pradesh' },
    { label: 'Phagwara', q: 'Phagwara, Punjab' },
    { label: 'Jaipur', q: 'Jaipur, Rajasthan' },
    { label: 'Varanasi', q: 'Varanasi, UP' },
    { label: 'Pune', q: 'Pune, Maharashtra' },
    { label: 'Anand', q: 'Anand, Gujarat' },
    { label: 'Kathmandu', q: 'Kathmandu, Nepal' },
    { label: 'Pokhara', q: 'Pokhara, Nepal' },
]

/* ── Build free Google Maps embed URL (no API key required) ──────────────── */
function buildMapUrl(searchQuery) {
    const encoded = encodeURIComponent(searchQuery)
    // Old-style embed URL works without any API key
    return `https://maps.google.com/maps?q=${encoded}&output=embed&hl=en&z=13&iwloc=near`
}

/* ── Build Google Maps navigation URL ────────────────────────────────────── */
function buildNavUrl(placeName, city) {
    const q = encodeURIComponent(`${placeName} near ${city}`)
    return `https://www.google.com/maps/search/${q}`
}

/* ── Star rating ── */
function StarRating({ rating }) {
    if (!rating) return null
    const full = Math.floor(rating)
    const half = rating - full >= 0.5
    const stars = '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(5 - full - (half ? 1 : 0))
    return (
        <span style={{ color: '#D4A017', fontSize: 11, fontWeight: 700 }}>
            {stars} <span style={{ color: '#6B7280', fontWeight: 600 }}>{rating.toFixed(1)}</span>
        </span>
    )
}

/* ── Result Card ──────────────────────────────────────────────────────────── */
function PlaceCard({ p, city, idx }) {
    const cat = CATEGORIES.find(c => c.id === p.category) || CATEGORIES[0]
    return (
        <div style={{
            background: '#fff', border: '1.5px solid #E5E0D8',
            borderRadius: 18, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 7,
            animation: 'fadeSlideIn 0.3s ease both', animationDelay: `${idx * 0.05}s`,
            boxShadow: '0 2px 12px rgba(27,67,50,0.06)',
        }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 26, flexShrink: 0 }}>{cat.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: '#1B4332', lineHeight: 1.3 }}>{p.name}</div>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: cat.bg, color: cat.color, fontWeight: 700, textTransform: 'uppercase' }}>{cat.label}</span>
                        {p.verified && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: 'rgba(45,106,79,0.1)', color: '#1B4332', fontWeight: 700 }}>✓ Verified</span>}
                        {p.source === 'gemini' && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: 'rgba(184,134,11,0.12)', color: '#B8860B', fontWeight: 700 }}>🤖 AI</span>}
                        {p.dist < 999 && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: 'rgba(27,67,50,0.06)', color: '#6B7280', fontWeight: 600 }}>📍 {p.dist} km</span>}
                    </div>
                </div>
            </div>
            {p.rating && <StarRating rating={p.rating} />}
            {p.address && <div style={{ fontSize: 12, color: '#6B7280' }}>📍 {p.address}</div>}
            {p.description && <div style={{ fontSize: 12, color: '#374151', fontStyle: 'italic' }}>ℹ️ {p.description}</div>}
            {p.phone && <div style={{ fontSize: 12 }}>📞 <a href={`tel:${p.phone}`} style={{ color: '#1B4332', fontWeight: 600 }}>{p.phone}</a></div>}
            {p.website && <div style={{ fontSize: 12 }}>🌐 <a href={p.website} target="_blank" rel="noreferrer" style={{ color: '#B8860B', fontWeight: 600 }}>Visit Website</a></div>}
            <a
                href={p.mapsUrl || buildNavUrl(p.name, city)}
                target="_blank" rel="noreferrer"
                style={{
                    marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', borderRadius: 10, background: '#1B4332',
                    color: '#fff', fontWeight: 700, fontSize: 12, textDecoration: 'none',
                    alignSelf: 'flex-start',
                }}
            >
                🗺️ Get Directions →
            </a>
        </div>
    )
}

/* ── Main Component ───────────────────────────────────────────────────────── */
export default function NearbySearch() {
    const { t, isHindi } = useLang()
    const [query, setQuery] = useState('')
    const [searchedCity, setSearchedCity] = useState('')
    const [activeCat, setActiveCat] = useState(CATEGORIES[0])
    const [places, setPlaces] = useState([])
    const [loading, setLoading] = useState(false)
    const [gpsLoading, setGpsLoading] = useState(false)
    const [error, setError] = useState(null)
    const [mapLoading, setMapLoading] = useState(false)
    const iframeRef = useRef(null)

    /* current iframe search query = "<category query> near <city>" */
    const mapQuery = searchedCity
        ? `${activeCat.query} near ${searchedCity}`
        : null

    /* ── Trigger search ── */
    const doSearch = useCallback(async (cityStr) => {
        const city = cityStr.trim()
        if (!city) return
        setSearchedCity(city)
        setMapLoading(true)
        setError(null)
        setPlaces([])
        setLoading(true)
        try {
            const parts = city.split(',').map(s => s.trim())
            const c = parts[0], s = parts[1] || ''
            const r = await fetch(`${BASE}/api/nearby?city=${encodeURIComponent(c)}&state=${encodeURIComponent(s)}`)
            const data = await r.json()
            if (data.success) setPlaces(data.results || [])
        } catch (_) { /* map still shows */ }
        finally { setLoading(false) }
    }, [])

    /* ── GPS detect ── */
    const handleGPS = () => {
        if (!navigator.geolocation) return setError('Geolocation not supported.')
        setGpsLoading(true)
        navigator.geolocation.getCurrentPosition(
            async ({ coords: { latitude: lat, longitude: lon } }) => {
                try {
                    const r = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
                        { headers: { 'User-Agent': 'SAIOMS/2.0' } }
                    )
                    const d = await r.json()
                    const city = d.address?.city || d.address?.town || d.address?.village || ''
                    const state = d.address?.state || ''
                    const q = [city, state].filter(Boolean).join(', ')
                    if (q) { setQuery(q); doSearch(q) }
                    else setError('Could not detect city from GPS. Please enter manually.')
                } catch { setError('GPS reverse geocode failed. Enter city manually.') }
                finally { setGpsLoading(false) }
            },
            () => { setGpsLoading(false); setError('Location access denied.') },
            { timeout: 8000 }
        )
    }

    const handleSubmit = e => { e.preventDefault(); doSearch(query) }

    const filteredPlaces = places.filter(p => p.category === activeCat.id)

    return (
        <div style={{ paddingTop: 'calc(var(--nav-h,64px) + 24px)', paddingBottom: 60, minHeight: '100vh', background: '#FAF7F0' }}>
            <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px' }}>

                {/* ── Header ── */}
                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                    <div style={{ fontSize: 48, marginBottom: 8 }}>🗺️</div>
                    <h1 style={{ fontFamily: '"Playfair Display",serif', fontSize: 'clamp(24px,3.5vw,34px)', fontWeight: 800, color: '#1B4332', marginBottom: 8 }}>
                        {isHindi ? 'नज़दीकी पशु सेवाएं खोजें' : 'Find Nearby Animal Services'}
                    </h1>
                    <p style={{ color: '#6B7280', fontSize: 14, maxWidth: '50ch', margin: '0 auto' }}>
                        {isHindi
                            ? 'पशु चिकित्सालय, गौशाला, एनजीओ — भारत और नेपाल में तुरंत मानचित्र परिणाम'
                            : 'Vet hospitals, gaushalas & NGOs across India & Nepal — live map with directions'}
                    </p>
                </div>

                {/* ── Search box ── */}
                <div style={{ background: '#fff', border: '1.5px solid #E5E0D8', borderRadius: 22, padding: '20px 22px', marginBottom: 20, boxShadow: '0 4px 18px rgba(27,67,50,0.07)' }}>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                        <button
                            onClick={handleGPS} disabled={gpsLoading}
                            style={{ padding: '9px 18px', border: 'none', borderRadius: 12, background: '#1B4332', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
                        >
                            {gpsLoading ? '⏳ Detecting…' : '📍 Use My Location'}
                        </button>
                    </div>
                    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <input
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder={isHindi ? 'शहर टाइप करें — जैसे फगवाड़ा, कानपुर, काठमांडू' : 'Type city — e.g. Phagwara Punjab, Kanpur, Kathmandu'}
                            style={{ flex: 1, minWidth: 220, padding: '11px 16px', border: '2px solid #E5E0D8', borderRadius: 12, fontSize: 14, fontFamily: 'inherit', outline: 'none' }}
                            onFocus={e => e.target.style.borderColor = '#D4A017'}
                            onBlur={e => e.target.style.borderColor = '#E5E0D8'}
                        />
                        <button type="submit" disabled={!query.trim()} style={{ padding: '11px 24px', border: 'none', borderRadius: 12, background: '#D4A017', color: '#1f2a1f', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                            {loading ? '🔍 Searching…' : '🔍 Search'}
                        </button>
                    </form>
                    {/* Quick city chips */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 12 }}>
                        {QUICK_PLACES.map(c => (
                            <button key={c.label} onClick={() => { setQuery(c.q); doSearch(c.q) }}
                                style={{ padding: '4px 13px', borderRadius: 999, border: '1.5px solid #E5E0D8', background: '#FAF7F0', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', color: '#1B4332' }}>
                                {c.label}
                            </button>
                        ))}
                    </div>
                </div>

                {error && !loading && (
                    <div style={{ padding: '10px 16px', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 12, color: '#991b1b', fontSize: 13, marginBottom: 16 }}>⚠️ {error}</div>
                )}

                {/* ── Category tabs ── */}
                {searchedCity && (
                    <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                        {CATEGORIES.map(cat => (
                            <button key={cat.id} onClick={() => { setActiveCat(cat); setMapLoading(true) }}
                                style={{
                                    padding: '9px 18px', borderRadius: 12, border: `2px solid ${activeCat.id === cat.id ? cat.color : '#E5E0D8'}`,
                                    background: activeCat.id === cat.id ? cat.color : '#fff',
                                    color: activeCat.id === cat.id ? '#fff' : '#374151',
                                    fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                                    transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6,
                                }}>
                                {cat.emoji} {isHindi ? cat.labelHi : cat.label}
                            </button>
                        ))}
                    </div>
                )}

                {/* ── Main content: Map + Cards ── */}
                {searchedCity && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,0.6fr)', gap: 20, alignItems: 'start' }}>

                        {/* ── LEFT: Google Maps iframe ── */}
                        <div style={{ background: '#fff', border: '1.5px solid #E5E0D8', borderRadius: 22, overflow: 'hidden', boxShadow: '0 4px 20px rgba(27,67,50,0.08)', position: 'sticky', top: 80 }}>
                            {/* Map header */}
                            <div style={{ padding: '14px 18px', borderBottom: '1px solid #F0EDE8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: 14, color: '#1B4332' }}>
                                        {activeCat.emoji} {isHindi ? activeCat.labelHi : activeCat.label} — {searchedCity}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                                        Live Google Maps · Click any pin to get directions
                                    </div>
                                </div>
                                <a
                                    href={`https://www.google.com/maps/search/${encodeURIComponent(activeCat.query + ' near ' + searchedCity)}`}
                                    target="_blank" rel="noreferrer"
                                    style={{ padding: '7px 14px', borderRadius: 10, background: '#1B4332', color: '#fff', fontWeight: 700, fontSize: 12, textDecoration: 'none', flexShrink: 0 }}
                                >
                                    🗺️ Open Full Map →
                                </a>
                            </div>

                            {/* Iframe */}
                            <div style={{ position: 'relative', height: 520 }}>
                                {mapLoading && (
                                    <div style={{ position: 'absolute', inset: 0, background: '#F9F7F4', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                                        <div style={{ width: 36, height: 36, border: '3px solid rgba(45,106,79,0.2)', borderTopColor: '#1B4332', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: 12 }} />
                                        <p style={{ color: '#6B7280', fontSize: 13 }}>Loading map…</p>
                                    </div>
                                )}
                                <iframe
                                    ref={iframeRef}
                                    key={`${activeCat.id}-${searchedCity}`}
                                    src={buildMapUrl(mapQuery)}
                                    width="100%"
                                    height="520"
                                    style={{ border: 'none', display: 'block' }}
                                    allowFullScreen
                                    loading="lazy"
                                    referrerPolicy="no-referrer-when-downgrade"
                                    onLoad={() => setMapLoading(false)}
                                    title={`${activeCat.label} near ${searchedCity}`}
                                />
                            </div>

                            {/* Direct Google Maps quick-links */}
                            <div style={{ padding: '14px 18px', borderTop: '1px solid #F0EDE8', background: '#FAFAF8' }}>
                                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9CA3AF', marginBottom: 10 }}>
                                    🔗 Quick Google Maps Links
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                    {CATEGORIES.map(cat => (
                                        <a key={cat.id}
                                            href={`https://www.google.com/maps/search/${encodeURIComponent(cat.query + ' near ' + searchedCity)}`}
                                            target="_blank" rel="noreferrer"
                                            style={{ padding: '6px 12px', borderRadius: 999, border: `1.5px solid ${cat.color}22`, background: cat.bg, color: cat.color, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}
                                        >
                                            {cat.emoji} {isHindi ? cat.labelHi : cat.label}
                                        </a>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* ── RIGHT: Result cards ── */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9CA3AF' }}>
                                {loading ? '🔍 Fetching results…' : filteredPlaces.length > 0 ? `${filteredPlaces.length} result${filteredPlaces.length > 1 ? 's' : ''} found` : 'See map for live results'}
                            </div>

                            {loading && (
                                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                                    <div style={{ width: 32, height: 32, border: '3px solid rgba(45,106,79,0.2)', borderTopColor: '#1B4332', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
                                    <p style={{ color: '#9CA3AF', fontSize: 13 }}>Searching…</p>
                                </div>
                            )}

                            {!loading && filteredPlaces.length > 0 && filteredPlaces.map((p, i) => (
                                <PlaceCard key={i} p={p} city={searchedCity} idx={i} />
                            ))}

                            {!loading && filteredPlaces.length === 0 && (
                                <div style={{ background: '#fff', border: '1.5px solid #E5E0D8', borderRadius: 18, padding: '24px 20px', textAlign: 'center' }}>
                                    <div style={{ fontSize: 36, marginBottom: 10 }}>🗺️</div>
                                    <p style={{ fontWeight: 700, color: '#1B4332', marginBottom: 6, fontSize: 14 }}>
                                        See map for live results
                                    </p>
                                    <p style={{ color: '#6B7280', fontSize: 13, lineHeight: 1.5, marginBottom: 16 }}>
                                        Click any pin on the map for details & directions. Or use the links below:
                                    </p>
                                    <a
                                        href={`https://www.google.com/maps/search/${encodeURIComponent(activeCat.query + ' near ' + searchedCity)}`}
                                        target="_blank" rel="noreferrer"
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 12, background: '#1B4332', color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}
                                    >
                                        {activeCat.emoji} Search {isHindi ? activeCat.labelHi : activeCat.label} on Google Maps →
                                    </a>
                                </div>
                            )}

                            {/* Navigation CTA */}
                            <div style={{ background: 'linear-gradient(135deg, rgba(27,67,50,0.06) 0%, rgba(212,160,23,0.06) 100%)', border: '1.5px solid rgba(27,67,50,0.12)', borderRadius: 18, padding: '18px 20px' }}>
                                <div style={{ fontWeight: 700, fontSize: 13, color: '#1B4332', marginBottom: 8 }}>
                                    📱 Get Directions in Google Maps
                                </div>
                                <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 14, lineHeight: 1.5 }}>
                                    Click any result on the map or use these links to navigate directly with Google Maps.
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {CATEGORIES.map(cat => (
                                        <a key={cat.id}
                                            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(cat.query + ' near ' + searchedCity)}&travelmode=driving`}
                                            target="_blank" rel="noreferrer"
                                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 10, background: '#fff', border: `1.5px solid ${cat.color}33`, color: cat.color, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}
                                        >
                                            {cat.emoji} Navigate to nearest {isHindi ? cat.labelHi : cat.label}
                                        </a>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Initial empty state ── */}
                {!searchedCity && (
                    <div style={{ textAlign: 'center', padding: '56px 20px', color: '#6B7280' }}>
                        <div style={{ fontSize: 52, marginBottom: 14 }}>👆</div>
                        <p style={{ fontWeight: 700, color: '#1B4332', marginBottom: 6, fontSize: 16 }}>
                            {isHindi ? 'ऊपर अपना शहर दर्ज करें' : 'Enter your city above to see the live map'}
                        </p>
                        <p style={{ fontSize: 14, maxWidth: '44ch', margin: '0 auto', lineHeight: 1.6 }}>
                            {isHindi
                                ? 'GPS से स्थान का पता लगाएं या शहर टाइप करें — Google Maps का उपयोग करके सभी गौशाला, पशु चिकित्सालय तुरंत दिखाई देंगे।'
                                : 'Detect via GPS or type a city — Google Maps will show all nearby gaushalas, vet hospitals and shelters with live directions.'}
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
                            {CATEGORIES.map(cat => (
                                <div key={cat.id} style={{ padding: '12px 18px', background: '#fff', border: `2px solid ${cat.color}22`, borderRadius: 16, textAlign: 'center', minWidth: 120 }}>
                                    <div style={{ fontSize: 28, marginBottom: 4 }}>{cat.emoji}</div>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: cat.color }}>{isHindi ? cat.labelHi : cat.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </div>
            <style>{`
                @keyframes spin { to { transform: rotate(360deg) } }
                @keyframes fadeSlideIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
                @media (max-width: 700px) {
                    div[style*='gridTemplateColumns: minmax'] { grid-template-columns: 1fr !important; }
                }
            `}</style>
        </div>
    )
}
