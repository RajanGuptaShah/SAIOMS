import { NavLink } from 'react-router-dom'
import { useLang } from '../context/LanguageContext'

export default function Footer() {
    const { t, isHindi } = useLang()
    return (
        <footer className="footer">
            <div className="container footer-inner">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 22 }}>🐄</span>
                    <div>
                        <span style={{ fontFamily: '"Playfair Display", serif', fontWeight: 700, fontSize: 16, color: 'rgba(250,247,240,0.92)' }}>SAIOMS</span>
                        <span style={{ marginLeft: 10, fontSize: 12, color: 'rgba(250,247,240,0.55)' }}>{isHindi ? 'स्मार्ट पशु आईडी और स्वामित्व प्रबंधन' : 'Smart Animal ID & Ownership Management'}</span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13 }}>
                    <NavLink to="/dashboard" style={{ color: 'rgba(250,247,240,0.70)' }}>{t('Dashboard')}</NavLink>
                    <NavLink to="/register" style={{ color: 'rgba(250,247,240,0.70)' }}>{t('Register')}</NavLink>
                    <NavLink to="/detect" style={{ color: 'rgba(250,247,240,0.70)' }}>{isHindi ? 'AI पहचान' : 'AI Detect'}</NavLink>
                    <NavLink to="/scan-qr" style={{ color: 'rgba(250,247,240,0.70)' }}>{isHindi ? 'QR स्कैन' : 'Scan QR'}</NavLink>
                    <NavLink to="/chat" style={{ color: 'rgba(250,247,240,0.70)' }}>{isHindi ? '💬 चैट' : '💬 Chat'}</NavLink>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: 'rgba(250,247,240,0.45)' }}>
                    © 2026 SAIOMS · {isHindi ? 'उत्तर प्रदेश 2026 Saiom' : 'Uttar Pradesh 2026 Saiom'}
                </p>
            </div>
        </footer>
    )
}
