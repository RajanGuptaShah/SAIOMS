import { useState } from 'react'
import { Link } from 'react-router-dom'
import { searchByTag } from '../services/api'
import { useLang } from '../context/LanguageContext'

const HEALTH_CLS = {
    healthy: 'badge-healthy', sick: 'badge-sick',
    under_treatment: 'badge-treatment', unknown: 'badge-unknown',
}
const SP_EMOJI = { cattle: '🐄', buffalo: '🐃' }

function calcAge(dob) {
    if (!dob) return null
    const ms = Date.now() - new Date(dob).getTime()
    const yrs = Math.floor(ms / (365.25 * 24 * 3600 * 1000))
    const mos = Math.floor((ms % (365.25 * 24 * 3600 * 1000)) / (30.44 * 24 * 3600 * 1000))
    return yrs > 0 ? `${yrs}y ${mos}m` : `${mos} months`
}

function InfoRow({ label, value }) {
    if (!value) return null
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.06em' }}>{label}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--dark)', textTransform: 'capitalize' }}>{value}</div>
        </div>
    )
}

/* ── Map Modal ── */
function MapModal({ animal, onClose, isHindi }) {
    const loc = [animal.city, animal.district, animal.state].filter(Boolean).join(', ')
    const q = encodeURIComponent(loc + ', India')
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
            <div style={{ background: 'var(--surface)', borderRadius: 22, width: '100%', maxWidth: 700, maxHeight: '80vh', overflow: 'hidden', border: '1.5px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--primary)' }}>📍 {isHindi ? 'मानचित्र पर स्थान' : 'Location on Map'}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{animal.breed} · {animal.animal_id}</div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--muted)', padding: '4px 8px' }}>✕</button>
                </div>
                <div style={{ padding: '6px' }}>
                    <div style={{ padding: '10px 14px', marginBottom: 6, background: 'rgba(45,106,79,0.06)', borderRadius: 12, fontSize: 13, color: 'var(--dark)' }}>
                        📍 <strong>{isHindi ? 'पंजीकृत स्थान' : 'Registered Location'}:</strong> {loc || (isHindi ? 'अज्ञात' : 'Unknown')}
                        {animal.pincode && <span> · PIN: {animal.pincode}</span>}
                    </div>
                    <iframe
                        title="Animal Location"
                        width="100%"
                        height="400"
                        style={{ border: 'none', borderRadius: 16 }}
                        src={`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent('')}&layer=mapnik&marker=&query=${q}`}
                        loading="lazy"
                    />
                    <div style={{ display: 'flex', gap: 8, padding: '10px 0', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <a href={`https://www.google.com/maps/search/${q}`} target="_blank" rel="noreferrer" className="btn btn-green btn-sm">
                            🗺️ {isHindi ? 'गूगल मैप्स पर देखें' : 'View on Google Maps'}
                        </a>
                        <a href={`https://www.openstreetmap.org/search?query=${q}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                            🌐 {isHindi ? 'OpenStreetMap पर देखें' : 'View on OpenStreetMap'}
                        </a>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function AnimalLookup() {
    const { t, isHindi } = useLang()
    const [tag, setTag] = useState('')
    const [result, setResult] = useState(null)
    const [error, setError] = useState(null)
    const [loading, setLoading] = useState(false)
    const [showMap, setShowMap] = useState(false)

    const doSearch = async (e) => {
        e.preventDefault()
        if (!tag.trim()) return
        setLoading(true); setError(null); setResult(null); setShowMap(false)
        try {
            const animal = await searchByTag(tag.trim().toUpperCase())
            setResult(animal)
        } catch {
            setError(isHindi
                ? `ID "${tag.trim().toUpperCase()}" वाला कोई पशु नहीं मिला। सुनिश्चित करें कि आपने QR शीट पर छपा सटीक टैग दर्ज किया है।`
                : `No animal found with ID "${tag.trim().toUpperCase()}". Make sure you enter the exact tag printed on the QR sheet.`)
        } finally { setLoading(false) }
    }

    return (
        <div className="page-wrap">
            <div className="container" style={{ maxWidth: 680 }}>
                {/* Header */}
                <div style={{ marginBottom: 32, textAlign: 'center' }}>
                    <div style={{ fontSize: 56, marginBottom: 12 }}>🏷️</div>
                    <h1 className="page-title">{isHindi ? 'पशु खोज' : 'Animal Lookup'}</h1>
                    <p className="page-subtitle" style={{ maxWidth: '44ch', margin: '0 auto' }}>
                        {isHindi ? 'किसी पशु का विशिष्ट Tag ID दर्ज करें और उसका विवरण, स्वास्थ्य स्थिति, मालिक, और टीकाकरण इतिहास देखें।' : "Enter an animal's unique Tag ID to view its registered details, health status, owner, and vaccination history."}
                    </p>
                </div>

                {/* Search form */}
                <div style={{ background: '#fff', border: '1.5px solid var(--border)', borderRadius: 22, padding: '24px', marginBottom: 28, boxShadow: '0 4px 18px rgba(27,67,50,0.07)' }}>
                    <form onSubmit={doSearch}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--primary)', marginBottom: 10 }}>
                            {isHindi ? 'पशु Tag ID दर्ज करें' : 'Enter Animal Tag ID'}
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <input
                                className="form-input"
                                style={{ flex: 1, fontFamily: '"Space Mono",monospace', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 14 }}
                                placeholder="e.g. CATTLE-SAH-7F89"
                                value={tag}
                                onChange={e => { setTag(e.target.value); setResult(null); setError(null) }}
                                autoFocus
                            />
                            <button type="submit" className="btn btn-gold" disabled={loading || !tag.trim()} style={{ minWidth: 100 }}>
                                {loading ? '…' : `🔍 ${t('Search')}`}
                            </button>
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8, marginBottom: 0 }}>
                            💡 {isHindi ? 'Tag ID पंजीकरण के समय दी गई QR शीट पर छपा होता है' : 'The Tag ID is printed on the QR sheet provided at registration'} (e.g. <code style={{ fontFamily: '"Space Mono",monospace' }}>BUFFALO-SUR-A159</code>)
                        </p>
                    </form>
                </div>

                {/* Error */}
                {error && (
                    <div className="alert alert-error" style={{ marginBottom: 20 }}>
                        ⚠️ {error}
                        <div style={{ marginTop: 8 }}>
                            <Link to="/scan-qr" className="btn btn-ghost btn-sm">📷 {isHindi ? 'इसके बजाय QR कोड स्कैन करें' : 'Try scanning the QR code instead'}</Link>
                        </div>
                    </div>
                )}

                {/* Result */}
                {result && (
                    <div style={{ animation: 'fadeSlideIn 0.3s ease both' }}>
                        {/* Header card */}
                        <div style={{
                            background: 'linear-gradient(135deg, rgba(45,106,79,0.10), rgba(45,106,79,0.04))',
                            border: '1.5px solid rgba(45,106,79,0.22)',
                            borderRadius: 22, padding: '22px 24px', marginBottom: 18,
                            display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap',
                        }}>
                            <div style={{ fontSize: 52 }}>{SP_EMOJI[result.species] || '🐾'}</div>
                            <div style={{ flex: 1, minWidth: 180 }}>
                                <div style={{ fontFamily: '"Playfair Display",serif', fontSize: 24, fontWeight: 800, color: 'var(--primary)', marginBottom: 4 }}>{result.breed}</div>
                                <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                                    <code style={{ fontFamily: '"Space Mono",monospace', fontSize: 11 }}>{result.animal_id}</code>
                                    {' · '}{result.species}
                                </div>
                                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                                    <span className={`badge ${HEALTH_CLS[result.health_status] || 'badge-muted'}`}>
                                        {result.health_status === 'healthy' ? '❤️' : '🏥'} {result.health_status?.replace('_', ' ')}
                                    </span>
                                    {result.gender && <span className="badge badge-muted" style={{ textTransform: 'capitalize' }}>{result.gender}</span>}
                                    {calcAge(result.dob) && <span className="badge badge-blue">🎂 {calcAge(result.dob)}</span>}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {/* ── LOCATE ON MAP BUTTON ── */}
                                <button onClick={() => setShowMap(true)} className="btn btn-green btn-sm">
                                    📍 {isHindi ? 'मानचित्र पर देखें' : 'Locate on Map'}
                                </button>
                                <Link to="/scan-qr" className="btn btn-ghost btn-sm">📷 {isHindi ? 'QR स्कैन' : 'Scan QR'}</Link>
                            </div>
                        </div>

                        {/* Details */}
                        <div style={{ background: '#fff', border: '1.5px solid var(--border)', borderRadius: 20, padding: '22px 24px', marginBottom: 18, boxShadow: '0 4px 18px rgba(27,67,50,0.07)' }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--primary)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.06em' }}>🐄 {isHindi ? 'पशु विवरण' : 'Animal Details'}</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '14px 24px' }}>
                                <InfoRow label={isHindi ? 'मालिक' : 'Owner'} value={result.owner_name} />
                                <InfoRow label={isHindi ? 'मालिक फोन' : 'Owner Phone'} value={result.owner_phone} />
                                <InfoRow label={isHindi ? 'जिला' : 'District'} value={result.district} />
                                <InfoRow label={isHindi ? 'राज्य' : 'State'} value={result.state} />
                                <InfoRow label={isHindi ? 'शहर' : 'City'} value={result.city} />
                                <InfoRow label={isHindi ? 'पिनकोड' : 'Pincode'} value={result.pincode} />
                                <InfoRow label={isHindi ? 'जन्म तिथि' : 'Date of Birth'} value={result.dob} />
                                <InfoRow label={isHindi ? 'वज़न' : 'Weight'} value={result.weight_kg ? `${result.weight_kg} kg` : null} />
                                <InfoRow label={isHindi ? 'कान का टैग' : 'Ear Tag'} value={result.ear_tag} />
                                <InfoRow label={isHindi ? 'रंग / निशान' : 'Colour / Marks'} value={result.color_markings} />
                                <InfoRow label={isHindi ? 'अंतिम पशु चिकित्सक विज़िट' : 'Last Vet Visit'} value={result.last_vet_visit} />
                            </div>

                            {result.notes && (
                                <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(0,0,0,0.03)', borderRadius: 10, fontSize: 13, color: 'var(--muted)', fontStyle: 'italic' }}>
                                    📝 {result.notes}
                                </div>
                            )}
                        </div>

                        {/* Vaccinations */}
                        {result.vaccinations?.length > 0 && (
                            <div style={{ background: '#fff', border: '1.5px solid var(--border)', borderRadius: 20, padding: '22px 24px', marginBottom: 18, boxShadow: '0 4px 18px rgba(27,67,50,0.07)' }}>
                                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--primary)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.06em' }}>💉 {isHindi ? 'टीकाकरण इतिहास' : 'Vaccination History'}</div>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                        <thead>
                                            <tr style={{ borderBottom: '2px solid var(--border)' }}>
                                                {[isHindi ? 'टीका' : 'Vaccine', isHindi ? 'तिथि' : 'Date', isHindi ? 'अगली तारीख' : 'Next Due', isHindi ? 'पशु चिकित्सक' : 'Vet'].map(h => (
                                                    <th key={h} style={{ textAlign: 'left', padding: '6px 10px', fontSize: 11, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.06em' }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {result.vaccinations.map((v, i) => (
                                                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{v.vaccine || '—'}</td>
                                                    <td style={{ padding: '8px 10px', color: 'var(--muted)' }}>{v.date || '—'}</td>
                                                    <td style={{ padding: '8px 10px', color: 'var(--muted)' }}>{v.next_due || '—'}</td>
                                                    <td style={{ padding: '8px 10px', color: 'var(--muted)' }}>{v.administered_by || '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Transfer history */}
                        {result.transfer_history?.length > 0 && (
                            <div style={{ background: '#fff', border: '1.5px solid var(--border)', borderRadius: 20, padding: '22px 24px', marginBottom: 18, boxShadow: '0 4px 18px rgba(27,67,50,0.07)' }}>
                                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--primary)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.06em' }}>🔄 {isHindi ? 'स्वामित्व इतिहास' : 'Ownership History'}</div>
                                {result.transfer_history.map((tr, i) => (
                                    <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                                        <div style={{ fontSize: 20 }}>👤</div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 700, fontSize: 13 }}>{tr.from_owner} → {result.owner_name}</div>
                                            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                                                {tr.date?.slice(0, 10)}{tr.reason ? ` · ${tr.reason}` : ''}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Search again */}
                        <div style={{ textAlign: 'center', marginTop: 8 }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => { setResult(null); setTag(''); setError(null); setShowMap(false) }}>
                                🔍 {isHindi ? 'दूसरा पशु खोजें' : 'Search Another Animal'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Callout for non-logged users */}
                {!result && !loading && !error && (
                    <div style={{ textAlign: 'center', marginTop: 24, color: 'var(--muted)', fontSize: 13 }}>
                        <div style={{ marginBottom: 14 }}>{isHindi ? 'क्या आप अपने पशुओं को पंजीकृत करना या QR कोड स्कैन करना चाहते हैं?' : 'Want to register your animals or scan QR codes?'}</div>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                            <Link to="/scan-qr" className="btn btn-ghost btn-sm">📷 {t('Scan QR Code')}</Link>
                            <Link to="/signup" className="btn btn-gold btn-sm">🌱 {t('Create Account')}</Link>
                        </div>
                    </div>
                )}

                {/* Map modal */}
                {showMap && result && <MapModal animal={result} onClose={() => setShowMap(false)} isHindi={isHindi} />}
            </div>
        </div>
    )
}
