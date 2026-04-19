import { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const API = import.meta.env.VITE_API_BASE_URL || ''

/* ── Country codes ── */
const COUNTRY_CODES = [
    { code: '+91', flag: '🇮🇳', name: 'India' },
    { code: '+977', flag: '🇳🇵', name: 'Nepal' },
    { code: '+92', flag: '🇵🇰', name: 'Pakistan' },
    { code: '+880', flag: '🇧🇩', name: 'Bangladesh' },
    { code: '+94', flag: '🇱🇰', name: 'Sri Lanka' },
    { code: '+1', flag: '🇺🇸', name: 'USA/Canada' },
    { code: '+44', flag: '🇬🇧', name: 'UK' },
    { code: '+61', flag: '🇦🇺', name: 'Australia' },
    { code: '+971', flag: '🇦🇪', name: 'UAE' },
    { code: '+966', flag: '🇸🇦', name: 'Saudi Arabia' },
]

export default function Signup() {
    const { signup } = useAuth()
    const navigate = useNavigate()

    const [form, setForm] = useState({
        name: '', email: '', countryCode: '+91', phone: '',
        password: '', confirmPassword: '', bio: '', location: '', role: 'farmer'
    })
    const [avatarFile, setAvatarFile] = useState(null)
    const [avatarPreview, setAvatarPreview] = useState(null)
    const [error, setError] = useState(null)
    const [loading, setLoading] = useState(false)

    // OTP state
    const [step, setStep] = useState(1)           // 1=credentials, 2=OTP, 3=profile
    const [otpSending, setOtpSending] = useState(false)
    const [otpSent, setOtpSent] = useState(false)
    const [otpToken, setOtpToken] = useState('')  // verification token from backend
    const [otp, setOtp] = useState(['', '', '', '', '', ''])
    const [resendTimer, setResendTimer] = useState(0)
    const [otpVerifying, setOtpVerifying] = useState(false)
    const [devMode, setDevMode] = useState(false) // true = OTP in server console

    const otpRefs = useRef([])
    const timerRef = useRef(null)
    const fileRef = useRef(null)

    const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

    /* ── Step 1 validation ── */
    const validateStep1 = () => {
        if (!form.name.trim()) return 'Full name is required.'
        if (!form.email.trim()) return 'Email address is required.'
        if (!/\S+@\S+\.\S+/.test(form.email)) return 'Enter a valid email address.'
        if (!form.phone.trim()) return 'Phone number is required.'
        if (!/^\d{7,12}$/.test(form.phone.replace(/[\s-]/g, ''))) return 'Enter a valid phone number (7–12 digits).'
        if (form.password.length < 8) return 'Password must be at least 8 characters.'
        if (form.password !== form.confirmPassword) return 'Passwords do not match.'
        return null
    }

    /* ── Send OTP ── */
    const sendOtp = async (isResend = false) => {
        if (!isResend) {
            const err = validateStep1()
            if (err) { setError(err); return }
        }
        setError(null); setOtpSending(true)
        try {
            const r = await fetch(`${API}/api/auth/send-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: form.email.trim() })
            })
            const d = await r.json()
            if (!r.ok || !d.success) { setError(d.detail || 'Failed to send OTP.'); return }
            setDevMode(d.mode === 'console')
            setOtpSent(true); setStep(2); setOtp(['', '', '', '', '', ''])

            // Start 30s resend timer
            setResendTimer(30)
            clearInterval(timerRef.current)
            timerRef.current = setInterval(() => {
                setResendTimer(t => { if (t <= 1) { clearInterval(timerRef.current); return 0 } return t - 1 })
            }, 1000)
        } catch { setError('Network error. Please check your connection.') }
        finally { setOtpSending(false) }
    }

    /* ── OTP input handling ── */
    const handleOtpChange = (idx, val) => {
        if (!/^\d?$/.test(val)) return
        const next = [...otp]; next[idx] = val; setOtp(next)
        if (val && idx < 5) otpRefs.current[idx + 1]?.focus()
    }
    const handleOtpKeyDown = (idx, e) => {
        if (e.key === 'Backspace' && !otp[idx] && idx > 0) otpRefs.current[idx - 1]?.focus()
    }
    const handleOtpPaste = (e) => {
        const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
        if (text.length === 6) {
            setOtp(text.split(''))
            otpRefs.current[5]?.focus()
        }
    }

    /* ── Verify OTP ── */
    const verifyOtp = async () => {
        const code = otp.join('')
        if (code.length !== 6) { setError('Enter all 6 digits of the OTP.'); return }
        setError(null); setOtpVerifying(true)
        try {
            const r = await fetch(`${API}/api/auth/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: form.email.trim(), otp: code })
            })
            const d = await r.json()
            if (!r.ok || !d.success) { setError(d.detail || 'Incorrect OTP.'); return }
            setOtpToken(d.token)
            setStep(3)
        } catch { setError('Network error. Please try again.') }
        finally { setOtpVerifying(false) }
    }

    /* ── Final submit ── */
    const handleSubmit = async e => {
        e.preventDefault(); setError(null)
        const fd = new FormData()
        fd.append('name', form.name.trim())
        fd.append('email', form.email.trim())
        fd.append('countryCode', form.countryCode)
        fd.append('phone', form.phone.replace(/[\s-]/g, ''))
        fd.append('password', form.password)
        fd.append('role', form.role)
        fd.append('otpToken', otpToken)
        if (form.bio.trim()) fd.append('bio', form.bio.trim())
        if (form.location.trim()) fd.append('location', form.location.trim())
        if (avatarFile) fd.append('avatar', avatarFile)
        setLoading(true)
        try { await signup(fd); navigate('/dashboard') }
        catch (err) { setError(err.response?.data?.detail || 'Registration failed. Please try again.') }
        finally { setLoading(false) }
    }

    /* ── Step indicator ── */
    const steps = ['Account', 'Verify Email', 'Profile']
    const stepEmojis = ['👤', '✉️', '🌱']

    return (
        <div className="page-wrap" style={{ minHeight: '90vh', display: 'flex', alignItems: 'center', paddingTop: 40, paddingBottom: 40 }}>
            <div className="container" style={{ maxWidth: 520 }}>

                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <div style={{ fontSize: 48, marginBottom: 8 }}>{stepEmojis[step - 1]}</div>
                    <h1 className="page-title" style={{ marginBottom: 4 }}>Create Account</h1>
                    <p style={{ color: 'var(--muted)', fontSize: 13 }}>Step {step} of 3 — {steps[step - 1]}</p>
                    {/* Step dots */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12, alignItems: 'center' }}>
                        {steps.map((_, i) => (
                            <div key={i} style={{
                                width: i + 1 === step ? 28 : 10, height: 10, borderRadius: 999,
                                background: i + 1 === step ? '#1B4332' : i + 1 < step ? '#D4A017' : '#E5E0D8',
                                transition: 'all 0.3s'
                            }} />
                        ))}
                    </div>
                </div>

                <div className="card"><div className="card-body">

                    {/* ── STEP 1: Account credentials ── */}
                    {step === 1 && (
                        <div>
                            <div className="form-grid">
                                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                    <label className="form-label">Full Name *</label>
                                    <input type="text" className="form-input" placeholder="Ramesh Kumar" value={form.name} onChange={set('name')} autoComplete="name" />
                                </div>
                                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                    <label className="form-label">Email Address *</label>
                                    <input type="email" className="form-input" placeholder="email@example.com" value={form.email} onChange={set('email')} autoComplete="email" />
                                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>✉️ OTP will be sent to this email</div>
                                </div>
                                {/* Phone with country code */}
                                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                    <label className="form-label">Phone Number *</label>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <select
                                            value={form.countryCode} onChange={set('countryCode')}
                                            style={{ flex: '0 0 auto', width: 140, padding: '10px 8px', border: '2px solid var(--border)', borderRadius: 10, fontSize: 13, fontFamily: 'inherit', background: '#FAF7F0', cursor: 'pointer' }}
                                        >
                                            {COUNTRY_CODES.map(c => (
                                                <option key={c.code} value={c.code}>{c.flag} {c.code} {c.name}</option>
                                            ))}
                                        </select>
                                        <input type="tel" className="form-input" style={{ flex: 1 }} placeholder="9876543210"
                                            value={form.phone} onChange={set('phone')} autoComplete="tel" />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Password * <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: 12 }}>(min 8 chars)</span></label>
                                    <input type="password" className="form-input" placeholder="Min. 8 characters" value={form.password} onChange={set('password')} autoComplete="new-password" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Confirm Password *</label>
                                    <input type="password" className="form-input" placeholder="Repeat password" value={form.confirmPassword} onChange={set('confirmPassword')} autoComplete="new-password" />
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
                            {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>⚠️ {error}</div>}
                            <button className="btn btn-green" style={{ width: '100%', marginTop: 4 }}
                                onClick={() => sendOtp(false)} disabled={otpSending}>
                                {otpSending ? '📤 Sending OTP…' : '✉️ Send OTP to Email →'}
                            </button>
                        </div>
                    )}

                    {/* ── STEP 2: OTP Verification ── */}
                    {step === 2 && (
                        <div>
                            {/* Dev-mode notice */}
                            {devMode && (
                                <div style={{ background: '#FFFBEB', border: '1.5px solid #F59E0B', borderRadius: 10, padding: '12px 14px', marginBottom: 16, fontSize: 13 }}>
                                    <div style={{ fontWeight: 700, color: '#92400E', marginBottom: 4 }}>🛠️ Dev Mode — SMS not configured</div>
                                    <div style={{ color: '#78350F', lineHeight: 1.6 }}>
                                        The OTP was printed to your <strong>backend terminal/console</strong>.<br />
                                        Look for a line starting with <code style={{ background: '#FDE68A', padding: '1px 5px', borderRadius: 4 }}>📱 OTP SMS (DEV MODE)</code>.<br />
                                    </div>
                                </div>
                            )}

                            <div style={{ textAlign: 'center', marginBottom: 16 }}>
                                <div style={{ fontSize: 36, marginBottom: 6 }}>✉️</div>
                                <p style={{ fontWeight: 700, color: '#1B4332', marginBottom: 4 }}>
                                    {devMode ? 'Check your backend terminal' : 'Check your inbox & Spam folder'}
                                </p>
                                <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                                    {devMode
                                        ? 'OTP was logged to the server console'
                                        : <>We sent a 6-digit email OTP to<br /><strong style={{ color: '#1B4332' }}>{form.email}</strong><br /><span style={{ color: '#D4A017', display: 'inline-block', marginTop: '6px', fontSize: 12 }}>Note: Delivery may take a minute. If you don't see it, <strong>check your Spam folder</strong>.</span></>}
                                </p>
                            </div>

                            {/* OTP boxes */}
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 20 }} onPaste={handleOtpPaste}>
                                {otp.map((digit, i) => (
                                    <input
                                        key={i}
                                        ref={el => otpRefs.current[i] = el}
                                        type="text" inputMode="numeric" maxLength={1}
                                        value={digit}
                                        onChange={e => handleOtpChange(i, e.target.value)}
                                        onKeyDown={e => handleOtpKeyDown(i, e)}
                                        style={{
                                            width: 52, height: 56, textAlign: 'center', fontSize: 22, fontWeight: 700,
                                            border: `2px solid ${digit ? '#1B4332' : 'var(--border)'}`,
                                            borderRadius: 12, outline: 'none', fontFamily: 'monospace',
                                            background: digit ? 'rgba(45,106,79,0.05)' : '#FAF7F0',
                                            transition: 'all 0.2s',
                                        }}
                                    />
                                ))}
                            </div>

                            {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>⚠️ {error}</div>}

                            <button className="btn btn-green" style={{ width: '100%', marginBottom: 12 }}
                                onClick={verifyOtp} disabled={otpVerifying || otp.join('').length !== 6}>
                                {otpVerifying ? '⏳ Verifying…' : '✅ Verify OTP'}
                            </button>

                            {/* Resend */}
                            <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
                                Didn't receive it?{' '}
                                {resendTimer > 0
                                    ? <span style={{ color: '#9CA3AF' }}>Resend in {resendTimer}s</span>
                                    : <button onClick={() => sendOtp(true)} disabled={otpSending}
                                        style={{ background: 'none', border: 'none', color: '#D4A017', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
                                        {otpSending ? 'Sending…' : '🔄 Resend OTP'}
                                    </button>}
                            </div>
                            <button onClick={() => { setStep(1); setError(null) }}
                                style={{ width: '100%', marginTop: 12, background: 'none', border: 'none', color: 'var(--muted)', fontFamily: 'inherit', cursor: 'pointer', fontSize: 13 }}>
                                ← Change email address
                            </button>
                        </div>
                    )}

                    {/* ── STEP 3: Profile ── */}
                    {step === 3 && (
                        <form onSubmit={handleSubmit}>
                            {/* Avatar */}
                            <div style={{ textAlign: 'center', marginBottom: 20 }}>
                                <div onClick={() => fileRef.current?.click()} style={{ width: 88, height: 88, borderRadius: '50%', margin: '0 auto 10px', cursor: 'pointer', background: avatarPreview ? 'transparent' : 'linear-gradient(135deg,#1B4332,#2D6A4F)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '3px solid #D4A017', boxShadow: '0 4px 14px rgba(27,67,50,0.18)', position: 'relative' }}>
                                    {avatarPreview ? <img src={avatarPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 30 }}>👤</span>}
                                </div>
                                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }}
                                    onChange={e => { const f = e.target.files?.[0]; if (!f) return; setAvatarFile(f); setAvatarPreview(URL.createObjectURL(f)) }} />
                                <button type="button" onClick={() => fileRef.current?.click()} style={{ fontSize: 13, color: '#D4A017', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                                    {avatarPreview ? '✏️ Change Photo' : '+ Add Profile Photo'}
                                </button>
                                <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Optional · JPEG, PNG · Max 5 MB</p>
                            </div>
                            {/* Phone verified badge -> Email verified badge */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 12, background: 'rgba(45,106,79,0.08)', border: '1px solid rgba(45,106,79,0.2)', marginBottom: 16 }}>
                                <span style={{ fontSize: 18 }}>✅</span>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: 13, color: '#1B4332' }}>Email Verified</div>
                                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{form.email}</div>
                                </div>
                            </div>
                            <div className="form-grid">
                                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                    <label className="form-label">Bio <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: 12 }}>(optional)</span></label>
                                    <textarea className="form-input" rows={3} maxLength={300} placeholder="Tell us about yourself — your farm, animals, expertise…" value={form.bio} onChange={set('bio')} style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 14 }} />
                                    <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'right', marginTop: 2 }}>{form.bio.length}/300</div>
                                </div>
                                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                    <label className="form-label">Location <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: 12 }}>(optional)</span></label>
                                    <input type="text" className="form-input" placeholder="e.g. Kanpur, Uttar Pradesh" value={form.location} onChange={set('location')} />
                                </div>
                            </div>
                            {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>⚠️ {error}</div>}
                            <div style={{ display: 'flex', gap: 10 }}>
                                <button type="button" className="btn btn-ghost" onClick={() => { setStep(2); setError(null) }}>← Back</button>
                                <button type="submit" className="btn btn-green" disabled={loading} style={{ flex: 1 }}>
                                    {loading ? '⏳ Creating account…' : '🌱 Create Account'}
                                </button>
                            </div>
                        </form>
                    )}

                    <div style={{ textAlign: 'center', marginTop: 20, color: 'var(--muted)', fontSize: 14 }}>
                        Already have an account?{' '}
                        <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 700 }}>Sign in →</Link>
                    </div>
                </div></div>

                <div style={{ textAlign: 'center', marginTop: 14 }}>
                    <Link to="/" style={{ color: 'var(--muted)', fontSize: 13 }}>← Back to Home</Link>
                </div>
            </div>
        </div>
    )
}
