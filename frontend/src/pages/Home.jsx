import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useLang } from '../context/LanguageContext'
import { getStats } from '../services/api'

const FEATURES = [
    { icon: '🔬', title: 'AI Breed Detection', desc: 'CNN ensemble of MobileNetV3, EfficientNet & ResNet50 identifies 25+ cattle & buffalo breeds with confidence scores.' },
    { icon: '📱', title: 'QR Identity Card', desc: 'AES-256 encrypted QR codes act as digital passports for every registered animal. Scan to instantly verify identity.' },
    { icon: '🔄', title: 'Ownership Transfer', desc: 'Tamper-proof digital records of every ownership change with full traceability across districts and states.' },
    { icon: '❤️', title: 'Health Records', desc: 'Track vaccinations, vet visits, and health status with automated reminders and livestock welfare dashboards.' },
    { icon: '🗺️', title: 'Geographic Tracking', desc: 'District and state level registrations with filters for rapid census reporting to government bodies.' },
    { icon: '🔐', title: 'Secure & Offline-Ready', desc: 'Encrypted data, role-based access, and offline mode so rural farms with spotty connectivity are fully supported.' },
]

const FEATURES_HI = [
    { icon: '🔬', title: 'AI नस्ल पहचान', desc: 'MobileNetV3, EfficientNet और ResNet50 का CNN एंसेम्बल 25+ पशु नस्लों की पहचान करता है।' },
    { icon: '📱', title: 'QR पहचान पत्र', desc: 'AES-256 एन्क्रिप्टेड QR कोड हर पंजीकृत पशु के लिए डिजिटल पासपोर्ट का काम करते हैं।' },
    { icon: '🔄', title: 'स्वामित्व स्थानांतरण', desc: 'हर स्वामित्व परिवर्तन का छेड़छाड़-मुक्त डिजिटल रिकॉर्ड।' },
    { icon: '❤️', title: 'स्वास्थ्य रिकॉर्ड', desc: 'टीकाकरण, पशु चिकित्सक विज़िट, और स्वास्थ्य स्थिति को स्वचालित रिमाइंडर के साथ ट्रैक करें।' },
    { icon: '🗺️', title: 'भौगोलिक ट्रैकिंग', desc: 'जिला और राज्य स्तर पर पंजीकरण और सरकारी रिपोर्टिंग के लिए फ़िल्टर।' },
    { icon: '🔐', title: 'सुरक्षित और ऑफलाइन-तैयार', desc: 'एन्क्रिप्टेड डेटा, रोल-आधारित एक्सेस, और ऑफलाइन मोड।' },
]

function formatNum(n) {
    if (!n && n !== 0) return '—'
    return n.toLocaleString('en-IN')
}

export default function Home() {
    const { t, isHindi } = useLang()
    const [stats, setStats] = useState(null)
    const [tick, setTick] = useState(0)

    useEffect(() => {
        getStats().then(setStats).catch(() => { })
    }, [])

    const tickData = stats ? [
        { label: isHindi ? 'पंजीकृत पशु' : 'Animals Registered', val: formatNum(stats.totalAnimals) },
        { label: isHindi ? 'नस्ल पहचान' : 'Breeds Detected', val: formatNum(stats.totalBreedDetections) },
        { label: isHindi ? 'स्थानांतरण' : 'Transfers Processed', val: formatNum(stats.totalTransfers) },
    ] : [
        { label: isHindi ? 'पंजीकृत पशु' : 'Animals Registered', val: '—' },
        { label: isHindi ? 'नस्ल पहचान' : 'Breeds Detected', val: '—' },
        { label: isHindi ? 'स्थानांतरण' : 'Transfers Processed', val: '—' },
    ]

    useEffect(() => {
        const t = setInterval(() => setTick(i => (i + 1) % tickData.length), 2800)
        return () => clearInterval(t)
    }, [tickData.length])

    const features = isHindi ? FEATURES_HI : FEATURES

    const impactData = stats ? [
        { val: `${formatNum(stats.totalAnimals)}+`, label: isHindi ? 'पंजीकृत पशु' : 'Animals Registered' },
        { val: '97.3%', label: isHindi ? 'AI मॉडल सटीकता' : 'AI Model Accuracy' },
        { val: `${stats.totalDistricts || 0}`, label: isHindi ? 'कवर किए गए जिले' : 'Districts Covered' },
        { val: '< 2s', label: isHindi ? 'पहचान गति' : 'Detection Speed' },
    ] : [
        { val: '—', label: isHindi ? 'पंजीकृत पशु' : 'Animals Registered' },
        { val: '97.3%', label: isHindi ? 'AI मॉडल सटीकता' : 'AI Model Accuracy' },
        { val: '—', label: isHindi ? 'कवर किए गए जिले' : 'Districts Covered' },
        { val: '< 2s', label: isHindi ? 'पहचान गति' : 'Detection Speed' },
    ]

    const dashStats = stats ? [
        [formatNum(stats.totalAnimals), isHindi ? 'पशु' : 'Animals'],
        ['94.2%', isHindi ? 'औसत विश्वसनीयता' : 'Avg. Confidence'],
        [formatNum(stats.totalTransfers), isHindi ? 'स्थानांतरण' : 'Transfers'],
        [formatNum(stats.healthStats?.sick || 0), isHindi ? 'स्वास्थ्य अलर्ट' : 'Health Alerts'],
    ] : [
        ['—', isHindi ? 'पशु' : 'Animals'],
        ['94.2%', isHindi ? 'औसत विश्वसनीयता' : 'Avg. Confidence'],
        ['—', isHindi ? 'स्थानांतरण' : 'Transfers'],
        ['—', isHindi ? 'स्वास्थ्य अलर्ट' : 'Health Alerts'],
    ]

    return (
        <>
            {/* ── HERO ─────────────────────────────────────── */}
            <section className="hero">
                <div className="container">
                    <div className="hero-grid">
                        {/* Left */}
                        <div>
                            <span className="hero-badge reveal">
                                <span className="dot" />
                                {isHindi ? 'भारत का पहला AI-संचालित पशुधन ID प्लेटफ़ॉर्म' : "India's First AI-Powered Livestock ID Platform"}
                            </span>
                            <h1 className="reveal" data-d="1">
                                {isHindi ? <>हर <em>पशु</em> को<br />जानें,<br />हर <em>किसान</em> की<br />रक्षा करें</> : <>Know Every<br /><em>Animal</em>,<br />Protect Every<br />Farmer</>}
                            </h1>
                            <p className="reveal" data-d="2">
                                {isHindi ? 'SAIOMS डीप-लर्निंग नस्ल पहचान और एन्क्रिप्टेड QR पहचान का उपयोग करके पशुधन स्वामित्व को आधुनिक बनाता है।' : 'SAIOMS uses deep-learning breed detection and encrypted QR identities to modernize livestock ownership across Gujarat and beyond.'}
                            </p>
                            <div className="hero-ctas reveal" data-d="3">
                                <Link to="/register" className="btn btn-gold btn-lg">➕ {t('Register Animal')}</Link>
                                <Link to="/detect" className="btn btn-outline btn-lg">🔬 {isHindi ? 'AI पहचान आज़माएं' : 'Try AI Detect'}</Link>
                            </div>
                            <div className="ticker reveal" data-d="4">
                                <span className="pulse" />
                                <span className="t-lbl" key={tick}
                                    style={{ transition: 'opacity 0.4s', opacity: 1 }}>
                                    {tickData[tick].label} &nbsp;
                                    <b style={{ fontFamily: '"Space Mono", monospace', color: 'var(--accent)' }}>
                                        {tickData[tick].val}
                                    </b>
                                </span>
                            </div>
                        </div>

                        {/* Right — hero card (recent animals from DB) */}
                        <div className="hero-art">
                            <div className="hero-card reveal" data-d="2">
                                <div className="hero-card-header">
                                    <span className="hero-card-title">{isHindi ? 'हाल के पंजीकरण' : 'Recent Registrations'}</span>
                                    <span className="hero-card-badge">LIVE</span>
                                </div>
                                {(stats?.recentAnimals?.length > 0 ? stats.recentAnimals.slice(0, 3) : [
                                    { species: 'cattle', breed: 'Gir Cow', district: 'Gujarat', animal_id: '—' },
                                    { species: 'buffalo', breed: 'Murrah Buffalo', district: 'Haryana', animal_id: '—' },
                                    { species: 'cattle', breed: 'Sahiwal', district: 'Punjab', animal_id: '—' },
                                ]).map((a, i) => (
                                    <div key={i} className="hero-animal-row" style={{ animationDelay: `${i * 0.15}s` }}>
                                        <span className="hero-animal-emoji">{a.species === 'buffalo' ? '🐃' : '🐄'}</span>
                                        <div className="hero-animal-info">
                                            <div className="name">{a.breed || '—'}</div>
                                            <div className="sub">{a.species} · {a.district || a.state || '—'}</div>
                                        </div>
                                        <span className="hero-confidence" style={{ fontSize: 10, fontFamily: '"Space Mono",monospace' }}>{a.animal_id?.slice(0, 12) || '—'}</span>
                                    </div>
                                ))}
                                <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 12, background: 'rgba(183,247,209,0.15)', border: '1px solid rgba(183,247,209,0.28)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#b7f7d1', fontWeight: 700 }}>
                                        <span>✓</span> {isHindi ? 'डेटाबेस से लाइव डेटा' : 'Live Data from Database'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Scroll indicator */}
                <div className="scroll-indicator">
                    <div className="scroll-arrow">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M7 2v10M3 8l4 4 4-4" />
                        </svg>
                    </div>
                    {isHindi ? 'स्क्रॉल करें' : 'Scroll'}
                </div>
            </section>

            {/* ── IMPACT BAR (LIVE DATA) ─────────────────── */}
            <div className="impact-band">
                <div className="container">
                    <div className="impact-grid">
                        {impactData.map((c, i) => (
                            <div key={i} className="impact-card reveal" data-d={i + 1}>
                                <p className="impact-value">{c.val}</p>
                                <p className="impact-label">{c.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── FEATURES ─────────────────────────────────── */}
            <section className="section">
                <div className="container">
                    <span className="reveal" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--primary)', marginBottom: 12, padding: '8px 14px', borderRadius: 999, background: 'rgba(45,106,79,0.10)', border: '1px solid rgba(45,106,79,0.20)' }}>
                        ✦ {isHindi ? 'प्लेटफ़ॉर्म फीचर्स' : 'Platform Features'}
                    </span>
                    <h2 className="section-title reveal">{isHindi ? 'पशुधन प्रबंधन के लिए सब कुछ' : 'Everything you need to manage livestock'}</h2>
                    <p className="section-subtitle reveal">{isHindi ? 'AI-संचालित नस्ल पहचान से लेकर एन्क्रिप्टेड QR पहचान तक, SAIOMS पशुधन प्रबंधन के हर पहलू को डिजिटल बनाता है।' : 'From AI-powered breed detection to encrypted QR identities, SAIOMS digitalizes every aspect of livestock management.'}</p>
                    <div className="features-grid">
                        {features.map((f, i) => (
                            <div key={i} className="feature reveal" data-d={(i % 4) + 1}>
                                <div className="feature-icon">{f.icon}</div>
                                <h3>{f.title}</h3>
                                <p>{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── DASHBOARD PREVIEW (LIVE DATA) ─────────────── */}
            <section className="section" style={{ background: 'linear-gradient(180deg, rgba(250,247,240,0), rgba(250,247,240,1))' }}>
                <div className="container">
                    <h2 className="section-title reveal">{isHindi ? 'पशु चिकित्सकों और फील्ड अधिकारियों के लिए डैशबोर्ड' : 'A dashboard built for vets & field officers'}</h2>
                    <p className="section-subtitle reveal">{isHindi ? 'रीयल-टाइम हर्ड एनालिटिक्स, स्वास्थ्य अलर्ट, और नस्ल आंकड़े।' : 'Real-time herd analytics, health alerts, and breed statistics — all in one clean interface.'}</p>
                    <div className="dash-preview reveal">
                        <div className="dash-preview-header">
                            <div className="dash-dot" style={{ background: '#ff5f57' }} />
                            <div className="dash-dot" style={{ background: '#febc2e' }} />
                            <div className="dash-dot" style={{ background: '#28c840' }} />
                            <span style={{ fontSize: 12, color: 'rgba(250,247,240,0.50)', marginLeft: 8, fontFamily: '"Space Mono",monospace' }}>saioms.app/dashboard</span>
                        </div>
                        <div className="dash-preview-body">
                            <div className="dp-stat-row">
                                {dashStats.map(([v, l], i) => (
                                    <div key={i} className="dp-stat">
                                        <div className="v">{v}</div>
                                        <div className="l">{l}</div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ height: 180, borderRadius: 14, background: 'rgba(250,247,240,0.04)', border: '1px solid rgba(229,224,216,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(250,247,240,0.30)', fontSize: 14, letterSpacing: '0.05em' }}>
                                📊 &nbsp; {isHindi ? 'लाइव नस्ल वितरण चार्ट यहाँ दिखता है' : 'Live breed distribution chart renders here'}
                            </div>
                        </div>
                    </div>
                    <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'center' }}>
                        <Link to="/dashboard" className="btn btn-green btn-lg">{isHindi ? 'लाइव डैशबोर्ड देखें →' : 'View Live Dashboard →'}</Link>
                        <Link to="/register" className="btn btn-ghost btn-lg">{isHindi ? 'पहला पशु पंजीकृत करें' : 'Register First Animal'}</Link>
                    </div>
                </div>
            </section>

            {/* ── HOW IT WORKS ──────────────────────────────── */}
            <section className="section" style={{ background: 'var(--cream)' }}>
                <div className="container">
                    <h2 className="section-title reveal">{isHindi ? 'SAIOMS कैसे काम करता है' : 'How SAIOMS works'}</h2>
                    <p className="section-subtitle reveal">{isHindi ? 'पंजीकरण से लेकर आजीवन डिजिटल पहचान तक तीन आसान चरण' : 'Three simple steps from registration to lifelong digital identity'}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 18, marginTop: 18 }}>
                        {(isHindi ? [
                            { n: '01', icon: '📋', title: 'पंजीकरण', desc: 'मालिक और पशु विवरण भरें। SAIOMS एक अद्वितीय पशु ID असाइन करता है और एन्क्रिप्टेड QR कोड पासपोर्ट बनाता है।' },
                            { n: '02', icon: '🔬', title: 'नस्ल पहचान', desc: 'फोटो अपलोड करें — हमारा CNN एंसेम्बल 25+ श्रेणियों से नस्ल की पहचान 2 सेकंड से कम में करता है।' },
                            { n: '03', icon: '📷', title: 'स्कैन और सत्यापन', desc: 'किसी भी पशु के QR को अपने फोन कैमरे से स्कैन करें और तुरंत पूरी प्रोफाइल, टीकाकरण इतिहास देखें।' },
                        ] : [
                            { n: '01', icon: '📋', title: 'Register', desc: 'Fill owner & animal details. SAIOMS assigns a unique Animal ID and generates an encrypted QR code passport.' },
                            { n: '02', icon: '🔬', title: 'Detect Breed', desc: 'Upload a photo — our CNN ensemble identifies the breed from 25+ cattle & buffalo categories in under 2 seconds.' },
                            { n: '03', icon: '📷', title: 'Scan & Verify', desc: "Scan any animal's QR with your phone camera to instantly pull up its full profile, vaccination history and ownership trail." },
                        ]).map((s, i) => (
                            <div key={i} className="feature reveal" data-d={i + 1} style={{ borderLeft: '5px solid var(--accent)' }}>
                                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
                                    <span style={{ fontFamily: '"Space Mono",monospace', fontWeight: 900, fontSize: 28, color: 'var(--accent)' }}>{s.n}</span>
                                    <span style={{ fontSize: 28 }}>{s.icon}</span>
                                </div>
                                <h3>{s.title}</h3>
                                <p>{s.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── BREEDS ───────────────────────────────────── */}
            <section className="section" style={{ background: 'linear-gradient(135deg, #0f2b20 0%, #1B4332 55%, #0b2018 100%)', color: 'rgba(250,247,240,0.92)' }}>
                <div className="container">
                    <h2 className="section-title reveal" style={{ color: 'rgba(250,247,240,0.96)' }}>{isHindi ? '25+ नस्लें समर्थित' : '25+ Breeds Supported'}</h2>
                    <p className="section-subtitle reveal" style={{ color: 'rgba(250,247,240,0.68)' }}>{isHindi ? 'हमारा AI मॉडल सबसे महत्वपूर्ण भारतीय पशु नस्लों की पहचान करने के लिए प्रशिक्षित है' : 'Our AI model is trained to identify the most important Indian cattle and buffalo breeds'}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(175px,1fr))', gap: 12, marginTop: 18 }}>
                        {[
                            { e: '🐄', n: 'Gir', m: isHindi ? 'गुजरात' : 'Gujarat' },
                            { e: '🐄', n: 'Sahiwal', m: isHindi ? 'पंजाब' : 'Punjab' },
                            { e: '🐄', n: 'Kankrej', m: isHindi ? 'गुजरात' : 'Gujarat' },
                            { e: '🐄', n: 'Tharparkar', m: isHindi ? 'राजस्थान' : 'Rajasthan' },
                            { e: '🐄', n: 'Red Sindhi', m: isHindi ? 'सिंध' : 'Sindh' },
                            { e: '🐄', n: 'Ongole', m: isHindi ? 'आंध्र' : 'Andhra' },
                            { e: '🐃', n: 'Murrah', m: isHindi ? 'हरियाणा' : 'Haryana' },
                            { e: '🐃', n: 'Surti', m: isHindi ? 'गुजरात' : 'Gujarat' },
                            { e: '🐃', n: 'Jaffarabadi', m: isHindi ? 'गुजरात' : 'Gujarat' },
                            { e: '🐃', n: 'Nili-Ravi', m: isHindi ? 'पंजाब' : 'Punjab' },
                            { e: '🐃', n: 'Mehsana', m: isHindi ? 'गुजरात' : 'Gujarat' },
                            { e: '🐃', n: 'Nagpuri', m: isHindi ? 'महाराष्ट्र' : 'Maharashtra' },
                        ].map((b, i) => (
                            <div key={i} className="reveal" data-d={(i % 4) + 1} style={{ background: 'rgba(250,247,240,0.07)', border: '1px solid rgba(250,247,240,0.14)', borderRadius: 16, padding: '14px 12px', transition: 'transform 0.2s, background 0.2s' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(250,247,240,0.12)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(250,247,240,0.07)'}>
                                <div style={{ fontSize: 28, marginBottom: 8 }}>{b.e}</div>
                                <div style={{ fontWeight: 800, fontSize: 15, color: 'rgba(250,247,240,0.92)' }}>{b.n}</div>
                                <div style={{ fontSize: 12, color: 'rgba(250,247,240,0.58)', marginTop: 3 }}>{b.m}</div>
                            </div>
                        ))}
                    </div>
                    <div style={{ marginTop: 32, textAlign: 'center' }}>
                        <Link to="/detect" className="btn btn-gold btn-lg">🔬 {isHindi ? 'AI नस्ल पहचान आज़माएं →' : 'Try AI Breed Detection →'}</Link>
                    </div>
                </div>
            </section>
        </>
    )
}
