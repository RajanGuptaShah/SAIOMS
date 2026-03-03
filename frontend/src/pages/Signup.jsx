import { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const API = import.meta.env.VITE_API_BASE_URL || ''

export default function Signup() {
    const { signup } = useAuth()
    const navigate = useNavigate()
    const [form, setForm] = useState({
        name: '', email: '', phone: '', password: '', confirmPassword: '',
        bio: '', location: '', role: 'farmer'
    })
    const [avatarFile, setAvatarFile] = useState(null)
    const [avatarPreview, setAvatarPreview] = useState(null)
    const [error, setError] = useState(null)
    const [loading, setLoading] = useState(false)
    const [step, setStep] = useState(1)   // 1 = account info, 2 = profile
    const fileRef = useRef(null)

    const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

    const handleAvatarChange = e => {
        const f = e.target.files?.[0]
        if (!f) return
        setAvatarFile(f)
        const url = URL.createObjectURL(f)
        setAvatarPreview(url)
    }

    const validateStep1 = () => {
        if (!form.name.trim()) return 'Full name is required.'
        if (!form.email.trim()) return 'Email is required.'
        if (!/\S+@\S+\.\S+/.test(form.email)) return 'Please enter a valid email address.'
        if (!/^\d{10}$/.test(form.phone.replace(/\s/g, ''))) return 'Please enter a valid 10-digit phone number.'
        if (form.password.length < 8) return 'Password must be at least 8 characters.'
        if (form.password !== form.confirmPassword) return 'Passwords do not match.'
        return null
    }

    const handleNext = () => {
        const err = validateStep1()
        if (err) { setError(err); return }
        setError(null)
        setStep(2)
    }

    const handleSubmit = async e => {
        e.preventDefault()
        setError(null)

        // Build multipart form data
        const fd = new FormData()
        fd.append('name', form.name.trim())
        fd.append('email', form.email.trim())
        fd.append('phone', form.phone.replace(/\s/g, ''))
        fd.append('password', form.password)
        fd.append('role', form.role)
        if (form.bio.trim()) fd.append('bio', form.bio.trim())
        if (form.location.trim()) fd.append('location', form.location.trim())
        if (avatarFile) fd.append('avatar', avatarFile)

        setLoading(true)
        try {
            // signup via AuthContext (needs to support FormData)
            await signup(fd)
            navigate('/dashboard')
        } catch (err) {
            setError(err.response?.data?.detail || 'Registration failed. Please try again.')
        } finally { setLoading(false) }
    }

    return (
        <div className="page-wrap" style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', paddingTop: 40, paddingBottom: 40 }}>
            <div className="container" style={{ maxWidth: 520 }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                    <div style={{ fontSize: 52, marginBottom: 8 }}>🌱</div>
                    <h1 className="page-title" style={{ marginBottom: 6 }}>Create Account</h1>
                    <p style={{ color: 'var(--muted)', fontSize: 14 }}>
                        Step {step} of 2 — {step === 1 ? 'Account Details' : 'Your Profile'}
                    </p>
                    {/* Step indicator */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12 }}>
                        {[1, 2].map(s => (
                            <div key={s} style={{ width: s === step ? 28 : 10, height: 10, borderRadius: 999, background: s === step ? '#1B4332' : s < step ? '#D4A017' : '#E5E0D8', transition: 'all 0.3s' }} />
                        ))}
                    </div>
                </div>

                <div className="card">
                    <div className="card-body">
                        {/* ── Step 1: Account credentials ── */}
                        {step === 1 && (
                            <div>
                                <div className="form-grid">
                                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                        <label className="form-label">Full Name *</label>
                                        <input required type="text" className="form-input" placeholder="Ramesh Kumar"
                                            value={form.name} onChange={set('name')} autoComplete="name" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Email *</label>
                                        <input required type="email" className="form-input" placeholder="email@example.com"
                                            value={form.email} onChange={set('email')} autoComplete="email" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Phone *</label>
                                        <input required type="tel" className="form-input" placeholder="9876543210"
                                            value={form.phone} onChange={set('phone')} autoComplete="tel" maxLength={10} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Password * <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: 12 }}>(min. 8 chars)</span></label>
                                        <input required type="password" className="form-input" placeholder="Min. 8 characters"
                                            value={form.password} onChange={set('password')} autoComplete="new-password" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Confirm Password *</label>
                                        <input required type="password" className="form-input" placeholder="Repeat password"
                                            value={form.confirmPassword} onChange={set('confirmPassword')} autoComplete="new-password" />
                                    </div>
                                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                        <label className="form-label">Account Type</label>
                                        <select className="form-select" value={form.role} onChange={set('role')}>
                                            <option value="farmer">🌾 Farmer / Animal Owner</option>
                                            <option value="vet">🏥 Veterinarian</option>
                                            <option value="admin">⚙️ Administrator</option>
                                        </select>
                                    </div>
                                </div>
                                {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>⚠️ {error}</div>}
                                <button className="btn btn-green btn-full" onClick={handleNext} style={{ width: '100%', marginTop: 4 }}>
                                    Continue → Set Up Profile
                                </button>
                            </div>
                        )}

                        {/* ── Step 2: Profile info + avatar ── */}
                        {step === 2 && (
                            <form onSubmit={handleSubmit}>
                                {/* Avatar upload */}
                                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                                    <div
                                        onClick={() => fileRef.current?.click()}
                                        style={{ width: 96, height: 96, borderRadius: '50%', margin: '0 auto 12px', cursor: 'pointer', background: avatarPreview ? 'transparent' : 'linear-gradient(135deg, #1B4332, #2D6A4F)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '3px solid #D4A017', boxShadow: '0 4px 16px rgba(27,67,50,0.20)', position: 'relative' }}>
                                        {avatarPreview
                                            ? <img src={avatarPreview} alt="Avatar preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            : <span style={{ fontSize: 32 }}>👤</span>}
                                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' }}
                                            onMouseEnter={e => e.currentTarget.style.opacity = 1}
                                            onMouseLeave={e => e.currentTarget.style.opacity = 0}>
                                            <span style={{ color: '#fff', fontSize: 20 }}>📷</span>
                                        </div>
                                    </div>
                                    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleAvatarChange} />
                                    <button type="button" onClick={() => fileRef.current?.click()}
                                        style={{ fontSize: 13, color: '#D4A017', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                                        {avatarPreview ? '✏️ Change Photo' : '+ Add Profile Photo'}
                                    </button>
                                    <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Optional · JPEG, PNG · Max 5 MB</p>
                                </div>

                                <div className="form-grid">
                                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                        <label className="form-label">Bio <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: 12 }}>(optional)</span></label>
                                        <textarea className="form-input" rows={3} maxLength={300}
                                            placeholder="Tell us about yourself — your farm, animals, or expertise..."
                                            value={form.bio} onChange={set('bio')}
                                            style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 14 }} />
                                        <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'right', marginTop: 2 }}>{form.bio.length}/300</div>
                                    </div>
                                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                        <label className="form-label">Location <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: 12 }}>(optional)</span></label>
                                        <input type="text" className="form-input" placeholder="e.g. Kanpur, Uttar Pradesh"
                                            value={form.location} onChange={set('location')} />
                                    </div>
                                </div>

                                {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>⚠️ {error}</div>}

                                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                                    <button type="button" className="btn btn-ghost" onClick={() => { setStep(1); setError(null) }} style={{ flex: '0 0 auto' }}>
                                        ← Back
                                    </button>
                                    <button type="submit" className="btn btn-green btn-full" disabled={loading} style={{ flex: 1 }}>
                                        {loading ? '⏳ Creating account…' : '🌱 Create Account'}
                                    </button>
                                </div>
                            </form>
                        )}

                        <div style={{ textAlign: 'center', marginTop: 20, color: 'var(--muted)', fontSize: 14 }}>
                            Already have an account?{' '}
                            <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 700 }}>Sign in →</Link>
                        </div>
                    </div>
                </div>

                <div style={{ textAlign: 'center', marginTop: 14 }}>
                    <Link to="/" style={{ color: 'var(--muted)', fontSize: 13 }}>← Back to Home</Link>
                </div>
            </div>
        </div>
    )
}
