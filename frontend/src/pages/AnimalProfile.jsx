import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getAnimal, updateHealth, transferOwnership, lookupTransferUser, qrDownloadUrl, deleteAnimal } from '../services/api'

// ── Styles ────────────────────────────────────────────────────────
const S = {
    page: { paddingTop: 'calc(var(--nav-h) + 32px)', paddingBottom: 60, minHeight: '100vh', background: '#FAF7F0' },
    wrap: { width: 'min(960px, calc(100% - 40px))', margin: '0 auto' },
    card: { background: '#fff', border: '1.5px solid #E5E0D8', borderRadius: 20, padding: '22px 24px', marginBottom: 20, boxShadow: '0 2px 14px rgba(27,67,50,0.07)' },
    sectionLabel: { fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6B7280', marginBottom: 12 },
    infoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px 24px' },
    fieldKey: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#9CA3AF', letterSpacing: '0.06em', marginBottom: 3 },
    fieldVal: { fontSize: 14, fontWeight: 600, color: '#1A1A1A', textTransform: 'capitalize', wordBreak: 'break-word' },
    inp: { padding: '9px 12px', border: '1.5px solid #E5E0D8', borderRadius: 10, fontSize: 14, width: '100%', background: '#FAFAF9', fontFamily: 'inherit', color: '#1A1A1A', outline: 'none' },
    lbl: { fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 5, display: 'block' },
    fg: { marginBottom: 14 },
}

const HEALTH_COLORS = {
    healthy: { bg: 'rgba(45,106,79,0.12)', color: '#1b4332', border: 'rgba(45,106,79,0.22)' },
    sick: { bg: 'rgba(220,38,38,0.10)', color: '#991b1b', border: 'rgba(220,38,38,0.22)' },
    under_treatment: { bg: 'rgba(212,160,23,0.12)', color: '#92400e', border: 'rgba(212,160,23,0.28)' },
    unknown: { bg: 'rgba(107,114,128,0.10)', color: '#374151', border: 'rgba(107,114,128,0.22)' },
}
const SP_EMOJI = { cattle: '🐄', buffalo: '🐃' }

function calcAge(dob) {
    if (!dob) return null
    const ms = Date.now() - new Date(dob).getTime()
    const yrs = Math.floor(ms / (365.25 * 24 * 3600 * 1000))
    const mos = Math.floor((ms % (365.25 * 24 * 3600 * 1000)) / (30.44 * 24 * 3600 * 1000))
    return yrs > 0 ? `${yrs} years ${mos} months` : `${mos} months`
}

// ── Nearby vets via backend (no CORS, Gemini fallback) ───────────────────────
async function fetchNearbyVets(pincode, city, state) {
    try {
        const BASE = import.meta.env.VITE_API_BASE_URL || ''
        const q = city || pincode
        if (!q) return []
        const r = await fetch(`${BASE}/api/nearby?city=${encodeURIComponent(q)}&state=${encodeURIComponent(state || '')}`)
        const d = await r.json()
        if (!r.ok || !d.success) return []
        return (d.results || []).map(p => ({
            name: p.name,
            type: p.category === 'vet' ? 'vet' : 'shelter',
            address: p.address || '',
            phone: p.phone || null,
            lat: p.lat, lon: p.lon,
            mapsUrl: p.mapsUrl || null,
            source: p.source || 'osm',
        })).slice(0, 8)
    } catch { return [] }
}


// ── Field display helper ──────────────────────────────────────────
function Field({ label, value, mono }) {
    if (!value && value !== 0) return null
    return (
        <div>
            <div style={S.fieldKey}>{label}</div>
            <div style={{ ...S.fieldVal, fontFamily: mono ? '"Space Mono",monospace' : 'inherit', textTransform: mono ? 'none' : 'capitalize', fontSize: mono ? 12 : 14 }}>{value}</div>
        </div>
    )
}

// ── Styled table ──────────────────────────────────────────────────
function DataTable({ cols, rows, empty }) {
    if (!rows?.length) return <div style={{ color: '#6B7280', fontSize: 13, padding: '16px 0', textAlign: 'center' }}>{empty}</div>
    return (
        <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                    <tr>{cols.map(c => <th key={c} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, textTransform: 'uppercase', color: '#6B7280', fontWeight: 800, letterSpacing: '0.06em', borderBottom: '2px solid #E5E0D8', background: '#FAFAF9' }}>{c}</th>)}</tr>
                </thead>
                <tbody>{rows.map((row, i) => <tr key={i} style={{ borderBottom: '1px solid #F0EDE8' }}>{row.map((cell, j) => <td key={j} style={{ padding: '10px 12px', color: j === 0 ? '#1A1A1A' : '#6B7280', fontWeight: j === 0 ? 700 : 400 }}>{cell || '—'}</td>)}</tr>)}</tbody>
            </table>
        </div>
    )
}

export default function AnimalProfile() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [animal, setAnimal] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [tab, setTab] = useState('info')
    const [msg, setMsg] = useState(null)
    const [delModal, setDelModal] = useState(false)
    const [delBusy, setDelBusy] = useState(false)
    const [vets, setVets] = useState([])
    const [vetsLoading, setVetsLoading] = useState(false)

    // Health form
    const [hf, setHf] = useState({ health_status: 'healthy', last_vet_visit: '', notes: '' })
    const [hBusy, setHBusy] = useState(false)

    // Vaccination form
    const [vf, setVf] = useState({ vaccine: '', date: '', next_due: '', administered_by: '' })
    const [vBusy, setVBusy] = useState(false)

    // Transfer form (3-step: input -> preview -> confirm)
    const [tf, setTf] = useState({ email: '', phone: '', reason: '', new_city: '', new_district: '', new_state: '' })
    const [tfStep, setTfStep] = useState('input') // 'input' | 'preview' | 'done'
    const [tfPreview, setTfPreview] = useState(null) // { name, email, phone }
    const [tBusy, setTBusy] = useState(false)

    const load = () => {
        setLoading(true); setError(null)
        getAnimal(id).then(a => {
            setAnimal(a)
            setHf(f => ({ ...f, health_status: a.health_status || 'healthy', last_vet_visit: a.last_vet_visit || '' }))
            setTf(f => ({ ...f, new_district: a.district || '', new_state: a.state || '' }))
            if (a.pincode || a.city || a.district) {
                setVetsLoading(true)
                fetchNearbyVets(a.pincode, a.city || a.district, a.state).then(setVets).finally(() => setVetsLoading(false))
            }
        }).catch(() => setError(`Animal "${id}" not found.`)).finally(() => setLoading(false))
    }
    useEffect(load, [id])

    const showMsg = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 5000) }

    const lookupRecipient = async (e) => {
        e.preventDefault(); setTBusy(true); setMsg(null)
        try {
            const res = await lookupTransferUser(tf.email, tf.phone)
            setTfPreview(res.user)
            setTfStep('preview')
        } catch (err) {
            showMsg('error', err.response?.data?.detail || 'User not found')
        } finally { setTBusy(false) }
    }

    const submitHealth = async e => {
        e.preventDefault(); setHBusy(true); setMsg(null)
        try { await updateHealth(id, hf); showMsg('success', '✅ Health record updated!'); load() }
        catch (err) { showMsg('error', err.response?.data?.detail || 'Update failed') }
        finally { setHBusy(false) }
    }

    const submitVaccination = async e => {
        e.preventDefault(); setVBusy(true); setMsg(null)
        try { await updateHealth(id, { vaccination: vf }); showMsg('success', '✅ Vaccination added!'); setVf({ vaccine: '', date: '', next_due: '', administered_by: '' }); load() }
        catch (err) { showMsg('error', err.response?.data?.detail || 'Failed to save') }
        finally { setVBusy(false) }
    }

    const submitTransfer = async () => {
        setTBusy(true); setMsg(null)
        try {
            await transferOwnership({
                animal_id: id,
                new_owner_email: tfPreview.email,
                new_owner_phone: tf.phone || tfPreview.phone,
                reason: tf.reason,
                new_city: tf.new_city,
                new_district: tf.new_district,
                new_state: tf.new_state
            });
            showMsg('success', `✅ Ownership transferred to ${tfPreview.name}! New QR generated.`);
            setTfStep('done');
            load()
        }
        catch (err) {
            showMsg('error', err.response?.data?.detail || 'Transfer failed')
            setTfStep('preview')
        }
        finally { setTBusy(false) }
    }

    const handleDelete = async () => {
        setDelBusy(true)
        try { await deleteAnimal(id); navigate('/dashboard', { replace: true }) }
        catch (err) { showMsg('error', err.response?.data?.detail || 'Delete failed'); setDelModal(false); setDelBusy(false) }
    }

    // ── States ────────────────────────────────────────────────────
    if (loading) return (
        <div style={S.page}><div style={S.wrap}>
            <div style={{ textAlign: 'center', padding: '100px 20px' }}>
                <div style={{ width: 38, height: 38, border: '3px solid rgba(45,106,79,0.20)', borderTopColor: '#1B4332', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 14px' }} />
                <span style={{ color: '#6B7280' }}>Loading animal profile…</span>
            </div>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div></div>
    )

    if (error) return (
        <div style={S.page}><div style={S.wrap}>
            <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.20)', borderRadius: 12, padding: '14px 18px', color: '#991b1b', fontSize: 14, marginBottom: 16 }}>⚠️ {error}</div>
            <button onClick={() => navigate(-1)} style={{ padding: '9px 18px', border: '1.5px solid #E5E0D8', borderRadius: 12, background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>← Back</button>
        </div></div>
    )

    const hc = HEALTH_COLORS[animal.health_status] || HEALTH_COLORS.unknown
    const age = calcAge(animal.dob)

    const TABS = [
        { id: 'info', label: '📋 Info' },
        { id: 'health', label: '❤️ Health' },
        { id: 'vaccination', label: '💉 Vaccination' },
        { id: 'history', label: '🔄 History' },
        { id: 'transfer', label: '🔁 Transfer' },
        { id: 'nearby', label: '🏥 Nearby' },
    ]

    return (
        <div style={S.page}>
            {/* Delete Modal */}
            {delModal && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setDelModal(false)}>
                    <div style={{ background: '#fff', borderRadius: 22, padding: '30px 28px 24px', maxWidth: 400, width: '100%', boxShadow: '0 32px 80px rgba(0,0,0,0.24)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ textAlign: 'center', marginBottom: 18 }}>
                            <div style={{ fontSize: 48, marginBottom: 10 }}>🗑️</div>
                            <h3 style={{ fontFamily: '"Playfair Display",serif', color: '#1B4332', marginBottom: 6 }}>Delete Animal Record?</h3>
                            <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 4 }}>Permanently delete <strong>{animal.breed}</strong></p>
                            <code style={{ fontSize: 11, color: '#1B4332', background: 'rgba(45,106,79,0.09)', padding: '2px 8px', borderRadius: 6 }}>{animal.animal_id}</code>
                            <p style={{ color: '#C1440E', fontSize: 12, marginTop: 10, fontWeight: 700 }}>⚠️ This cannot be undone.</p>
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button onClick={() => setDelModal(false)} disabled={delBusy} style={{ flex: 1, padding: 10, borderRadius: 12, border: '1.5px solid #E5E0D8', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, color: '#6B7280' }}>Cancel</button>
                            <button onClick={handleDelete} disabled={delBusy} style={{ flex: 1, padding: 10, borderRadius: 12, border: 'none', background: '#C1440E', color: '#fff', cursor: delBusy ? 'wait' : 'pointer', fontWeight: 800, fontFamily: 'inherit' }}>{delBusy ? 'Deleting…' : '🗑️ Delete'}</button>
                        </div>
                    </div>
                </div>
            )}

            <div style={S.wrap}>
                {/* ── Page Header ─────────────────────────────── */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                        <button onClick={() => navigate(-1)} style={{ padding: '8px 14px', border: '1.5px solid #E5E0D8', borderRadius: 10, background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, marginTop: 6 }}>← Back</button>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                <span style={{ fontSize: 40 }}>{SP_EMOJI[animal.species] || '🐾'}</span>
                                <h1 style={{ fontFamily: '"Playfair Display",serif', fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: 800, color: '#1B4332', margin: 0 }}>{animal.breed}</h1>
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                <code style={{ fontFamily: '"Space Mono",monospace', fontSize: 11, fontWeight: 700, color: '#1B4332', background: 'rgba(45,106,79,0.09)', border: '1px solid rgba(45,106,79,0.16)', borderRadius: 999, padding: '3px 10px' }}>{animal.animal_id}</code>
                                <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, border: '1px solid', background: hc.bg, color: hc.color, borderColor: hc.border }}>
                                    {animal.health_status === 'healthy' ? '❤️' : '🏥'} {animal.health_status?.replace('_', ' ')}
                                </span>
                                {age && <span style={{ fontSize: 12, color: '#6B7280' }}>🎂 {age}</span>}
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                        {animal.qr_id && (
                            <a href={qrDownloadUrl(animal.qr_id)} target="_blank" rel="noreferrer"
                                style={{ padding: '8px 14px', border: '1.5px solid #E5E0D8', borderRadius: 10, background: '#fff', color: '#1B4332', fontWeight: 700, fontSize: 12, textDecoration: 'none' }}>
                                📥 Download QR
                            </a>
                        )}
                        <button onClick={() => setDelModal(true)} style={{ padding: '8px 14px', border: '1.5px solid rgba(193,68,14,0.25)', borderRadius: 10, background: 'rgba(193,68,14,0.08)', color: '#C1440E', fontWeight: 700, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
                            🗑️ Delete
                        </button>
                    </div>
                </div>

                {/* ── Message ───────────────────────────────────── */}
                {msg && (
                    <div style={{ padding: '12px 16px', borderRadius: 12, marginBottom: 16, fontSize: 13, fontWeight: 700, background: msg.type === 'success' ? 'rgba(45,106,79,0.10)' : 'rgba(220,38,38,0.08)', color: msg.type === 'success' ? '#1B4332' : '#991b1b', border: `1px solid ${msg.type === 'success' ? 'rgba(45,106,79,0.20)' : 'rgba(220,38,38,0.18)'}` }}>
                        {msg.text}
                    </div>
                )}

                {/* ── Tab bar ───────────────────────────────────── */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 20, overflowX: 'auto', paddingBottom: 2 }}>
                    {TABS.map(t => (
                        <button key={t.id} onClick={() => { setTab(t.id); setMsg(null) }}
                            style={{ padding: '8px 16px', border: '1.5px solid', borderRadius: 12, cursor: 'pointer', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', transition: 'all 0.15s', fontFamily: 'inherit', flexShrink: 0, borderColor: tab === t.id ? '#1B4332' : '#E5E0D8', background: tab === t.id ? '#1B4332' : '#fff', color: tab === t.id ? '#fff' : '#6B7280' }}>
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* ════════════════════════ INFO TAB ═══════════════════════ */}
                {tab === 'info' && (
                    <>
                        {/* Animal Details */}
                        <div style={S.card}>
                            <div style={S.sectionLabel}>🐄 Animal Details</div>
                            <div style={S.infoGrid}>
                                <Field label="Species" value={animal.species} />
                                <Field label="Breed" value={animal.breed} />
                                <Field label="Gender" value={animal.gender} />
                                <Field label="Date of Birth" value={animal.dob} />
                                <Field label="Age" value={age} />
                                <Field label="Weight" value={animal.weight_kg ? `${animal.weight_kg} kg` : null} />
                                <Field label="Ear Tag" value={animal.ear_tag} />
                                <Field label="Colour / Marks" value={animal.color_markings} />
                                <Field label="Health Status" value={animal.health_status?.replace('_', ' ')} />
                                <Field label="Last Vet Visit" value={animal.last_vet_visit} />
                                {animal.ai_breed && <Field label="AI Identified Breed" value={`${animal.ai_breed} (${(animal.ai_confidence * 100).toFixed(0)}%)`} />}
                                <Field label="QR Code ID" value={animal.qr_id} mono />
                                <Field label="Registered On" value={animal.registered_at?.slice?.(0, 10)} />
                            </div>
                            {animal.notes && (
                                <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(0,0,0,0.03)', borderRadius: 10, fontSize: 13, color: '#6B7280', fontStyle: 'italic', borderLeft: '3px solid #D4A017' }}>
                                    📝 {animal.notes}
                                </div>
                            )}
                        </div>

                        {/* Owner Details */}
                        <div style={S.card}>
                            <div style={S.sectionLabel}>👤 Owner Details</div>
                            <div style={S.infoGrid}>
                                <Field label="Owner Name" value={animal.owner_name} />
                                <Field label="Phone" value={animal.owner_phone} mono />
                                <Field label="Email" value={animal.owner_email} />
                                <Field label="City" value={animal.city} />
                                <Field label="District" value={animal.district} />
                                <Field label="State" value={animal.state} />
                                <Field label="Pincode" value={animal.pincode} mono />
                            </div>
                        </div>

                        {/* Location Map Embed */}
                        {(animal.city || animal.district) && (
                            <div style={S.card}>
                                <div style={S.sectionLabel}>📍 Registered Location — {[animal.city || animal.district, animal.state].filter(Boolean).join(', ')}</div>
                                <div style={{ borderRadius: 14, overflow: 'hidden', border: '1.5px solid #E5E0D8', marginBottom: 12 }}>
                                    <iframe
                                        title="Animal Location Map"
                                        width="100%"
                                        height="200"
                                        frameBorder="0"
                                        style={{ display: 'block' }}
                                        src={`https://maps.google.com/maps?q=${encodeURIComponent([animal.city || animal.district, animal.state, 'India'].filter(Boolean).join(', '))}&output=embed&z=12`}
                                        allowFullScreen
                                        loading="lazy"
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    <a href={`https://www.google.com/maps/search/${encodeURIComponent([animal.city || animal.district, animal.state, 'India'].filter(Boolean).join(', '))}`}
                                        target="_blank" rel="noreferrer"
                                        style={{ padding: '7px 14px', border: '1.5px solid #E5E0D8', borderRadius: 10, background: '#fff', color: '#1B4332', fontWeight: 700, fontSize: 12, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                        🗺 Open in Google Maps
                                    </a>
                                    <button onClick={() => navigator.clipboard.writeText([animal.city || animal.district, animal.state].filter(Boolean).join(', '))}
                                        style={{ padding: '7px 14px', border: '1.5px solid #E5E0D8', borderRadius: 10, background: '#fff', color: '#6B7280', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                                        📋 Copy Location
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* QR Code */}
                        <div style={S.card}>
                            <div style={S.sectionLabel}>📱 Animal QR Code</div>
                            {animal.qr_id ? (
                                <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
                                    {/* QR image */}
                                    <div style={{ flexShrink: 0, padding: 12, border: '2px solid #E5E0D8', borderRadius: 16, background: '#fff', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
                                        <img
                                            src={qrDownloadUrl(animal.qr_id)}
                                            alt="Animal QR Code"
                                            style={{ width: 180, height: 180, display: 'block', borderRadius: 6 }}
                                            onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
                                        />
                                        <div style={{ width: 180, height: 180, display: 'none', alignItems: 'center', justifyContent: 'center', color: '#6B7280', fontSize: 12, textAlign: 'center', padding: 8 }}>QR image not available yet</div>
                                    </div>
                                    {/* Info + actions */}
                                    <div style={{ flex: 1, minWidth: 200 }}>
                                        <div style={{ marginBottom: 8 }}>
                                            <div style={S.fieldKey}>QR Code ID</div>
                                            <code style={{ fontFamily: '"Space Mono",monospace', fontSize: 11, color: '#1B4332', wordBreak: 'break-all' }}>{animal.qr_id}</code>
                                        </div>
                                        <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16, lineHeight: 1.5 }}>
                                            Scan with any QR reader to verify this animal's identity instantly. Keep a printed copy on the animal's record.
                                        </p>
                                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                            <a
                                                href={qrDownloadUrl(animal.qr_id)}
                                                target="_blank"
                                                rel="noreferrer"
                                                style={{ padding: '9px 16px', border: '1.5px solid #E5E0D8', borderRadius: 10, background: '#fff', color: '#1B4332', fontWeight: 700, fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                            >
                                                🔍 View Full Size
                                            </a>
                                            <a
                                                href={qrDownloadUrl(animal.qr_id)}
                                                download={`${animal.animal_id}-qr.png`}
                                                style={{ padding: '9px 16px', border: 'none', borderRadius: 10, background: '#1B4332', color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                            >
                                                📥 Download QR PNG
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ color: '#6B7280', fontSize: 13, padding: '16px 0', textAlign: 'center' }}>
                                    QR code is being generated — check back shortly or refresh the page.
                                </div>
                            )}
                        </div>

                    </>
                )}

                {/* ════════════════════════ HEALTH TAB ═══════════════════════ */}
                {tab === 'health' && (
                    <div style={S.card}>
                        <div style={S.sectionLabel}>❤️ Update Health Record</div>
                        <div style={{ marginBottom: 20, padding: '12px 16px', background: 'rgba(45,106,79,0.06)', borderRadius: 12, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                            <div>
                                <div style={S.fieldKey}>Current Status</div>
                                <span style={{ fontSize: 14, fontWeight: 800, padding: '4px 12px', borderRadius: 999, background: hc.bg, color: hc.color, border: `1px solid ${hc.border}` }}>{animal.health_status?.replace('_', ' ')}</span>
                            </div>
                            {animal.last_vet_visit && <div><div style={S.fieldKey}>Last Vet Visit</div><div style={{ fontSize: 14, fontWeight: 600 }}>{animal.last_vet_visit}</div></div>}
                            {animal.notes && <div style={{ flex: 1 }}><div style={S.fieldKey}>Last Notes</div><div style={{ fontSize: 13, color: '#6B7280', fontStyle: 'italic' }}>{animal.notes}</div></div>}
                        </div>
                        <form onSubmit={submitHealth} style={{ maxWidth: 520 }}>
                            <div style={S.fg}>
                                <label style={S.lbl}>Health Status</label>
                                <select value={hf.health_status} onChange={e => setHf(f => ({ ...f, health_status: e.target.value }))} style={S.inp}>
                                    <option value="healthy">❤️ Healthy</option>
                                    <option value="sick">🏥 Sick</option>
                                    <option value="under_treatment">💊 Under Treatment</option>
                                    <option value="unknown">❓ Unknown</option>
                                </select>
                            </div>
                            <div style={S.fg}>
                                <label style={S.lbl}>Last Vet Visit</label>
                                <input type="date" value={hf.last_vet_visit} onChange={e => setHf(f => ({ ...f, last_vet_visit: e.target.value }))} style={S.inp} />
                            </div>
                            <div style={S.fg}>
                                <label style={S.lbl}>Health Notes</label>
                                <textarea rows={3} value={hf.notes} onChange={e => setHf(f => ({ ...f, notes: e.target.value }))} placeholder="Describe symptoms, treatments, observations…" style={{ ...S.inp, resize: 'vertical' }} />
                            </div>
                            <button type="submit" disabled={hBusy} style={{ padding: '11px 28px', borderRadius: 12, border: 'none', background: '#1B4332', color: '#fff', fontWeight: 800, cursor: hBusy ? 'wait' : 'pointer', fontSize: 14, fontFamily: 'inherit' }}>
                                {hBusy ? '⏳ Saving…' : '💾 Update Health Record'}
                            </button>
                        </form>
                    </div>
                )}

                {/* ════════════════════════ VACCINATION TAB ═══════════════════════ */}
                {tab === 'vaccination' && (
                    <>
                        {/* Existing records */}
                        <div style={S.card}>
                            <div style={S.sectionLabel}>💉 Vaccination History ({animal.vaccinations?.length || 0})</div>
                            <DataTable
                                cols={['Vaccine', 'Date Given', 'Next Due', 'Administered By']}
                                rows={(animal.vaccinations || []).map(v => [v.vaccine, v.date, v.next_due, v.administered_by || v.vet_name])}
                                empty="No vaccinations recorded yet."
                            />
                        </div>
                        {/* Add new */}
                        <div style={S.card}>
                            <div style={S.sectionLabel}>➕ Add New Vaccination Record</div>
                            <form onSubmit={submitVaccination} style={{ maxWidth: 520 }}>
                                <div style={S.fg}>
                                    <label style={S.lbl}>Vaccine Name *</label>
                                    <input required value={vf.vaccine} onChange={e => setVf(f => ({ ...f, vaccine: e.target.value }))} placeholder="e.g. FMD, Brucellosis, Theileriosis" style={S.inp} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div style={S.fg}>
                                        <label style={S.lbl}>Date Given</label>
                                        <input type="date" value={vf.date} onChange={e => setVf(f => ({ ...f, date: e.target.value }))} style={S.inp} />
                                    </div>
                                    <div style={S.fg}>
                                        <label style={S.lbl}>Next Due Date</label>
                                        <input type="date" value={vf.next_due} onChange={e => setVf(f => ({ ...f, next_due: e.target.value }))} style={S.inp} />
                                    </div>
                                </div>
                                <div style={S.fg}>
                                    <label style={S.lbl}>Administered By</label>
                                    <input value={vf.administered_by} onChange={e => setVf(f => ({ ...f, administered_by: e.target.value }))} placeholder="Vet name or clinic" style={S.inp} />
                                </div>
                                <button type="submit" disabled={vBusy} style={{ padding: '11px 28px', borderRadius: 12, border: 'none', background: '#1d4ed8', color: '#fff', fontWeight: 800, cursor: vBusy ? 'wait' : 'pointer', fontSize: 14, fontFamily: 'inherit' }}>
                                    {vBusy ? '⏳ Saving…' : '💉 Add Vaccination'}
                                </button>
                            </form>
                        </div>
                    </>
                )}

                {/* ════════════════════════ HISTORY TAB ═══════════════════════ */}
                {tab === 'history' && (
                    <div style={S.card}>
                        <div style={S.sectionLabel}>🔄 Ownership Transfer History ({animal.transfer_history?.length || 0})</div>
                        {(!animal.transfer_history || animal.transfer_history.length === 0) ? (
                            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                                <div style={{ fontSize: 40, marginBottom: 10 }}>📋</div>
                                <p style={{ fontWeight: 700, color: '#1B4332', marginBottom: 4 }}>No transfer history</p>
                                <p style={{ color: '#6B7280', fontSize: 13 }}>Ownership changes will appear here after transfers.</p>
                            </div>
                        ) : (
                            <div>
                                {/* Timeline view */}
                                {animal.transfer_history.map((tx, i) => (
                                    <div key={i} style={{ display: 'flex', gap: 16, paddingBottom: 20, borderLeft: i < animal.transfer_history.length - 1 ? '2px solid #E5E0D8' : 'none', paddingLeft: 20, marginLeft: 8, position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: -10, top: 0, width: 18, height: 18, borderRadius: '50%', background: '#1B4332', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 800 }}>{animal.transfer_history.length - i}</div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 800, color: '#1A1A1A', marginBottom: 4 }}>
                                                {tx.from_owner} <span style={{ color: '#6B7280', fontWeight: 400 }}>→</span> {tx.to_owner || animal.owner_name}
                                            </div>
                                            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: '#6B7280' }}>
                                                {tx.date && <span>📅 {tx.date?.slice(0, 10)}</span>}
                                                {tx.reason && <span>📌 {tx.reason}</span>}
                                                {tx.new_district && <span>📍 {tx.new_district}, {tx.new_state}</span>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {/* Current owner */}
                                <div style={{ display: 'flex', gap: 16, paddingLeft: 20, marginLeft: 8, position: 'relative' }}>
                                    <div style={{ position: 'absolute', left: -10, top: 0, width: 18, height: 18, borderRadius: '50%', background: '#D4A017', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#1f2a1f', fontWeight: 800 }}>★</div>
                                    <div>
                                        <div style={{ fontWeight: 800, color: '#1B4332' }}>{animal.owner_name} <span style={{ fontSize: 11, background: 'rgba(45,106,79,0.10)', padding: '2px 8px', borderRadius: 999, color: '#1B4332', marginLeft: 6 }}>Current Owner</span></div>
                                        <div style={{ fontSize: 13, color: '#6B7280' }}>📞 {animal.owner_phone} · 📍 {animal.district}, {animal.state}</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ════════════════════════ TRANSFER TAB ═══════════════════════ */}
                {tab === 'transfer' && (
                    <div style={S.card}>
                        <div style={S.sectionLabel}>🔁 Transfer Ownership</div>
                        <div style={{ padding: '12px 16px', background: 'rgba(212,160,23,0.10)', border: '1px solid rgba(212,160,23,0.28)', borderRadius: 12, marginBottom: 20, fontSize: 13, color: '#92400e' }}>
                            ⚠️ Transferring ownership will generate a new QR code. The old QR code will no longer be valid.
                        </div>
                        {/* Step 1 — Enter email */}
                        {tfStep === 'input' && (
                            <form onSubmit={lookupRecipient} style={{ maxWidth: 520 }}>
                                <div style={S.fg}>
                                    <label style={S.lbl}>Recipient's Registered Email * <span style={{ fontWeight: 400, color: '#6B7280' }}>(must have a SAIOMS account)</span></label>
                                    <input required type="email" value={tf.email} onChange={e => setTf(f => ({ ...f, email: e.target.value }))} placeholder="e.g. newowner@email.com" style={S.inp} />
                                </div>
                                <div style={S.fg}>
                                    <label style={S.lbl}>Recipient's Phone (optional — auto-filled from their account)</label>
                                    <input value={tf.phone} onChange={e => setTf(f => ({ ...f, phone: e.target.value }))} placeholder="10-digit phone" style={S.inp} />
                                </div>
                                <div style={S.fg}>
                                    <label style={S.lbl}>Reason for Transfer</label>
                                    <textarea rows={2} value={tf.reason} onChange={e => setTf(f => ({ ...f, reason: e.target.value }))} placeholder="Sale, gift, inheritance…" style={{ ...S.inp, resize: 'vertical' }} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div style={S.fg}>
                                        <label style={S.lbl}>Animal's New District</label>
                                        <input value={tf.new_district} onChange={e => setTf(f => ({ ...f, new_district: e.target.value }))} placeholder="District" style={S.inp} />
                                    </div>
                                    <div style={S.fg}>
                                        <label style={S.lbl}>State</label>
                                        <input value={tf.new_state} onChange={e => setTf(f => ({ ...f, new_state: e.target.value }))} style={S.inp} />
                                    </div>
                                </div>
                                <button type="submit" disabled={tBusy || !tf.email.trim()} style={{ padding: '11px 28px', borderRadius: 12, border: 'none', background: '#D4A017', color: '#1f2a1f', fontWeight: 800, cursor: tBusy ? 'wait' : 'pointer', fontSize: 14, fontFamily: 'inherit' }}>
                                    {tBusy ? 'Looking up…' : '🔍 Find Recipient →'}
                                </button>
                            </form>
                        )}

                        {/* Step 2 — Preview and confirm */}
                        {tfStep === 'preview' && tfPreview && (
                            <div style={{ maxWidth: 520 }}>
                                <div style={{ background: 'rgba(45,106,79,0.07)', border: '1.5px solid rgba(45,106,79,0.18)', borderRadius: 14, padding: '16px', marginBottom: 16 }}>
                                    <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6B7280', marginBottom: 8 }}>Recipient Found</div>
                                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                        <span style={{ fontSize: 28 }}>👤</span>
                                        <div>
                                            <div style={{ fontWeight: 700, color: '#1B4332', fontSize: 15 }}>{tfPreview.name}</div>
                                            <div style={{ fontSize: 12, color: '#6B7280' }}>📧 {tfPreview.email}</div>
                                            <div style={{ fontSize: 12, color: '#6B7280' }}>📞 {tfPreview.phone}</div>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ fontSize: 13, color: '#374151', marginBottom: 16, padding: '10px 14px', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.18)', borderRadius: 10 }}>
                                    ⚠️ <strong>This action cannot be undone.</strong> <br />
                                    <span style={{ fontSize: 12 }}>{animal.breed} (<code>{animal.animal_id}</code>) and all its records will be permanently transferred to <strong>{tfPreview.name}</strong>.</span>
                                </div>
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <button onClick={() => { setTfStep('input'); setTfPreview(null); setMsg(null) }} style={{ flex: 1, padding: '10px', border: '1.5px solid #E5E0D8', borderRadius: 12, background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#6B7280', fontFamily: 'inherit' }}>← Change</button>
                                    <button onClick={submitTransfer} disabled={tBusy} style={{ flex: 2, padding: '10px', borderRadius: 12, border: 'none', background: '#D4A017', color: '#1f2a1f', cursor: tBusy ? 'wait' : 'pointer', fontWeight: 700, fontSize: 14, fontFamily: 'inherit' }}>
                                        {tBusy ? 'Transferring…' : `✅ Confirm Transfer`}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Step 3 — Done */}
                        {tfStep === 'done' && (
                            <div style={{ textAlign: 'center', padding: '24px 0', maxWidth: 520, margin: '0 auto' }}>
                                <div style={{ fontSize: 48, marginBottom: 10 }}>✅</div>
                                <div style={{ fontWeight: 700, color: '#1B4332', fontSize: 16, marginBottom: 6 }}>Transfer Complete!</div>
                                <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>The animal and all associated records have been transferred to {tfPreview?.name}.</div>
                                <button onClick={() => { setTfStep('input'); setTf({ email: '', phone: '', reason: '', new_city: '', new_district: animal.district || '', new_state: animal.state || '' }); setTfPreview(null); setTab('info') }} style={{ padding: '9px 16px', border: '1.5px solid #E5E0D8', borderRadius: 12, background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#1B4332', fontFamily: 'inherit' }}>View Updated Info</button>
                            </div>
                        )}
                    </div>
                )}

                {/* ════════════════════════ NEARBY TAB ═══════════════════════ */}
                {tab === 'nearby' && (
                    <div style={S.card}>
                        <div style={S.sectionLabel}>🏥 Nearby Vets & Animal Shelters</div>
                        {vetsLoading ? (
                            <div style={{ textAlign: 'center', padding: '40px' }}>
                                <div style={{ width: 32, height: 32, border: '3px solid rgba(45,106,79,0.20)', borderTopColor: '#1B4332', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                                <span style={{ color: '#6B7280', fontSize: 13 }}>Searching nearby vets via OpenStreetMap…</span>
                            </div>
                        ) : vets.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6B7280', fontSize: 13 }}>
                                No nearby vets found within 15 km of {animal.city || animal.district}, {animal.state}.
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                                {vets.map((v, i) => (
                                    <div key={i} style={{ border: '1.5px solid #E5E0D8', borderRadius: 14, padding: '14px 16px', background: '#FAFAF9' }}>
                                        <div style={{ fontWeight: 800, color: '#1B4332', fontSize: 14, marginBottom: 4 }}>{v.type === 'vet' ? '🏥' : '🤝'} {v.name}</div>
                                        {v.address && <div style={{ color: '#6B7280', fontSize: 12, marginBottom: 4 }}>📍 {v.address}</div>}
                                        {v.source === 'gemini' && <div style={{ fontSize: 10, color: '#B8860B', fontWeight: 700, marginBottom: 4 }}>🤖 AI Suggested</div>}
                                        {v.phone && <div style={{ fontSize: 12, marginBottom: 4 }}>📞 <a href={`tel:${v.phone}`} style={{ color: '#1B4332', fontWeight: 700 }}>{v.phone}</a></div>}
                                        {(v.mapsUrl || v.lat) && <a href={v.mapsUrl || `https://www.google.com/maps/dir/?api=1&destination=${v.lat},${v.lon}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#D4A017', fontWeight: 700, display: 'inline-block', marginTop: 6, textDecoration: 'none' }}>🗺 Get Directions (Maps) →</a>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    )
}
