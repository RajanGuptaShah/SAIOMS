import { useState, useCallback } from 'react'
import { useLang } from '../context/LanguageContext'
import { geminiEnhanceNearby } from '../services/api'

const BASE = import.meta.env.VITE_API_BASE_URL || ''

const TYPE_META = {
    vet: { emoji: '🏥', label: 'Vet Hospital', labelHi: 'पशु चिकित्सालय', color: '#1B4332', bg: 'rgba(45,106,79,0.10)' },
    gaushala: { emoji: '🐄', label: 'Gaushala', labelHi: 'गौशाला', color: '#065f46', bg: 'rgba(16,185,129,0.12)' },
    ngo: { emoji: '🤝', label: 'NGO / Welfare', labelHi: 'एनजीओ / कल्याण', color: '#92400e', bg: 'rgba(212,160,23,0.12)' },
    shelter: { emoji: '🏠', label: 'Animal Shelter', labelHi: 'पशु आश्रय', color: '#4f46e5', bg: 'rgba(99,102,241,0.10)' },
}

const QUICK_CITIES = ['Kanpur', 'Lucknow', 'Agra', 'Varanasi', 'Jaipur', 'Pune', 'Anand', 'Bhopal']

/* ── Star rating ── */
function StarRating({ rating }) {
    if (!rating) return null
    const full = Math.floor(rating)
    const half = rating - full >= 0.5
    const stars = '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(5 - full - (half ? 1 : 0))
    return (
        <span style={{ color: '#D4A017', fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>
            {stars} <span style={{ color: '#6B7280', fontWeight: 600 }}>{rating.toFixed(1)}</span>
        </span>
    )
}

/* ── PlaceCard ── */
function PlaceCard({ p, isHindi, idx }) {
    const m = TYPE_META[p.category] || TYPE_META.vet
    const isGemini = p.source === 'gemini'
    const isGoogle = p.source === 'google_maps'
    const isOpen = p.openingHours?.toLowerCase().includes('open') || false
    const isClosed = p.openingHours?.toLowerCase().includes('close') || false

    return (
        <div style={{
            background: '#fff',
            border: `1.5px solid ${isGemini ? 'rgba(184,134,11,0.22)' : isGoogle ? 'rgba(45,106,79,0.22)' : '#E5E0D8'}`,
            borderRadius: 20, padding: '18px 20px',
            boxShadow: isGemini ? '0 4px 16px rgba(184,134,11,0.10)' : '0 4px 16px rgba(27,67,50,0.06)',
            display: 'flex', flexDirection: 'column', gap: 7,
            animation: 'fadeSlideIn 0.35s ease both',
            animationDelay: `${idx * 0.04}s`,
        }}>
            <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 28, flexShrink: 0 }}>{m.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: '#1B4332', lineHeight: 1.3 }}>{p.name}</div>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: m.bg, color: m.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                            {isHindi ? m.labelHi : m.label}
                        </span>
                        {p.dist < 999 && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: 'rgba(27,67,50,0.06)', color: '#6B7280', fontWeight: 600 }}>📍 {p.dist} {isHindi ? 'किमी' : 'km'}</span>}
                        {p.verified && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: 'rgba(45,106,79,0.10)', color: '#1B4332', fontWeight: 700 }}>✓ Verified</span>}
                        {isGoogle && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: 'rgba(234,67,53,0.08)', color: '#c0392b', fontWeight: 700 }}>Google</span>}
                        {isGemini && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: 'rgba(184,134,11,0.12)', color: '#B8860B', fontWeight: 700 }}>🤖 AI</span>}
                    </div>
                </div>
            </div>

            {/* Rating */}
            {p.rating && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <StarRating rating={p.rating} />
                    {p.reviewCount && <span style={{ fontSize: 11, color: '#9CA3AF' }}>({p.reviewCount} reviews)</span>}
                </div>
            )}

            {p.address && <div style={{ fontSize: 12, color: '#6B7280' }}>📍 {p.address}</div>}

            {/* Opening hours */}
            {p.openingHours && (
                <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: isClosed ? '#ef4444' : isOpen ? '#22c55e' : '#9CA3AF', flexShrink: 0 }} />
                    <span style={{ color: isClosed ? '#ef4444' : isOpen ? '#16a34a' : '#6B7280', fontWeight: isClosed || isOpen ? 700 : 400 }}>
                        {p.openingHours}
                    </span>
                </div>
            )}

            {(p.description || p.approxDistance) && (
                <div style={{ fontSize: 12, color: '#374151', fontStyle: 'italic' }}>
                    ℹ️ {p.description || ''}{p.approxDistance ? ` · ~${p.approxDistance}` : ''}
                </div>
            )}
            {p.phone && <div style={{ fontSize: 12 }}>📞 <a href={`tel:${p.phone}`} style={{ color: '#1B4332', fontWeight: 600 }}>{p.phone}</a></div>}
            {p.website && <div style={{ fontSize: 12 }}>🌐 <a href={p.website} target="_blank" rel="noreferrer" style={{ color: '#B8860B', fontWeight: 600 }}>{isHindi ? 'वेबसाइट देखें' : 'Visit Website'}</a></div>}
            <a href={p.mapsUrl} target="_blank" rel="noreferrer"
                style={{ marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#B8860B', fontWeight: 700, textDecoration: 'none' }}>
                🗺️ {isHindi ? 'दिशा पाएं →' : 'Get Directions →'}
            </a>
        </div>
    )
}


/* ── GMaps browse section ── */
function GoogleMapsBrowse({ links, city, isHindi }) {
    if (!links) return null
    return (
        <div style={{ background: 'rgba(45,106,79,0.04)', border: '1.5px solid rgba(45,106,79,0.14)', borderRadius: 18, padding: '16px 20px', marginBottom: 20 }}>
            <div style={{ fontWeight: 800, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#6B7280', marginBottom: 10 }}>
                🌐 {isHindi ? 'गूगल मैप्स पर भी देखें' : 'Also Browse on Google Maps'}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {Object.entries(links).map(([key, url]) => (
                    <a key={key} href={url} target="_blank" rel="noreferrer"
                        style={{ padding: '6px 14px', border: '1.5px solid rgba(45,106,79,0.20)', borderRadius: 999, fontSize: 12, fontWeight: 700, background: '#fff', color: '#1B4332', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {TYPE_META[key]?.emoji} {isHindi ? TYPE_META[key]?.labelHi : TYPE_META[key]?.label} {isHindi ? 'में' : 'in'} {city}
                    </a>
                ))}
            </div>
        </div>
    )
}

/* ── Main Page ── */
export default function NearbySearch() {
    const { t, isHindi } = useLang()
    const [places, setPlaces] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [locLabel, setLocLabel] = useState(null)
    const [query, setQuery] = useState('')
    const [filter, setFilter] = useState('all')
    const [gpsLoading, setGpsLoading] = useState(false)
    const [gmapsLinks, setGmapsLinks] = useState(null)
    const [cityName, setCityName] = useState('')
    const [counts, setCounts] = useState({})
    const [geminiPrimary, setGeminiPrimary] = useState(false)
    const [geminiUsed, setGeminiUsed] = useState(false)

    const FILTERS = [
        { key: 'all', label: isHindi ? '🔍 सभी' : '🔍 All' },
        { key: 'vet', label: isHindi ? '🏥 पशु चिकित्सालय' : '🏥 Vet Hospitals' },
        { key: 'gaushala', label: isHindi ? '🐄 गौशाला' : '🐄 Gaushala' },
        { key: 'ngo', label: isHindi ? '🤝 एनजीओ / कल्याण' : '🤝 NGO / Welfare' },
        { key: 'shelter', label: isHindi ? '🏠 आश्रय' : '🏠 Shelter' },
    ]

    /* ── Call backend /api/nearby ── */
    const searchByCity = useCallback(async (cityStr) => {
        setLoading(true); setError(null); setPlaces([]); setFilter('all'); setGmapsLinks(null); setGeminiPrimary(false); setGeminiUsed(false)
        const parts = cityStr.split(',').map(s => s.trim())
        const city = parts[0]
        const state = parts[1] || ''
        try {
            const r = await fetch(`${BASE}/api/nearby?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`)
            const data = await r.json()
            if (!r.ok || !data.success) throw new Error(data.detail || (isHindi ? 'खोज विफल' : 'Search failed'))
            setPlaces(data.results || [])
            setLocLabel(data.location?.label || cityStr)
            setCityName(city)
            setCounts(data.categoryCounts || {})
            setGmapsLinks(data.gmapsLinks || null)
            setGeminiPrimary(!!data.geminiPrimary)
            setGeminiUsed(!!data.geminiUsed)
            if (!data.results?.length) {
                setError(isHindi ? 'कोई परिणाम नहीं मिला। नीचे गूगल मैप्स लिंक उपयोग करें।' : 'No results found. Use Google Maps links below to browse manually.')
            }
        } catch (err) {
            setError(err.message || (isHindi ? 'खोज विफल। कृपया पुनः प्रयास करें।' : 'Search failed. Please try again.'))
        } finally { setLoading(false) }
    }, [isHindi])

    /* ── GPS handler ── */
    const handleGPS = () => {
        if (!navigator.geolocation) return setError(isHindi ? 'जियोलोकेशन समर्थित नहीं है।' : 'Geolocation not supported.')
        setGpsLoading(true); setError(null)
        navigator.geolocation.getCurrentPosition(async ({ coords: { latitude: lat, longitude: lon } }) => {
            try {
                const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`, { headers: { 'User-Agent': 'SAIOMS/1.0' } })
                const d = await r.json()
                const city = d.address?.city || d.address?.town || d.address?.village || ''
                const state = d.address?.state || ''
                const q = [city, state].filter(Boolean).join(', ')
                setQuery(q)
                if (q) searchByCity(q)
                else setError(isHindi ? 'GPS से शहर का पता नहीं चला। मैन्युअल रूप से दर्ज करें।' : 'Could not detect city from GPS. Enter manually.')
            } catch { setError(isHindi ? 'रिवर्स जियोकोड विफल। शहर मैन्युअल रूप से दर्ज करें।' : 'Reverse geocode failed. Enter city manually.') }
            finally { setGpsLoading(false) }
        }, () => { setGpsLoading(false); setError(isHindi ? 'स्थान अनुमति अस्वीकृत।' : 'Location access denied. Enter your city manually.') }, { timeout: 8000 })
    }

    const handleSubmit = (e) => { e.preventDefault(); if (query.trim()) searchByCity(query.trim()) }
    const shown = filter === 'all' ? places : places.filter(p => p.category === filter)

    return (
        <div className="page-wrap">
            <div className="container" style={{ maxWidth: 960 }}>

                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: 32, paddingTop: 'calc(var(--nav-h) + 16px)' }}>
                    <div style={{ fontSize: 52, marginBottom: 10 }}>🗺️</div>
                    <h1 className="page-title">{t('Find Nearby Animal Services')}</h1>
                    <p className="page-subtitle" style={{ maxWidth: '56ch', margin: '0 auto' }}>
                        {isHindi ? 'पशु चिकित्सालय, गौशाला, एनजीओ और आश्रय — बस अपना शहर टाइप करें, हम AI-संवर्धित खोज के साथ सब कुछ स्वचालित रूप से खोजते हैं' : 'Vet hospitals, gaushala, NGOs & shelters — just type your city, we search automatically with AI (Gemini) enhanced results'}
                    </p>
                </div>

                {/* Search box */}
                <div style={{ background: '#fff', border: '1.5px solid #E5E0D8', borderRadius: 22, padding: '22px 24px', marginBottom: 22, boxShadow: '0 4px 18px rgba(27,67,50,0.07)' }}>
                    <button onClick={handleGPS} disabled={gpsLoading || loading} className="btn btn-green btn-sm" style={{ marginBottom: 12 }}>
                        {gpsLoading ? (isHindi ? '⏳ स्थान खोज रहे हैं…' : '⏳ Detecting location…') : `📍 ${t('Use My Location (GPS)')}`}
                    </button>
                    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <input className="form-input" style={{ flex: 1, minWidth: 200 }}
                            placeholder={isHindi ? 'शहर या जिला — जैसे कानपुर, लखनऊ, आगरा' : 'City or district — e.g. Kanpur, Lucknow, Agra UP'}
                            value={query} onChange={e => setQuery(e.target.value)} />
                        <button type="submit" className="btn btn-gold" disabled={loading || !query.trim()}>
                            {loading ? `🔍 ${isHindi ? 'खोज रहे हैं…' : 'Searching…'}` : `🔍 ${t('Search')}`}
                        </button>
                    </form>
                    <p style={{ fontSize: 11, color: '#6B7280', marginTop: 8, marginBottom: 0 }}>
                        💡 {isHindi ? 'OpenStreetMap + Gemini AI से खोजता है — हमेशा परिणाम मिलेंगे' : 'Searches via OpenStreetMap + Gemini AI — results always guaranteed'}
                    </p>
                    {/* Quick city chips */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 12 }}>
                        {QUICK_CITIES.map(c => (
                            <button key={c} onClick={() => { setQuery(c); searchByCity(c) }}
                                style={{ padding: '4px 13px', borderRadius: 999, border: '1.5px solid #E5E0D8', background: '#FAF7F0', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', color: '#1B4332' }}>
                                {c}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Error */}
                {error && !loading && <div className="alert alert-error" style={{ marginBottom: 16 }}>⚠️ {error}</div>}

                {/* Location label + type filter + counts */}
                {locLabel && !loading && (
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                            <div style={{ fontSize: 13, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                {isHindi ? 'दिखा रहे हैं' : 'Showing results near'} <strong style={{ color: '#1B4332' }}>{locLabel}</strong>
                                {places.length > 0 && ` · ${places.length} ${isHindi ? 'सेवाएं मिलीं' : 'services found'}`}
                                {geminiPrimary && (
                                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: 'rgba(184,134,11,0.12)', color: '#B8860B', fontWeight: 700, border: '1px solid rgba(184,134,11,0.22)' }}>
                                        🤖 {isHindi ? 'Gemini AI द्वारा' : 'Powered by Gemini AI'}
                                    </span>
                                )}
                                {geminiUsed && !geminiPrimary && (
                                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: 'rgba(45,106,79,0.08)', color: '#1B4332', fontWeight: 700 }}>
                                        ✨ {isHindi ? 'AI सहायता' : 'AI Enhanced'}
                                    </span>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {FILTERS.map(f => (
                                    <button key={f.key} onClick={() => setFilter(f.key)} style={{
                                        padding: '5px 11px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                                        cursor: 'pointer', border: '1.5px solid', fontFamily: 'inherit',
                                        borderColor: filter === f.key ? '#1B4332' : '#E5E0D8',
                                        background: filter === f.key ? '#1B4332' : '#fff',
                                        color: filter === f.key ? '#fff' : '#6B7280',
                                    }}>
                                        {f.label}
                                        {f.key !== 'all' && counts[f.key] ? ` (${counts[f.key]})` : ''}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <GoogleMapsBrowse links={gmapsLinks} city={cityName} isHindi={isHindi} />
                    </div>
                )}

                {/* Loading */}
                {loading && (
                    <div style={{ textAlign: 'center', padding: '56px 0' }}>
                        <div style={{ width: 38, height: 38, border: '3px solid rgba(45,106,79,0.14)', borderTopColor: '#1B4332', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 14px' }} />
                        <p style={{ color: '#6B7280', fontSize: 14 }}>{isHindi ? 'पशु चिकित्सालय, गौशाला, एनजीओ और आश्रय खोज रहे हैं…' : 'Searching vet hospitals, gaushala, NGOs & shelters via AI…'}</p>
                        <p style={{ color: '#9CA3AF', fontSize: 12, marginTop: 4 }}>{isHindi ? 'OpenStreetMap + Gemini AI से खोज रहे हैं' : 'Using OpenStreetMap + Gemini AI for best results'}</p>
                    </div>
                )}

                {/* Results grid */}
                {!loading && shown.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 14 }}>
                        {shown.map((p, i) => <PlaceCard key={i} p={p} isHindi={isHindi} idx={i} />)}
                    </div>
                )}

                {/* Empty filtered */}
                {!loading && filter !== 'all' && shown.length === 0 && places.length > 0 && (
                    <div style={{ textAlign: 'center', padding: '32px', color: '#6B7280' }}>
                        {isHindi ? `${locLabel} के पास कोई ${filter} नहीं मिला।` : `No ${filter} found near ${locLabel}.`}{' '}
                        <button onClick={() => setFilter('all')} style={{ color: '#B8860B', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>{isHindi ? 'सभी दिखाएं' : 'Show All'}</button>
                    </div>
                )}

                {/* Initial state */}
                {!loading && !locLabel && !error && (
                    <div style={{ textAlign: 'center', padding: '48px 20px', color: '#6B7280' }}>
                        <div style={{ fontSize: 46, marginBottom: 12 }}>👆</div>
                        <p style={{ fontWeight: 700, color: '#1B4332', marginBottom: 6 }}>{isHindi ? 'ऊपर अपना शहर दर्ज करें' : 'Enter your city above'}</p>
                        <p style={{ fontSize: 13, maxWidth: '44ch', margin: '0 auto 8px', lineHeight: 1.6 }}>
                            {isHindi ? 'हम OpenStreetMap और Gemini AI से अपने आप खोज करते हैं — हमेशा परिणाम मिलते हैं।' : <>We search via <strong>OpenStreetMap</strong> + <strong>Gemini AI</strong> — guaranteed results for any Indian city.</>}
                        </p>
                        <p style={{ fontSize: 12, color: '#9CA3AF' }}>{isHindi ? 'डेटा OpenStreetMap + Gemini AI से' : 'Data from OpenStreetMap + Gemini AI'}</p>
                    </div>
                )}
            </div>
            <style>{`
                @keyframes spin { to { transform: rotate(360deg) } }
                @keyframes fadeSlideIn { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
            `}</style>
        </div>
    )
}
