import { useState, useEffect, useRef } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useLang } from '../context/LanguageContext'
import { listAnimals } from '../services/api'
import { NotificationBell } from '../pages/UserProfile'

export default function Navbar() {
    const [scrolled, setScrolled] = useState(false)
    const [mobileOpen, setMobileOpen] = useState(false)
    const [dropOpen, setDropOpen] = useState(false)
    const [animals, setAnimals] = useState([])
    const dropRef = useRef(null)
    const location = useLocation()
    const navigate = useNavigate()
    const isHome = location.pathname === '/'
    const { user, isAuth, logout } = useAuth()
    const { dark, toggle: toggleTheme } = useTheme()
    const { lang, toggleLang, t, isHindi } = useLang()

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 40)
        window.addEventListener('scroll', onScroll, { passive: true })
        onScroll()
        return () => window.removeEventListener('scroll', onScroll)
    }, [])

    useEffect(() => { setMobileOpen(false); setDropOpen(false) }, [location])

    useEffect(() => {
        if (isAuth) listAnimals({ limit: 100 }).then(d => setAnimals(d.animals || d)).catch(() => { })
    }, [isAuth])

    useEffect(() => {
        const h = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false) }
        document.addEventListener('mousedown', h)
        return () => document.removeEventListener('mousedown', h)
    }, [])

    const handleLogout = () => { logout(); navigate('/') }

    const links = [
        { to: '/', label: `🏠 ${t('Home')}`, end: true },
        { to: '/lookup', label: `🔍 ${t('Find Animal')}` },
        { to: '/nearby', label: `🗺️ ${t('Help Nearby')}` },
        ...(isAuth ? [
            { to: '/dashboard', label: `📊 ${t('My Animals')}` },
            { to: '/register', label: `➕ ${t('Add Animal')}` },
            { to: '/detect', label: `🔬 ${t('Breed Check')}` },
            { to: '/chat', label: `💬 ${isHindi ? 'चैट' : 'Chat'}` },
        ] : []),
        { to: '/scan-qr', label: `📷 ${t('Scan')}` },
    ]

    const navTo = (to, tabId) => () => { setDropOpen(false); navigate(to, tabId ? { state: { tab: tabId } } : undefined) }
    const dropItems = [
        { onClick: navTo('/profile'), icon: '👤', label: t('My Profile') },
        { onClick: navTo('/profile', 'notifications'), icon: '🔔', label: t('Alerts & Notifications') },
        { onClick: navTo('/profile', 'vaccines'), icon: '💉', label: t('Vaccine Schedule') },
        { onClick: navTo('/profile', 'transfers'), icon: '🔄', label: t('Transfer History') },
        null,
        { onClick: navTo('/dashboard'), icon: '📊', label: t('My Animals') },
        { onClick: navTo('/nearby'), icon: '🗺️', label: t('Find Nearby Vets') },
        null,
        { onClick: handleLogout, icon: '🚪', label: t('Logout'), danger: true },
    ]

    /* ── Shared toggle button style ── */
    const toggleBtnStyle = (active) => ({
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 36, height: 36, borderRadius: 10,
        border: '1.5px solid var(--nav-toggle-border)',
        background: active ? 'var(--primary)' : 'var(--nav-toggle-bg)',
        color: active ? '#FAF7F0' : 'var(--nav-toggle-color)',
        cursor: 'pointer', fontSize: 15, fontWeight: 800,
        fontFamily: 'inherit', transition: 'all 0.2s', flexShrink: 0,
    })

    return (
        <>
            <nav className={`nav ${scrolled || !isHome ? 'scrolled' : ''}`}>
                <div className="container nav-inner">
                    <NavLink to="/" className="brand">
                        <div className="brand-icon">🐄</div>
                        <div>
                            <span className="brand-title">SAIOMS</span>
                            <span className="brand-sub">{t('Smart Animal ID')}</span>
                        </div>
                    </NavLink>

                    <ul className="nav-links">
                        {links.map(l => (
                            <li key={l.to}>
                                <NavLink to={l.to} end={l.end} className={({ isActive }) => isActive ? 'active' : ''}>
                                    {l.label}
                                </NavLink>
                            </li>
                        ))}
                    </ul>

                    {/* Right side: toggles + auth */}
                    <div className="nav-auth" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>

                        {/* 🌙 Dark mode toggle */}
                        <button
                            onClick={toggleTheme}
                            style={toggleBtnStyle(false)}
                            title={dark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                            aria-label="Toggle dark mode"
                        >
                            {dark ? '☀️' : '🌙'}
                        </button>

                        {/* 🇮🇳 Hindi/English toggle */}
                        <button
                            onClick={toggleLang}
                            style={{ ...toggleBtnStyle(isHindi), fontSize: 12, width: 'auto', padding: '0 10px', letterSpacing: 0.3 }}
                            title={isHindi ? 'Switch to English' : 'हिंदी में देखें'}
                            aria-label="Toggle language"
                        >
                            {isHindi ? 'EN' : 'हि'}
                        </button>

                        {isAuth ? (
                            <>
                                <NotificationBell animals={animals} />

                                <div ref={dropRef} style={{ position: 'relative' }}>
                                    <button onClick={() => setDropOpen(o => !o)} style={{
                                        display: 'flex', alignItems: 'center', gap: 7,
                                        padding: '6px 12px', borderRadius: 999,
                                        background: dropOpen ? 'rgba(45,106,79,0.16)' : 'var(--nav-user-bg)',
                                        border: '1px solid var(--nav-user-border)',
                                        fontSize: 13, fontWeight: 700, color: 'var(--primary)',
                                        cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.18s', maxWidth: 170,
                                    }} aria-expanded={dropOpen}>
                                        <span>👤</span>
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name?.split(' ')[0]}</span>
                                        <span style={{ fontSize: 9, opacity: 0.55 }}>{dropOpen ? '▲' : '▼'}</span>
                                    </button>

                                    {dropOpen && (
                                        <div style={{
                                            position: 'absolute', top: 'calc(100% + 10px)', right: 0,
                                            minWidth: 220, background: 'var(--surface)', borderRadius: 18,
                                            border: '1.5px solid var(--border)', boxShadow: '0 20px 50px rgba(27,67,50,0.18)',
                                            zIndex: 500, overflow: 'hidden', animation: 'fadeSlideIn 0.2s ease both',
                                        }}>
                                            <div style={{ background: 'linear-gradient(135deg,#1B4332,#2D6A4F)', padding: '13px 16px' }}>
                                                <div style={{ fontWeight: 800, color: '#FAF7F0', fontSize: 13 }}>{user?.name}</div>
                                                <div style={{ fontSize: 11, color: 'rgba(250,247,240,0.62)', marginTop: 1 }}>{user?.email}</div>
                                            </div>
                                            <div style={{ padding: '7px 6px' }}>
                                                {dropItems.map((item, i) =>
                                                    item === null ? (
                                                        <div key={i} style={{ height: 1, background: 'var(--border)', margin: '5px 10px' }} />
                                                    ) : (
                                                        <button key={i} onClick={item.onClick} style={{
                                                            display: 'flex', alignItems: 'center', gap: 9,
                                                            width: '100%', padding: '9px 12px', border: 'none',
                                                            borderRadius: 10, background: 'none', cursor: 'pointer',
                                                            fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                                                            color: item.danger ? '#C1440E' : 'var(--dark)',
                                                            textAlign: 'left', transition: 'background 0.15s',
                                                        }}
                                                            onMouseEnter={e => e.currentTarget.style.background = item.danger ? 'rgba(193,68,14,0.08)' : 'rgba(45,106,79,0.07)'}
                                                            onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                                        >
                                                            <span style={{ fontSize: 15, width: 20, textAlign: 'center' }}>{item.icon}</span>
                                                            {item.label}
                                                        </button>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <>
                                <NavLink to="/login" className="btn btn-ghost btn-sm">{t('Sign In')}</NavLink>
                                <NavLink to="/signup" className="btn btn-gold btn-sm">{t('Sign Up')}</NavLink>
                            </>
                        )}
                    </div>

                    <button className="hamburger" onClick={() => setMobileOpen(o => !o)} aria-label="Toggle menu">
                        <span className="bar" style={{ transform: mobileOpen ? 'rotate(45deg) translate(5px,5px)' : '' }} />
                        <span className="bar" style={{ opacity: mobileOpen ? 0 : 1 }} />
                        <span className="bar" style={{ transform: mobileOpen ? 'rotate(-45deg) translate(5px,-5px)' : '' }} />
                    </button>
                </div>
            </nav>

            {/* Mobile menu */}
            <div className={`mobile-menu ${mobileOpen ? 'open' : ''}`}>
                <div className="container mobile-menu-inner">
                    {/* Mobile theme/language toggles */}
                    <div style={{ display: 'flex', gap: 8, padding: '4px 0' }}>
                        <button onClick={toggleTheme} style={{
                            flex: 1, padding: '10px', border: '1.5px solid var(--border)', borderRadius: 14,
                            background: dark ? '#1B4332' : '#fff', color: dark ? '#FAF7F0' : '#1B4332',
                            fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                        }}>
                            {dark ? '☀️ Light Mode' : '🌙 Dark Mode'}
                        </button>
                        <button onClick={toggleLang} style={{
                            flex: 1, padding: '10px', border: '1.5px solid var(--border)', borderRadius: 14,
                            background: isHindi ? '#1B4332' : '#fff', color: isHindi ? '#FAF7F0' : '#1B4332',
                            fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                        }}>
                            {isHindi ? '🇬🇧 English' : '🇮🇳 हिंदी'}
                        </button>
                    </div>

                    {links.map(l => (
                        <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => isActive ? 'active' : ''}>
                            {l.label}
                        </NavLink>
                    ))}
                    {isAuth ? (
                        <>
                            <NavLink to="/profile" style={{ textDecoration: 'none' }}>
                                <div style={{ padding: '11px 14px', background: 'rgba(45,106,79,0.08)', borderRadius: 14, border: '1px solid rgba(45,106,79,0.16)', display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span>👤</span>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--primary)' }}>{user?.name}</div>
                                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{t('Profile · Alerts · History')}</div>
                                    </div>
                                </div>
                            </NavLink>
                            <button onClick={handleLogout} className="btn btn-ghost btn-full" style={{ borderRadius: 14 }}>🚪 {t('Logout')}</button>
                        </>
                    ) : (
                        <>
                            <NavLink to="/login" className="btn btn-ghost btn-full" style={{ borderRadius: 14 }}>🔐 {t('Sign In')}</NavLink>
                            <NavLink to="/signup" className="btn btn-gold btn-full" style={{ borderRadius: 14 }}>🌱 {t('Sign Up')}</NavLink>
                        </>
                    )}
                </div>
            </div>
        </>
    )
}
