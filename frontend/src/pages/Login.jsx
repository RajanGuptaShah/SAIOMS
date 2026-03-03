import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
    const { login } = useAuth()
    const navigate = useNavigate()
    const [form, setForm] = useState({ email: '', password: '' })
    const [error, setError] = useState(null)
    const [loading, setLoading] = useState(false)

    const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

    const handleSubmit = async e => {
        e.preventDefault()
        setError(null); setLoading(true)
        try {
            await login(form.email, form.password)
            navigate('/dashboard')
        } catch (err) {
            setError(err.response?.data?.detail || 'Login failed. Please check your credentials.')
        } finally { setLoading(false) }
    }

    return (
        <div className="page-wrap" style={{ minHeight: '80vh', display: 'flex', alignItems: 'center' }}>
            <div className="container" style={{ maxWidth: 460 }}>
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div style={{ fontSize: 56, marginBottom: 8 }}>🔐</div>
                    <h1 className="page-title" style={{ marginBottom: 6 }}>Welcome Back</h1>
                    <p style={{ color: 'var(--muted)', fontSize: 15 }}>Sign in to manage your animals</p>
                </div>

                <div className="card">
                    <div className="card-body">
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label className="form-label">Email Address</label>
                                <input
                                    type="email" required
                                    className="form-input"
                                    placeholder="you@example.com"
                                    value={form.email}
                                    onChange={set('email')}
                                    autoComplete="email"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Password</label>
                                <input
                                    type="password" required
                                    className="form-input"
                                    placeholder="••••••••"
                                    value={form.password}
                                    onChange={set('password')}
                                    autoComplete="current-password"
                                />
                            </div>

                            {error && (
                                <div className="alert alert-error" style={{ marginBottom: 16 }}>
                                    ⚠️ {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                className="btn btn-gold btn-full"
                                disabled={loading}
                                style={{ marginTop: 8, width: '100%' }}
                            >
                                {loading ? '⏳ Signing in…' : '🔐 Sign In'}
                            </button>
                        </form>

                        <div style={{ textAlign: 'center', marginTop: 20, color: 'var(--muted)', fontSize: 14 }}>
                            Don't have an account?{' '}
                            <Link to="/signup" style={{ color: 'var(--primary)', fontWeight: 700 }}>
                                Create one →
                            </Link>
                        </div>
                    </div>
                </div>

                <div style={{ textAlign: 'center', marginTop: 16 }}>
                    <Link to="/" style={{ color: 'var(--muted)', fontSize: 13 }}>← Back to Home</Link>
                </div>
            </div>
        </div>
    )
}
