/**
 * SAIOMS — AuthContext
 * Provides user authentication state and actions across the app.
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [token, setToken] = useState(() => localStorage.getItem('saioms_token'))
    const [loading, setLoading] = useState(true)

    // On mount, verify token and load user
    useEffect(() => {
        const stored = localStorage.getItem('saioms_token')
        if (stored) {
            api.defaults.headers.common['Authorization'] = `Bearer ${stored}`
            api.get('/api/auth/me')
                .then(r => setUser(r.data.user))
                .catch(() => { clearAuth() })
                .finally(() => setLoading(false))
        } else {
            setLoading(false)
        }
    }, [])

    function clearAuth() {
        localStorage.removeItem('saioms_token')
        delete api.defaults.headers.common['Authorization']
        setToken(null)
        setUser(null)
    }

    const login = useCallback(async (email, password) => {
        const res = await api.post('/api/auth/login', { email, password })
        const { token: t, user: u } = res.data
        localStorage.setItem('saioms_token', t)
        api.defaults.headers.common['Authorization'] = `Bearer ${t}`
        setToken(t)
        setUser(u)
        return u
    }, [])

    const signup = useCallback(async (data) => {
        // Support both plain JSON and FormData (for avatar upload at registration)
        const isFormData = data instanceof FormData
        const res = await api.post('/api/auth/register', data, {
            headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : {},
        })
        const { token: t, user: u } = res.data
        localStorage.setItem('saioms_token', t)
        api.defaults.headers.common['Authorization'] = `Bearer ${t}`
        setToken(t)
        setUser(u)
        return u
    }, [])

    /** Refresh current user from server (useful after profile edits) */
    const refreshUser = useCallback(async () => {
        try {
            const r = await api.get('/api/auth/me')
            setUser(r.data.user)
        } catch (_) { }
    }, [])

    const logout = useCallback(() => {
        clearAuth()
    }, [])

    return (
        <AuthContext.Provider value={{ user, token, loading, login, signup, logout, refreshUser, setUser, isAuth: !!user }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
    return ctx
}
