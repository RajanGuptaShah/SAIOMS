import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listAnimals, deleteAnimal, searchByTag, updateHealth, transferOwnership, lookupTransferUser } from '../services/api'
import { useAuth } from '../context/AuthContext'

// ── helpers ──────────────────────────────────────────────────────
const HEALTH_COLORS = {
    healthy: { bg: 'rgba(45,106,79,0.12)', color: '#1b4332', border: 'rgba(45,106,79,0.22)' },
    sick: { bg: 'rgba(220,38,38,0.10)', color: '#991b1b', border: 'rgba(220,38,38,0.22)' },
    under_treatment: { bg: 'rgba(212,160,23,0.12)', color: '#92400e', border: 'rgba(212,160,23,0.28)' },
    unknown: { bg: 'rgba(107,114,128,0.10)', color: '#374151', border: 'rgba(107,114,128,0.22)' },
}
const SP_EMOJI = { cattle: '🐄', buffalo: '🐃' }
const LIMIT = 12

function calcAge(dob) {
    if (!dob) return null
    const ms = Date.now() - new Date(dob).getTime()
    const yrs = Math.floor(ms / (365.25 * 24 * 3600 * 1000))
    const mos = Math.floor((ms % (365.25 * 24 * 3600 * 1000)) / (30.44 * 24 * 3600 * 1000))
    return yrs > 0 ? `${yrs}y ${mos}m` : `${mos}m`
}

function Badge({ children, style }) {
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 11, fontWeight: 700, padding: '3px 9px',
            borderRadius: 999, border: '1px solid',
            ...style,
        }}>{children}</span>
    )
}

function SectionTitle({ children }) {
    return (
        <div style={{
            fontSize: 11, fontWeight: 800, textTransform: 'uppercase',
            letterSpacing: '0.07em', color: '#6B7280', marginBottom: 8,
        }}>{children}</div>
    )
}

// ── Delete Confirmation Modal ─────────────────────────────────────
function DeleteModal({ animal, onConfirm, onCancel, busy }) {
    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }} onClick={onCancel}>
            <div style={{
                background: '#fff', borderRadius: 22, padding: '30px 28px 24px',
                maxWidth: 400, width: '100%',
                boxShadow: '0 32px 80px rgba(0,0,0,0.24)',
            }} onClick={e => e.stopPropagation()}>
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                    <div style={{ fontSize: 48, marginBottom: 10 }}>🗑️</div>
                    <h3 style={{ fontFamily: '"Playfair Display",serif', color: '#1B4332', marginBottom: 6, fontSize: 20 }}>
                        Delete Animal Record?
                    </h3>
                    <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 4 }}>
                        Permanently delete <strong>{animal.breed}</strong>
                    </p>
                    <code style={{ fontSize: 11, color: '#1B4332', background: 'rgba(45,106,79,0.09)', padding: '2px 8px', borderRadius: 6 }}>
                        {animal.animal_id}
                    </code>
                    <p style={{ color: '#C1440E', fontSize: 12, marginTop: 10, fontWeight: 700 }}>
                        ⚠️ This cannot be undone.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button
                        onClick={onCancel} disabled={busy}
                        style={{ flex: 1, padding: '10px', borderRadius: 12, border: '1.5px solid #E5E0D8', background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#6B7280' }}
                    >Cancel</button>
                    <button
                        onClick={onConfirm} disabled={busy}
                        style={{ flex: 1, padding: '10px', borderRadius: 12, border: 'none', background: '#C1440E', color: '#fff', cursor: busy ? 'wait' : 'pointer', fontWeight: 700 }}
                    >{busy ? 'Deleting…' : '🗑️ Delete'}</button>
                </div>
            </div>
        </div>
    )
}

// ── Update Drawer (Health / Vaccination / Transfer) ───────────────
function UpdateDrawer({ animal, onClose, onUpdated }) {
    const [tab, setTab] = useState('health')
    const [msg, setMsg] = useState(null)
    const [busy, setBusy] = useState(false)

    // Health form
    const [hf, setHf] = useState({ health_status: animal.health_status || 'healthy', last_vet_visit: animal.last_vet_visit || '', notes: '' })

    // Vaccination form
    const [vf, setVf] = useState({ vaccine: '', date: '', next_due: '', administered_by: '' })

    // Transfer form — 3-step: email input → preview → confirm
    const [tf, setTf] = useState({ email: '', phone: '', reason: '', new_city: '', new_district: animal.district || '', new_state: animal.state || '' })
    const [tfStep, setTfStep] = useState('input') // 'input' | 'preview' | 'done'
    const [tfPreview, setTfPreview] = useState(null) // { name, email, phone }

    const lookupRecipient = async (e) => {
        e.preventDefault(); setBusy(true); setMsg(null)
        try {
            const res = await lookupTransferUser(tf.email, tf.phone)
            setTfPreview(res.user)
            setTfStep('preview')
        } catch (err) {
            setMsg({ type: 'error', text: err.response?.data?.detail || 'User not found' })
        } finally { setBusy(false) }
    }

    const submitHealth = async (e) => {
        e.preventDefault(); setBusy(true); setMsg(null)
        try {
            await updateHealth(animal.animal_id, hf)
            setMsg({ type: 'success', text: '✅ Health record updated!' })
            onUpdated()
        } catch (err) {
            setMsg({ type: 'error', text: err.response?.data?.detail || 'Update failed' })
        } finally { setBusy(false) }
    }

    const submitVaccination = async (e) => {
        e.preventDefault(); setBusy(true); setMsg(null)
        try {
            await updateHealth(animal.animal_id, { vaccination: vf })
            setMsg({ type: 'success', text: '✅ Vaccination record added!' })
            setVf({ vaccine: '', date: '', next_due: '', administered_by: '' })
            onUpdated()
        } catch (err) {
            setMsg({ type: 'error', text: err.response?.data?.detail || 'Save failed' })
        } finally { setBusy(false) }
    }

    const submitTransfer = async () => {
        setBusy(true); setMsg(null)
        try {
            const res = await transferOwnership({
                animal_id: animal.animal_id,
                new_owner_email: tfPreview.email,
                new_owner_phone: tf.phone || tfPreview.phone,
                reason: tf.reason,
                new_city: tf.new_city,
                new_district: tf.new_district,
                new_state: tf.new_state,
            })
            setMsg({ type: 'success', text: `✅ Transferred to ${res.new_owner?.name || tfPreview.name}! The animal now appears in their dashboard.` })
            setTfStep('done')
            onUpdated()
        } catch (err) {
            setMsg({ type: 'error', text: err.response?.data?.detail || 'Transfer failed' })
            setTfStep('preview')
        } finally { setBusy(false) }
    }

    const inp = (style) => ({
        padding: '9px 12px', border: '1.5px solid #E5E0D8', borderRadius: 10,
        fontSize: 14, width: '100%', background: '#FAFAF9', outline: 'none',
        fontFamily: 'inherit', color: '#1A1A1A',
        ...style,
    })
    const lbl = { fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, display: 'block' }
    const fg = { marginBottom: 12 }

    const tabs = [
        { id: 'health', label: '❤️ Health' },
        { id: 'vaccination', label: '💉 Vaccination' },
        { id: 'transfer', label: '🔄 Transfer' },
    ]

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            padding: '16px',
        }} onClick={onClose}>
            <div style={{
                background: '#fff', borderRadius: 22, padding: '24px 24px 28px',
                width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto',
                boxShadow: '0 32px 80px rgba(0,0,0,0.24)',
            }} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                    <div>
                        <div style={{ fontFamily: '"Playfair Display",serif', fontSize: 18, fontWeight: 800, color: '#1B4332' }}>
                            Update Record
                        </div>
                        <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                            {SP_EMOJI[animal.species]} {animal.breed} · <code style={{ fontSize: 11 }}>{animal.animal_id}</code>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#6B7280', lineHeight: 1 }}>✕</button>
                </div>

                {/* Tab bar */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 20, background: 'rgba(45,106,79,0.06)', borderRadius: 12, padding: 4 }}>
                    {tabs.map(t => (
                        <button key={t.id} onClick={() => { setTab(t.id); setMsg(null) }}
                            style={{
                                flex: 1, padding: '7px 6px', border: 'none', borderRadius: 9,
                                cursor: 'pointer', fontSize: 12, fontWeight: 700, transition: 'all 0.2s',
                                background: tab === t.id ? '#fff' : 'transparent',
                                color: tab === t.id ? '#1B4332' : '#6B7280',
                                boxShadow: tab === t.id ? '0 2px 8px rgba(0,0,0,0.10)' : 'none',
                            }}>{t.label}</button>
                    ))}
                </div>

                {/* Msg */}
                {msg && (
                    <div style={{
                        padding: '10px 14px', borderRadius: 10, marginBottom: 14, fontSize: 13, fontWeight: 600,
                        background: msg.type === 'success' ? 'rgba(45,106,79,0.10)' : 'rgba(220,38,38,0.10)',
                        color: msg.type === 'success' ? '#1B4332' : '#991b1b',
                        border: `1px solid ${msg.type === 'success' ? 'rgba(45,106,79,0.20)' : 'rgba(220,38,38,0.20)'}`,
                    }}>{msg.text}</div>
                )}

                {/* ── Health Tab ── */}
                {tab === 'health' && (
                    <form onSubmit={submitHealth}>
                        <div style={fg}>
                            <label style={lbl}>Health Status</label>
                            <select value={hf.health_status} onChange={e => setHf(f => ({ ...f, health_status: e.target.value }))} style={inp()}>
                                <option value="healthy">❤️ Healthy</option>
                                <option value="sick">🏥 Sick</option>
                                <option value="under_treatment">💊 Under Treatment</option>
                            </select>
                        </div>
                        <div style={fg}>
                            <label style={lbl}>Last Vet Visit</label>
                            <input type="date" value={hf.last_vet_visit} onChange={e => setHf(f => ({ ...f, last_vet_visit: e.target.value }))} style={inp()} />
                        </div>
                        <div style={fg}>
                            <label style={lbl}>Notes</label>
                            <textarea rows={3} value={hf.notes} onChange={e => setHf(f => ({ ...f, notes: e.target.value }))} placeholder="Add health notes…" style={{ ...inp(), resize: 'vertical' }} />
                        </div>
                        <button type="submit" disabled={busy} style={{ width: '100%', padding: '11px', borderRadius: 12, border: 'none', background: '#1B4332', color: '#fff', fontWeight: 700, cursor: busy ? 'wait' : 'pointer', fontSize: 14 }}>
                            {busy ? 'Saving…' : '💾 Update Health Record'}
                        </button>
                    </form>
                )}

                {/* ── Vaccination Tab ── */}
                {tab === 'vaccination' && (
                    <form onSubmit={submitVaccination}>
                        <div style={fg}>
                            <label style={lbl}>Vaccine Name *</label>
                            <input required value={vf.vaccine} onChange={e => setVf(f => ({ ...f, vaccine: e.target.value }))} placeholder="e.g. FMD, Brucellosis" style={inp()} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                            <div>
                                <label style={lbl}>Date Given</label>
                                <input type="date" value={vf.date} onChange={e => setVf(f => ({ ...f, date: e.target.value }))} style={inp()} />
                            </div>
                            <div>
                                <label style={lbl}>Next Due</label>
                                <input type="date" value={vf.next_due} onChange={e => setVf(f => ({ ...f, next_due: e.target.value }))} style={inp()} />
                            </div>
                        </div>
                        <div style={fg}>
                            <label style={lbl}>Administered By</label>
                            <input value={vf.administered_by} onChange={e => setVf(f => ({ ...f, administered_by: e.target.value }))} placeholder="Vet name or clinic" style={inp()} />
                        </div>
                        {animal.vaccinations?.length > 0 && (
                            <div style={{ marginBottom: 14 }}>
                                <SectionTitle>Previous Vaccinations</SectionTitle>
                                {animal.vaccinations.map((v, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F0EDE8', fontSize: 13 }}>
                                        <span style={{ fontWeight: 700 }}>{v.vaccine}</span>
                                        <span style={{ color: '#6B7280' }}>{v.date}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        <button type="submit" disabled={busy} style={{ width: '100%', padding: '11px', borderRadius: 12, border: 'none', background: '#1d4ed8', color: '#fff', fontWeight: 700, cursor: busy ? 'wait' : 'pointer', fontSize: 14 }}>
                            {busy ? 'Saving…' : '💉 Add Vaccination Record'}
                        </button>
                    </form>
                )}

                {/* ── Transfer Tab ── */}
                {tab === 'transfer' && (
                    <div>
                        {/* Animal being transferred */}
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 14px', background: 'rgba(45,106,79,0.07)', borderRadius: 12, marginBottom: 16, border: '1.5px solid rgba(45,106,79,0.15)' }}>
                            <span style={{ fontSize: 28 }}>{SP_EMOJI[animal.species] || '🐾'}</span>
                            <div>
                                <div style={{ fontWeight: 700, color: '#1B4332', fontSize: 15 }}>{animal.breed}</div>
                                <div style={{ fontSize: 12, color: '#6B7280' }}><code>{animal.animal_id}</code> · Owner: {animal.owner_name}</div>
                                {animal.vaccinations?.length > 0 && <div style={{ fontSize: 11, color: '#1d4ed8', marginTop: 2 }}>💉 {animal.vaccinations.length} vaccination records will transfer</div>}
                            </div>
                        </div>

                        <div style={{ padding: '10px 14px', background: 'rgba(212,160,23,0.09)', borderRadius: 10, marginBottom: 16, fontSize: 12, color: '#92400e', border: '1px solid rgba(212,160,23,0.25)' }}>
                            ⚠️ Transferring ownership moves this animal (with all records) to the recipient's SAIOMS account. A new QR code is generated.
                        </div>

                        {msg && (
                            <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 14, fontSize: 13, fontWeight: 600, background: msg.type === 'success' ? 'rgba(45,106,79,0.10)' : 'rgba(220,38,38,0.10)', color: msg.type === 'success' ? '#1B4332' : '#991b1b', border: `1px solid ${msg.type === 'success' ? 'rgba(45,106,79,0.20)' : 'rgba(220,38,38,0.20)'}` }}>{msg.text}</div>
                        )}

                        {/* Step 1 — Enter email */}
                        {tfStep === 'input' && (
                            <form onSubmit={lookupRecipient}>
                                <div style={fg}>
                                    <label style={lbl}>Recipient's Registered Email * <span style={{ fontWeight: 400, color: '#6B7280' }}>(must have a SAIOMS account)</span></label>
                                    <input required type="email" value={tf.email} onChange={e => setTf(f => ({ ...f, email: e.target.value }))} placeholder="e.g. newowner@email.com" style={inp()} />
                                </div>
                                <div style={fg}>
                                    <label style={lbl}>Recipient's Phone (optional — auto-filled from their account)</label>
                                    <input value={tf.phone} onChange={e => setTf(f => ({ ...f, phone: e.target.value }))} placeholder="10-digit phone" style={inp()} />
                                </div>
                                <div style={fg}>
                                    <label style={lbl}>Reason for Transfer</label>
                                    <textarea rows={2} value={tf.reason} onChange={e => setTf(f => ({ ...f, reason: e.target.value }))} placeholder="Sale, gift, inheritance…" style={{ ...inp(), resize: 'vertical' }} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                                    <div><label style={lbl}>Animal's New City</label><input value={tf.new_city} onChange={e => setTf(f => ({ ...f, new_city: e.target.value }))} placeholder="City (optional)" style={inp()} /></div>
                                    <div><label style={lbl}>State</label><input value={tf.new_state} onChange={e => setTf(f => ({ ...f, new_state: e.target.value }))} style={inp()} /></div>
                                </div>
                                <button type="submit" disabled={busy || !tf.email.trim()} style={{ width: '100%', padding: '11px', borderRadius: 12, border: 'none', background: '#1B4332', color: '#fff', fontWeight: 700, cursor: busy ? 'wait' : 'pointer', fontSize: 14 }}>
                                    {busy ? 'Looking up…' : '🔍 Find Recipient →'}
                                </button>
                            </form>
                        )}

                        {/* Step 2 — Preview and confirm */}
                        {tfStep === 'preview' && tfPreview && (
                            <div>
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
                                    <button onClick={submitTransfer} disabled={busy} style={{ flex: 2, padding: '10px', borderRadius: 12, border: 'none', background: '#D4A017', color: '#1f2a1f', cursor: busy ? 'wait' : 'pointer', fontWeight: 700, fontSize: 14, fontFamily: 'inherit' }}>
                                        {busy ? 'Transferring…' : `✅ Confirm Transfer to ${tfPreview.name}`}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Step 3 — Done */}
                        {tfStep === 'done' && (
                            <div style={{ textAlign: 'center', padding: '24px 0' }}>
                                <div style={{ fontSize: 48, marginBottom: 10 }}>✅</div>
                                <div style={{ fontWeight: 700, color: '#1B4332', fontSize: 16, marginBottom: 6 }}>Transfer Complete!</div>
                                <div style={{ fontSize: 13, color: '#6B7280' }}>The animal now appears in {tfPreview?.name}'s dashboard.</div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

// ── Animal Card ───────────────────────────────────────────────────
function AnimalCard({ animal: a, onDeleted, onRefresh, currentUser }) {
    const [open, setOpen] = useState(false)
    const [showDel, setShowDel] = useState(false)
    const [showUpdate, setShowUpdate] = useState(false)
    const [delBusy, setDelBusy] = useState(false)
    const [delErr, setDelErr] = useState(null)

    const hc = HEALTH_COLORS[a.health_status] || HEALTH_COLORS.unknown
    const age = calcAge(a.dob)
    const vacCount = a.vaccinations?.length || 0
    const txCount = a.transfer_history?.length || 0
    const isOwner = currentUser && a.owner_user_id === currentUser._id

    const handleDelete = async () => {
        setDelBusy(true); setDelErr(null)
        try {
            await deleteAnimal(a.animal_id)
            setShowDel(false)
            onDeleted(a.animal_id)
        } catch (err) {
            setDelErr(err.response?.data?.detail || 'Delete failed')
            setDelBusy(false)
        }
    }

    return (
        <>
            {showDel && <DeleteModal animal={a} onConfirm={handleDelete} onCancel={() => { setShowDel(false); setDelErr(null) }} busy={delBusy} />}
            {showUpdate && <UpdateDrawer animal={a} onClose={() => setShowUpdate(false)} onUpdated={() => { setShowUpdate(false); onRefresh() }} />}

            <div style={{
                background: '#fff',
                border: open ? '1.5px solid rgba(45,106,79,0.25)' : '1.5px solid #E5E0D8',
                borderRadius: 20, padding: '16px 16px 14px',
                boxShadow: open ? '0 10px 36px rgba(27,67,50,0.12)' : '0 2px 12px rgba(27,67,50,0.06)',
                transition: 'all 0.2s',
            }}>
                {/* Top row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(45,106,79,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
                            {SP_EMOJI[a.species] || '🐾'}
                        </div>
                        <div>
                            <div style={{ fontFamily: '"Playfair Display",serif', fontSize: 17, fontWeight: 800, color: '#1A1A1A' }}>{a.breed}</div>
                            <div style={{ fontSize: 11, color: '#6B7280' }}>👤 {a.owner_name}</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <code style={{ fontFamily: '"Space Mono",monospace', fontSize: 10, fontWeight: 700, color: '#1B4332', background: 'rgba(45,106,79,0.09)', border: '1px solid rgba(45,106,79,0.16)', borderRadius: 999, padding: '3px 8px', whiteSpace: 'nowrap' }}>
                            {a.animal_id}
                        </code>
                        {isOwner && (
                            <button
                                onClick={() => setShowDel(true)}
                                title="Delete this animal"
                                style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(193,68,14,0.20)', background: 'rgba(193,68,14,0.08)', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}
                            >🗑</button>
                        )}
                    </div>
                </div>

                {/* Location */}
                <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>
                    📍 {[a.city || a.district, a.district, a.state].filter(Boolean).join(', ')}
                </div>

                {/* Badges */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
                    {!isOwner && <Badge style={{ background: 'rgba(212,160,23,0.15)', color: '#92400e', borderColor: 'rgba(212,160,23,0.35)', fontSize: 10 }}>🔄 Transferred to {a.owner_name.split(' ')[0]}</Badge>}
                    <Badge style={{ background: hc.bg, color: hc.color, borderColor: hc.border }}>
                        {a.health_status === 'healthy' ? '❤️' : '🏥'} {a.health_status?.replace('_', ' ')}
                    </Badge>
                    {a.gender && <Badge style={{ background: 'rgba(107,114,128,0.08)', color: '#374151', borderColor: 'rgba(107,114,128,0.20)', textTransform: 'capitalize' }}>{a.gender}</Badge>}
                    {age && <Badge style={{ background: 'rgba(59,130,246,0.10)', color: '#1d4ed8', borderColor: 'rgba(59,130,246,0.22)' }}>🎂 {age}</Badge>}
                    {a.ear_tag && <Badge style={{ background: 'rgba(45,106,79,0.09)', color: '#1B4332', borderColor: 'rgba(45,106,79,0.20)' }}>🏷 {a.ear_tag}</Badge>}
                    {vacCount > 0 && <Badge style={{ background: 'rgba(59,130,246,0.08)', color: '#1d4ed8', borderColor: 'rgba(59,130,246,0.18)' }}>💉 {vacCount}</Badge>}
                </div>

                {/* View Details toggle */}
                <button
                    type="button"
                    onClick={() => setOpen(v => !v)}
                    style={{
                        width: '100%', border: '1px solid #E5E0D8', borderRadius: 12,
                        background: open ? 'rgba(45,106,79,0.06)' : 'rgba(27,67,50,0.03)',
                        cursor: 'pointer', padding: '8px 14px', display: 'flex',
                        justifyContent: 'space-between', alignItems: 'center',
                        fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
                        color: '#1B4332', transition: 'background 0.2s',
                    }}
                >
                    <span>{open ? '▴ Hide Details' : '▾ View Details'}</span>
                    <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 500 }}>
                        {vacCount > 0 ? `${vacCount} vaccinations` : ''} {txCount > 0 ? `· ${txCount} transfers` : ''}
                    </span>
                </button>

                {/* ── Expanded Details ────────────────────────── */}
                {open && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #F0EDE8' }}>
                        {/* Info grid */}
                        <SectionTitle>Animal Information</SectionTitle>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', marginBottom: 16 }}>
                            {[
                                ['Species', a.species],
                                ['Date of Birth', a.dob],
                                ['Age', age],
                                ['Weight', a.weight_kg ? `${a.weight_kg} kg` : null],
                                ['Last Vet Visit', a.last_vet_visit],
                                ['Owner Phone', a.owner_phone],
                                ['Pincode', a.pincode],
                                ['Colour / Marks', a.color_markings],
                            ].filter(([, v]) => v).map(([k, v]) => (
                                <div key={k}>
                                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#6B7280', letterSpacing: '0.06em', marginBottom: 2 }}>{k}</div>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', textTransform: 'capitalize' }}>{v}</div>
                                </div>
                            ))}
                        </div>

                        {/* Notes */}
                        {a.notes && (
                            <div style={{ background: 'rgba(0,0,0,0.03)', borderRadius: 10, padding: '8px 12px', fontSize: 13, color: '#6B7280', fontStyle: 'italic', marginBottom: 14 }}>
                                📝 {a.notes}
                            </div>
                        )}

                        {/* Vaccinations */}
                        {vacCount > 0 && (
                            <div style={{ marginBottom: 14 }}>
                                <SectionTitle>💉 Vaccinations ({vacCount})</SectionTitle>
                                {a.vaccinations.map((v, i) => (
                                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, padding: '6px 0', borderBottom: '1px solid #F0EDE8', fontSize: 12 }}>
                                        <span style={{ fontWeight: 700, color: '#1d4ed8' }}>{v.vaccine}</span>
                                        <span style={{ color: '#6B7280' }}>{v.date || '—'}</span>
                                        <span style={{ color: '#6B7280' }}>Due: {v.next_due || '—'}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Transfer history */}
                        {txCount > 0 && (
                            <div style={{ marginBottom: 14 }}>
                                <SectionTitle>🔄 Ownership History ({txCount})</SectionTitle>
                                {a.transfer_history.map((t, i) => (
                                    <div key={i} style={{ fontSize: 12, padding: '5px 0', borderBottom: '1px solid #F0EDE8', color: '#6B7280' }}>
                                        <strong style={{ color: '#1A1A1A' }}>{t.from_owner}</strong> → {a.owner_name}
                                        {t.date ? ` · ${t.date?.slice(0, 10)}` : ''}
                                        {t.reason ? ` · ${t.reason}` : ''}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Error if delete failed */}
                        {delErr && <div style={{ color: '#C1440E', fontSize: 12, marginBottom: 10 }}>⚠️ {delErr}</div>}

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                            {isOwner && (
                                <button
                                    type="button"
                                    onClick={() => setShowUpdate(true)}
                                    style={{ flex: 1, minWidth: 130, padding: '9px 14px', border: '1.5px solid rgba(45,106,79,0.25)', borderRadius: 12, background: 'rgba(45,106,79,0.07)', color: '#1B4332', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}
                                >✏️ Update Record</button>
                            )}
                            <Link to={`/animal/${a.animal_id}`}
                                style={{ flex: 1, minWidth: 130, padding: '9px 14px', border: '1.5px solid rgba(45,106,79,0.30)', borderRadius: 12, background: '#1B4332', color: '#fff', fontWeight: 700, fontSize: 13, textAlign: 'center', textDecoration: 'none' }}
                            >📋 Full Profile →</Link>
                            {isOwner && (
                                <button
                                    type="button"
                                    onClick={() => setShowDel(true)}
                                    style={{ padding: '9px 14px', border: '1.5px solid rgba(193,68,14,0.25)', borderRadius: 12, background: 'rgba(193,68,14,0.08)', color: '#C1440E', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}
                                >🗑️ Delete</button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    )
}

// ── Tag Search ────────────────────────────────────────────────────
function TagSearch() {
    const [tag, setTag] = useState('')
    const [result, setResult] = useState(null)
    const [err, setErr] = useState(null)
    const [busy, setBusy] = useState(false)

    const doSearch = async (e) => {
        e.preventDefault()
        if (!tag.trim()) return
        setBusy(true); setErr(null); setResult(null)
        try { setResult(await searchByTag(tag.trim().toUpperCase())) }
        catch { setErr(`No animal found with ID "${tag.trim().toUpperCase()}"`) }
        finally { setBusy(false) }
    }

    return (
        <div style={{ background: 'rgba(212,160,23,0.05)', border: '1.5px solid rgba(212,160,23,0.22)', borderRadius: 18, padding: '16px 18px', marginBottom: 24 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#1B4332', marginBottom: 10 }}>🏷 Search Animal by Tag ID</div>
            <form onSubmit={doSearch} style={{ display: 'flex', gap: 8 }}>
                <input
                    style={{ flex: 1, padding: '9px 12px', border: '1.5px solid #E5E0D8', borderRadius: 10, fontSize: 13, fontFamily: '"Space Mono",monospace', textTransform: 'uppercase', letterSpacing: '0.04em' }}
                    placeholder="e.g. BUFFALO-SUR-A159"
                    value={tag} onChange={e => { setTag(e.target.value); setResult(null); setErr(null) }}
                />
                <button type="submit" disabled={busy || !tag.trim()}
                    style={{ padding: '9px 18px', border: 'none', borderRadius: 10, background: '#D4A017', color: '#1f2a1f', fontWeight: 800, cursor: busy ? 'wait' : 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
                    {busy ? '…' : '🔍'}
                </button>
                {(result || err) && <button type="button" onClick={() => { setTag(''); setResult(null); setErr(null) }}
                    style={{ padding: '9px 12px', border: '1px solid #E5E0D8', borderRadius: 10, background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>}
            </form>
            {err && <div style={{ marginTop: 10, color: '#991b1b', fontSize: 13, fontWeight: 600 }}>⚠️ {err}</div>}
            {result && (
                <div style={{ marginTop: 12, padding: '12px 14px', background: 'rgba(45,106,79,0.07)', border: '1.5px solid rgba(45,106,79,0.18)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 34 }}>{SP_EMOJI[result.species] || '🐾'}</div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, color: '#1B4332', fontSize: 16 }}>{result.breed}</div>
                        <div style={{ fontSize: 12, color: '#6B7280' }}>👤 {result.owner_name} · {[result.city, result.district, result.state].filter(Boolean).join(', ')}</div>
                    </div>
                    <Link to={`/animal/${result.animal_id}`} style={{ padding: '8px 14px', background: '#1B4332', color: '#fff', borderRadius: 10, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
                        📋 View Profile →
                    </Link>
                </div>
            )}
        </div>
    )
}

// ── Main Dashboard ────────────────────────────────────────────────
export default function Dashboard() {
    const { user } = useAuth()
    const [animals, setAnimals] = useState([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [filters, setFilters] = useState({ breed: '', species: '', health_status: '' })

    const fetchAnimals = () => {
        setLoading(true); setError(null)
        const p = { page, limit: LIMIT }
        if (filters.breed) p.breed = filters.breed
        if (filters.species) p.species = filters.species
        if (filters.health_status) p.health_status = filters.health_status
        listAnimals(p)
            .then(d => { setAnimals(d.animals || d); setTotal(d.total || d.length || 0) })
            .catch(() => setError('Could not load animals. Is the backend running?'))
            .finally(() => setLoading(false))
    }

    useEffect(fetchAnimals, [page, filters])

    const handleDeleted = (id) => { setAnimals(prev => prev.filter(a => a.animal_id !== id)); setTotal(t => Math.max(0, t - 1)) }
    const clear = () => { setFilters({ breed: '', species: '', health_status: '' }); setPage(1) }
    const totalPages = Math.ceil(total / LIMIT)

    // counters for stats
    const healthy = animals.filter(a => a.health_status === 'healthy').length
    const attention = animals.filter(a => a.health_status !== 'healthy').length
    const buffalo = animals.filter(a => a.species === 'buffalo').length

    const statCard = (icon, num, label, color) => (
        <div style={{ background: '#fff', border: '1.5px solid #E5E0D8', borderRadius: 18, padding: '18px 20px', boxShadow: '0 2px 12px rgba(27,67,50,0.06)', display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{icon}</div>
            <div>
                <div style={{ fontSize: 26, fontWeight: 900, color: '#1A1A1A', lineHeight: 1 }}>{num}</div>
                <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{label}</div>
            </div>
        </div>
    )

    return (
        <div style={{ paddingTop: 'calc(var(--nav-h) + 32px)', paddingBottom: 60, minHeight: '100vh', background: '#FAF7F0' }}>
            <div style={{ width: 'min(1200px, calc(100% - 40px))', margin: '0 auto' }}>

                {/* Page header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
                    <div>
                        <h1 style={{ fontFamily: '"Playfair Display",serif', fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 800, color: '#1B4332', marginBottom: 4 }}>🐄 My Animal Registry</h1>
                        <p style={{ color: '#6B7280', fontSize: 14 }}>{total > 0 ? `${total} animals in your registry` : 'No animals yet — register your first one'}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <Link to="/scan-qr" style={{ padding: '9px 16px', border: '1.5px solid #E5E0D8', borderRadius: 12, background: '#fff', color: '#1B4332', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>📷 Scan QR</Link>
                        <Link to="/register" style={{ padding: '9px 18px', border: 'none', borderRadius: 12, background: '#D4A017', color: '#1f2a1f', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>➕ Register Animal</Link>
                    </div>
                </div>

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 28 }}>
                    {statCard('📋', total, 'Total Registered', 'rgba(45,106,79,0.10)')}
                    {statCard('❤️', healthy, 'Healthy', 'rgba(45,106,79,0.12)')}
                    {statCard('🏥', attention, 'Need Attention', 'rgba(193,68,14,0.10)')}
                    {statCard('🐃', buffalo, 'Buffalo', 'rgba(59,130,246,0.10)')}
                </div>

                {/* Tag Search */}
                <TagSearch />

                {/* Filters */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                    <input
                        style={{ padding: '9px 12px', border: '1.5px solid #E5E0D8', borderRadius: 10, fontSize: 13, maxWidth: 210, background: '#fff' }}
                        placeholder="🔍 Search breed…"
                        value={filters.breed} onChange={e => { setFilters(f => ({ ...f, breed: e.target.value })); setPage(1) }}
                    />
                    <select style={{ padding: '9px 12px', border: '1.5px solid #E5E0D8', borderRadius: 10, fontSize: 13, background: '#fff', maxWidth: 160 }}
                        value={filters.species} onChange={e => { setFilters(f => ({ ...f, species: e.target.value })); setPage(1) }}>
                        <option value="">All Species</option>
                        <option value="cattle">🐄 Cattle</option>
                        <option value="buffalo">🐃 Buffalo</option>
                    </select>
                    <select style={{ padding: '9px 12px', border: '1.5px solid #E5E0D8', borderRadius: 10, fontSize: 13, background: '#fff', maxWidth: 180 }}
                        value={filters.health_status} onChange={e => { setFilters(f => ({ ...f, health_status: e.target.value })); setPage(1) }}>
                        <option value="">All Health</option>
                        <option value="healthy">❤️ Healthy</option>
                        <option value="sick">🏥 Sick</option>
                        <option value="under_treatment">💊 Under Treatment</option>
                    </select>
                    {(filters.breed || filters.species || filters.health_status) && (
                        <button onClick={clear} style={{ padding: '9px 14px', border: '1px solid #E5E0D8', borderRadius: 10, background: '#fff', cursor: 'pointer', fontSize: 13, color: '#6B7280', fontFamily: 'inherit' }}>✕ Clear</button>
                    )}
                </div>

                {/* Loading / Error / Empty */}
                {loading && (
                    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                        <div style={{ width: 36, height: 36, border: '3px solid rgba(45,106,79,0.20)', borderTopColor: '#1B4332', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                        <span style={{ color: '#6B7280', fontSize: 14 }}>Loading animals…</span>
                    </div>
                )}
                {error && <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.20)', borderRadius: 12, padding: '12px 16px', color: '#991b1b', fontSize: 14, marginBottom: 20 }}>⚠️ {error}</div>}
                {!loading && !error && animals.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
                        <div style={{ fontSize: 56, marginBottom: 12 }}>🐾</div>
                        <p style={{ fontWeight: 700, color: '#1B4332', marginBottom: 6 }}>No animals found</p>
                        <p style={{ color: '#6B7280', marginBottom: 20, fontSize: 14 }}>Register your first animal or adjust filters</p>
                        <Link to="/register" style={{ padding: '11px 24px', background: '#D4A017', color: '#1f2a1f', borderRadius: 14, fontWeight: 800, textDecoration: 'none' }}>➕ Register First Animal</Link>
                    </div>
                )}

                {/* Grid */}
                {!loading && !error && animals.length > 0 && (
                    <>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                            {animals.map(a => <AnimalCard key={a.animal_id} animal={a} onDeleted={handleDeleted} onRefresh={fetchAnimals} currentUser={user} />)}
                        </div>

                        {totalPages > 1 && (
                            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 32 }}>
                                <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ padding: '8px 16px', border: '1.5px solid #E5E0D8', borderRadius: 10, background: '#fff', cursor: page === 1 ? 'default' : 'pointer', fontFamily: 'inherit' }}>‹ Prev</button>
                                {Array.from({ length: totalPages }, (_, i) => i + 1).slice(Math.max(0, page - 3), Math.min(totalPages, page + 2)).map(p => (
                                    <button key={p} onClick={() => setPage(p)} style={{ width: 36, height: 36, border: '1.5px solid', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit', borderColor: page === p ? '#1B4332' : '#E5E0D8', background: page === p ? '#1B4332' : '#fff', color: page === p ? '#fff' : '#1A1A1A' }}>{p}</button>
                                ))}
                                <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: '8px 16px', border: '1.5px solid #E5E0D8', borderRadius: 10, background: '#fff', cursor: page === totalPages ? 'default' : 'pointer', fontFamily: 'inherit' }}>Next ›</button>
                            </div>
                        )}
                    </>
                )}
            </div>

            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
    )
}
