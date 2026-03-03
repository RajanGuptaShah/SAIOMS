import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { LanguageProvider } from './context/LanguageContext'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import RegisterAnimal from './pages/RegisterAnimal'
import AnimalProfile from './pages/AnimalProfile'
import BreedDetector from './pages/BreedDetector'
import QRScanner from './pages/QRScanner'
import AnimalLookup from './pages/AnimalLookup'
import Login from './pages/Login'
import Signup from './pages/Signup'
import NearbySearch from './pages/NearbySearch'
import UserProfile from './pages/UserProfile'
import ChatPage from './pages/ChatPage'

// Scroll reveal observer
function RevealObserver() {
    const location = useLocation()
    useEffect(() => {
        const els = document.querySelectorAll('.reveal')
        const obs = new IntersectionObserver(
            entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target) } }),
            { threshold: 0.14 }
        )
        els.forEach(el => obs.observe(el))
        return () => obs.disconnect()
    }, [location.pathname])
    return null
}

// Protected route — redirects to /login if not authenticated
function ProtectedRoute({ children }) {
    const { isAuth, loading } = useAuth()
    if (loading) return (
        <div className="page-wrap">
            <div className="container">
                <div className="spinner-page"><div className="spinner" /><span>Loading…</span></div>
            </div>
        </div>
    )
    return isAuth ? children : <Navigate to="/login" replace />
}

function AppInner() {
    return (
        <div id="root">
            <Navbar />
            <RevealObserver />
            <div className="page-content">
                <Routes>
                    {/* Public routes */}
                    <Route path="/" element={<Home />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    <Route path="/scan-qr" element={<QRScanner />} />
                    <Route path="/lookup" element={<AnimalLookup />} />
                    <Route path="/nearby" element={<NearbySearch />} />
                    <Route path="/detect" element={<BreedDetector />} />

                    {/* Protected routes */}
                    <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                    <Route path="/register" element={<ProtectedRoute><RegisterAnimal /></ProtectedRoute>} />
                    <Route path="/animal/:id" element={<ProtectedRoute><AnimalProfile /></ProtectedRoute>} />
                    <Route path="/profile" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
                    <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />

                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </div>
            <Footer />
        </div>
    )
}

export default function App() {
    return (
        <BrowserRouter>
            <ThemeProvider>
                <LanguageProvider>
                    <AuthProvider>
                        <AppInner />
                    </AuthProvider>
                </LanguageProvider>
            </ThemeProvider>
        </BrowserRouter>
    )
}
