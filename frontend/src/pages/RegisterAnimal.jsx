import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { registerAnimal } from '../services/api'

const INITIAL = {
    owner_name: '', owner_phone: '', owner_email: '',
    pincode: '', city: '', district: '', state: '',
    species: 'cattle', breed: '', gender: 'unknown',
    dob: '', weight_kg: '', ear_tag: '',
    health_status: 'healthy', notes: '',
}

const CATTLE_BREEDS = ['Gir', 'Sahiwal', 'Kankrej', 'Tharparkar', 'Red Sindhi', 'Ongole', 'Hariana', 'Rathi', 'Malvi', 'Nagori']
const BUFFALO_BREEDS = ['Murrah', 'Surti', 'Jaffarabadi', 'Nili-Ravi', 'Mehsana', 'Nagpuri', 'Pandharpuri', 'Bhadawari', 'Toda', 'Chilika']

export default function RegisterAnimal() {
    const [form, setForm] = useState(INITIAL)
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState(null)
    const [error, setError] = useState(null)
    const navigate = useNavigate()

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
    const breedList = form.species === 'cattle' ? CATTLE_BREEDS : BUFFALO_BREEDS

    const handleSubmit = async e => {
        e.preventDefault()
        setError(null); setResult(null); setLoading(true)
        try {
            const body = { ...form }
            if (body.weight_kg) body.weight_kg = parseFloat(body.weight_kg)
            else delete body.weight_kg
            if (!body.owner_email) delete body.owner_email
            const data = await registerAnimal(body)
            setResult(data)
        } catch (err) {
            setError(err.response?.data?.detail || err.message || 'Registration failed. Is the backend running?')
        } finally { setLoading(false) }
    }

    /* ── Success screen ─── */
    if (result) return (
        <div className="page-wrap">
            <div className="container" style={{ maxWidth: 620 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
                    <h1 className="page-title">✅ Animal Registered!</h1>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => { setResult(null); setForm(INITIAL) }}>➕ Register Another</button>
                    </div>
                </div>

                {/* Animal ID callout */}
                <div style={{
                    background: 'linear-gradient(135deg, rgba(45,106,79,0.10), rgba(45,106,79,0.04))',
                    border: '1.5px solid rgba(45,106,79,0.22)',
                    borderRadius: 18, padding: '18px 22px', marginBottom: 20,
                    display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
                }}>
                    <div style={{ fontSize: 52 }}>{form.species === 'buffalo' ? '🐃' : '🐄'}</div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: '"Playfair Display",serif', fontSize: 22, fontWeight: 800, color: 'var(--primary)', marginBottom: 4 }}>
                            {result.breed || form.breed}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'capitalize' }}>{form.species} · {form.gender}</div>
                    </div>
                </div>

                {/* ID + QR details */}
                <div style={{ background: '#fff', border: '1.5px solid var(--border)', borderRadius: 20, padding: '20px 22px', marginBottom: 20, boxShadow: '0 4px 18px rgba(27,67,50,0.08)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px', marginBottom: 16 }}>
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.06em', marginBottom: 4 }}>Animal Tag ID</div>
                            <code style={{ fontFamily: '"Space Mono",monospace', fontSize: 13, fontWeight: 700, color: 'var(--primary)', background: 'rgba(45,106,79,0.09)', padding: '4px 10px', borderRadius: 8, display: 'inline-block' }}>{result.animal_id}</code>
                        </div>
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.06em', marginBottom: 4 }}>Owner</div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--dark)' }}>{form.owner_name}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.06em', marginBottom: 4 }}>QR Code ID</div>
                            <code style={{ fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--muted)', wordBreak: 'break-all' }}>{result.qr_id || '—'}</code>
                        </div>
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.06em', marginBottom: 4 }}>Location</div>
                            <div style={{ fontSize: 13, color: 'var(--dark)' }}>{form.district}, {form.state}</div>
                        </div>
                    </div>

                    {result.qr_url ? (
                        <div style={{ textAlign: 'center', padding: '16px 0', borderTop: '1px solid var(--border)' }}>
                            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12, fontWeight: 600 }}>📲 Animal QR Code — scan to verify identity</div>
                            <img
                                src={result.qr_url}
                                alt="Animal QR Code"
                                style={{ width: 200, height: 200, border: '2px solid var(--border)', borderRadius: 12, display: 'block', margin: '0 auto 12px' }}
                            />
                            <a href={result.qr_url} download className="btn btn-ghost btn-sm">📥 Download QR PNG</a>
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '12px 0', borderTop: '1px solid var(--border)', color: 'var(--muted)', fontSize: 13 }}>
                            QR code is being generated… check the animal profile shortly.
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <button className="btn btn-green btn-lg" onClick={() => navigate(`/animal/${result.animal_id}`)}>
                        📋 View Full Profile →
                    </button>
                    <button className="btn btn-ghost" onClick={() => navigate('/dashboard')}>
                        📊 Go to Dashboard
                    </button>
                </div>

            </div>
        </div>
    )

    /* ── Form ─── */
    return (
        <div className="page-wrap">
            <div className="container" style={{ maxWidth: 780 }}>
                <div className="page-header reveal">
                    <div>
                        <h1 className="page-title">➕ Register Animal</h1>
                        <p className="page-subtitle">Add a new animal to the SAIOMS digital registry with an encrypted QR identity</p>
                    </div>
                    <Link to="/dashboard" className="btn btn-ghost btn-sm">← Dashboard</Link>
                </div>

                <form onSubmit={handleSubmit}>
                    {/* Owner */}
                    <div className="card reveal" style={{ marginBottom: 22 }}>
                        <div className="card-body">
                            <div className="sec-head">👤 Owner Information</div>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Owner Name *</label>
                                    <input required className="form-input" value={form.owner_name} onChange={e => set('owner_name', e.target.value)} placeholder="e.g. Ramesh Patel" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Phone Number *</label>
                                    <input required className="form-input" value={form.owner_phone} onChange={e => set('owner_phone', e.target.value)} placeholder="+91 98765 43210" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Email (optional)</label>
                                    <input type="email" className="form-input" value={form.owner_email} onChange={e => set('owner_email', e.target.value)} placeholder="owner@email.com" />
                                </div>
                            </div>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">PIN Code *</label>
                                    <input required className="form-input" value={form.pincode} onChange={e => set('pincode', e.target.value)} placeholder="e.g. 388001" maxLength={6} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">City / Town *</label>
                                    <input required className="form-input" value={form.city} onChange={e => set('city', e.target.value)} placeholder="e.g. Anand" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">District *</label>
                                    <input required className="form-input" value={form.district} onChange={e => set('district', e.target.value)} placeholder="e.g. Anand" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">State *</label>
                                    <input required className="form-input" value={form.state} onChange={e => set('state', e.target.value)} placeholder="e.g. Gujarat" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Animal */}
                    <div className="card reveal" style={{ marginBottom: 22 }}>
                        <div className="card-body">
                            <div className="sec-head">🐄 Animal Details</div>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Species *</label>
                                    <select className="form-select" value={form.species} onChange={e => { set('species', e.target.value); set('breed', '') }}>
                                        <option value="cattle">🐄 Cattle</option>
                                        <option value="buffalo">🐃 Buffalo</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Breed *</label>
                                    <input required list="breed-list" className="form-input" value={form.breed} onChange={e => set('breed', e.target.value)} placeholder="Type or select a breed…" />
                                    <datalist id="breed-list">
                                        {breedList.map(b => <option key={b} value={b} />)}
                                    </datalist>
                                </div>
                            </div>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Gender</label>
                                    <select className="form-select" value={form.gender} onChange={e => set('gender', e.target.value)}>
                                        <option value="unknown">Unknown</option>
                                        <option value="female">♀ Female</option>
                                        <option value="male">♂ Male</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Date of Birth</label>
                                    <input type="date" className="form-input" value={form.dob} onChange={e => set('dob', e.target.value)} max={new Date().toISOString().split('T')[0]} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Weight (kg)</label>
                                    <input type="number" step="0.1" min="1" max="2000" className="form-input" value={form.weight_kg} onChange={e => set('weight_kg', e.target.value)} placeholder="e.g. 350" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Ear Tag / Tag ID</label>
                                    <input className="form-input" value={form.ear_tag} onChange={e => set('ear_tag', e.target.value)} placeholder="e.g. GJ-2024-001" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Health */}
                    <div className="card reveal" style={{ marginBottom: 22 }}>
                        <div className="card-body">
                            <div className="sec-head">❤️ Health Status</div>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Current Health Status</label>
                                    <select className="form-select" value={form.health_status} onChange={e => set('health_status', e.target.value)}>
                                        <option value="healthy">❤️ Healthy</option>
                                        <option value="sick">🏥 Sick</option>
                                        <option value="under_treatment">💊 Under Treatment</option>
                                        <option value="unknown">❓ Unknown</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Notes</label>
                                    <input className="form-input" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any special notes about the animal…" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {error && <div className="alert alert-error">⚠️ {error}</div>}

                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }} className="reveal">
                        <button type="submit" className="btn btn-gold btn-lg" disabled={loading}>
                            {loading ? <><div style={{ width: 18, height: 18, border: '2.5px solid rgba(26,26,26,0.25)', borderTopColor: '#1f2a1f', borderRadius: '50%', animation: 'spin 0.85s linear infinite' }} />Registering…</> : '✅ Register & Generate QR'}
                        </button>
                        <button type="button" className="btn btn-ghost btn-lg" onClick={() => setForm(INITIAL)}>🔄 Reset Form</button>
                    </div>
                </form>
            </div>
        </div>
    )
}
