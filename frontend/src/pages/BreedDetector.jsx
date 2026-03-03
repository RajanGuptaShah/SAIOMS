import { useState, useCallback, useRef, useEffect } from 'react'
import { detectBreed } from '../services/api'

/* ── Breed Info Database ────────────────────────────────────────────────────── */
const BREED_INFO = {
    'Gir': {
        origin: 'Gir forest, Gujarat, India',
        characteristics: ['Distinctive convex forehead', 'Long pendulous ears', 'Reddish-brown patches', 'Hump-back'],
        careTips: ['Thrives in hot climates', 'High-quality fodder needed for milk production', 'Regular deworming every 3 months'],
        milkYield: '1200–1800 kg/lactation',
        description: 'One of the principal Zebu breeds, known for high milk fat content and heat tolerance.',
    },
    'Sahiwal': {
        origin: 'Punjab region, Pakistan/India',
        characteristics: ['Reddish-dun to brown color', 'Loose skin with dewlap', 'Short horns', 'Heavy build'],
        careTips: ['Highly tick-resistant', 'Excellent grazing breed', 'Supplement with mineral licks'],
        milkYield: '1400–2500 kg/lactation',
        description: 'Best dairy breed among Zebu cattle, prized for tick resistance and heat tolerance.',
    },
    'Tharparkar': {
        origin: 'Tharparkar district, Rajasthan/Sindh',
        characteristics: ['White to grey color', 'Medium size', 'Lyre-shaped horns', 'Strong legs'],
        careTips: ['Drought-hardy, survives on sparse grazing', 'Supplement during dry season'],
        milkYield: '1000–1600 kg/lactation',
        description: 'Dual-purpose breed well-adapted to arid conditions of Rajasthan and Sindh.',
    },
    'Murrah': {
        origin: 'Haryana and Punjab, India',
        characteristics: ['Shiny black coat', 'Tightly coiled horns', 'Massive build', 'Roman nose profile'],
        careTips: ['Needs abundant water (100+ liters/day)', 'Requires wallowing for thermoregulation', 'High protein diet essential'],
        milkYield: '2000–3000 kg/lactation',
        description: 'Best buffalo breed in the world for milk production, dominates Indian dairy industry.',
    },
    'Surti': {
        origin: 'Kheda and Vadodara, Gujarat',
        characteristics: ['Brown to reddish-brown', 'Flat forehead', 'Medium-sized horns curving upward', 'Medium build'],
        careTips: ['Adaptable to semi-arid conditions', 'Regular bathing prevents heat stress'],
        milkYield: '1500–2200 kg/lactation',
        description: 'Gujarat\'s premier buffalo breed, known for high-fat milk ideal for ghee production.',
    },
    'Jaffarabadi': {
        origin: 'Gir Somnath, Gujarat',
        characteristics: ['Massive body', 'Heavy head', 'Massive curved horns', 'Jet black coat'],
        careTips: ['Needs large water bodies nearby', 'Heavy feeder — high roughage intake'],
        milkYield: '1800–2500 kg/lactation',
        description: 'Heaviest of all Indian buffalo breeds, kept primarily for milk and draft.',
    },
    'default': {
        origin: 'India',
        characteristics: ['Typical Indian livestock characteristics'],
        careTips: ['Provide clean water and balanced feed daily', 'Regular veterinary checkups', 'Keep shelter clean and ventilated'],
        milkYield: 'Varies by individual',
        description: 'Indian cattle/buffalo breed with typical Zebu characteristics.',
    },
}

function getBreedInfo(breedName) {
    if (!breedName) return BREED_INFO['default']
    const key = Object.keys(BREED_INFO).find(k => breedName.toLowerCase().includes(k.toLowerCase()))
    return BREED_INFO[key || 'default']
}

/* ── Confidence Bar ──────────────────────────────────────────────────────────── */
function ConfBar({ label, value, rank }) {
    const pct = Math.round(value * 100)
    const color = rank === 1 ? '#2D6A4F' : rank === 2 ? '#D4A017' : '#6B7280'
    return (
        <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: rank === 1 ? 700 : 500, marginBottom: 4, color: rank === 1 ? '#1B4332' : 'inherit' }}>
                <span>#{rank} {label}</span>
                <span style={{ color, fontWeight: 700 }}>{pct}%</span>
            </div>
            <div style={{ height: 8, background: '#F0EDE8', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.max(pct, 1)}%`, background: color, borderRadius: 99, transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)' }} />
            </div>
        </div>
    )
}

/* ── Main Component ─────────────────────────────────────────────────────────── */
export default function BreedDetector() {
    const [activeTab, setActiveTab] = useState('upload') // 'upload' | 'camera' | 'video'
    const [file, setFile] = useState(null)
    const [preview, setPreview] = useState(null)
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState(null)
    const [error, setError] = useState(null)
    const [drag, setDrag] = useState(false)
    const [cameraActive, setCameraActive] = useState(false)
    const [camError, setCamError] = useState(null)
    const [captureReady, setCaptureReady] = useState(false)

    const videoRef = useRef(null)
    const streamRef = useRef(null)
    const canvasRef = useRef(null)
    const fileInputRef = useRef(null)
    const videoInputRef = useRef(null)

    /* ── File / drag-drop ──────────────────────────────────────────────────── */
    const pickFile = useCallback(f => {
        if (!f) return
        if (preview) URL.revokeObjectURL(preview)
        setFile(f); setPreview(URL.createObjectURL(f))
        setResult(null); setError(null)
    }, [preview])

    const onDrop = e => {
        e.preventDefault(); setDrag(false)
        const f = e.dataTransfer.files?.[0]
        if (f && f.type.startsWith('image/')) pickFile(f)
    }

    /* ── Camera ────────────────────────────────────────────────────────────── */
    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop())
            streamRef.current = null
        }
        setCameraActive(false)
        setCaptureReady(false)
    }, [])

    const startCamera = useCallback(async () => {
        setCamError(null); setResult(null); setError(null)
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
            }).catch(() =>
                navigator.mediaDevices.getUserMedia({ video: true })
            )
            streamRef.current = stream
            if (videoRef.current) {
                videoRef.current.srcObject = stream
                await new Promise(res => {
                    if (videoRef.current.readyState >= 1) return res()
                    videoRef.current.onloadedmetadata = res
                })
                try { await videoRef.current.play() } catch (_) { }
            }
            setCameraActive(true)
            setTimeout(() => setCaptureReady(true), 800)  // brief stabilize delay
        } catch (err) {
            setCamError(err.name === 'NotAllowedError'
                ? 'Camera permission denied. Please allow camera access.'
                : `Camera error: ${err.message}`)
        }
    }, [])

    const captureAndDetect = useCallback(async () => {
        if (!videoRef.current || !canvasRef.current) return
        const video = videoRef.current
        const canvas = canvasRef.current
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        ctx.drawImage(video, 0, 0)
        canvas.toBlob(async blob => {
            if (!blob) return
            stopCamera()
            const captured = new File([blob], 'capture.jpg', { type: 'image/jpeg' })
            const url = URL.createObjectURL(blob)
            if (preview) URL.revokeObjectURL(preview)
            setPreview(url)
            setFile(captured)
            setLoading(true); setError(null); setResult(null)
            try {
                const data = await detectBreed(captured)
                setResult(data)
            } catch (err) {
                setError(err.response?.data?.detail || 'Detection failed.')
            } finally { setLoading(false) }
        }, 'image/jpeg', 0.92)
    }, [preview, stopCamera])

    /* ── Video file: extract frames ────────────────────────────────────────── */
    const analyzeVideo = useCallback(async videoFile => {
        setLoading(true); setError(null); setResult(null)
        try {
            const url = URL.createObjectURL(videoFile)
            const vid = document.createElement('video')
            vid.src = url; vid.muted = true; vid.preload = 'auto'
            await new Promise((res, rej) => { vid.onloadeddata = res; vid.onerror = rej })
            const duration = vid.duration || 5
            const frameTimes = [0.5, duration * 0.25, duration * 0.5, duration * 0.75, duration - 0.5]
                .filter(t => t >= 0 && t < duration)

            let bestResult = null
            for (const t of frameTimes) {
                const blob = await seekFrame(vid, t)
                if (!blob) continue
                const frame = new File([blob], `frame_${t.toFixed(1)}.jpg`, { type: 'image/jpeg' })
                try {
                    const data = await detectBreed(frame)
                    if (!bestResult || data.confidence > bestResult.confidence) {
                        bestResult = data
                        setPreview(URL.createObjectURL(blob))
                    }
                } catch (_) { continue }
            }
            URL.revokeObjectURL(url)
            if (bestResult) setResult(bestResult)
            else throw new Error('Could not detect a breed from any video frame.')
        } catch (err) {
            setError(err.message || 'Video analysis failed.')
        } finally { setLoading(false) }
    }, [])

    function seekFrame(vid, time) {
        return new Promise(resolve => {
            vid.currentTime = time
            vid.onseeked = () => {
                const c = document.createElement('canvas')
                c.width = vid.videoWidth; c.height = vid.videoHeight
                c.getContext('2d').drawImage(vid, 0, 0)
                c.toBlob(b => resolve(b), 'image/jpeg', 0.88)
            }
        })
    }

    const detectIt = async () => {
        if (!file) return
        setLoading(true); setError(null); setResult(null)
        try {
            const data = await detectBreed(file)
            setResult(data)
        } catch (err) {
            setError(err.response?.data?.detail || 'Detection failed. Is the backend running?')
        } finally { setLoading(false) }
    }

    const reset = () => {
        stopCamera()
        if (preview) URL.revokeObjectURL(preview)
        setFile(null); setPreview(null); setResult(null); setError(null)
    }

    // Cleanup camera on tab-switch or unmount
    useEffect(() => () => stopCamera(), [stopCamera])
    useEffect(() => { if (activeTab !== 'camera') stopCamera() }, [activeTab, stopCamera])

    const breedInfo = result ? getBreedInfo(result.top_breed) : null

    /* ── Tabs ──────────────────────────────────────────────────────────────── */
    const TABS = [
        { id: 'upload', icon: '📤', label: 'Upload Photo' },
        { id: 'camera', icon: '📷', label: 'Live Camera' },
        { id: 'video', icon: '🎥', label: 'Video Upload' },
    ]

    return (
        <div className="page-wrap">
            <div className="container">
                {/* Header */}
                <div className="page-header reveal">
                    <div>
                        <h1 className="page-title">🔬 AI Breed Detector</h1>
                        <p className="page-subtitle">
                            Photo, live camera, or video — CLIP AI identifies Indian cattle &amp; buffalo breeds with confidence scoring
                        </p>
                    </div>
                </div>

                {/* Mode tabs */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 24, padding: 5, background: '#fff', border: '1.5px solid #E5E0D8', borderRadius: 999, width: 'fit-content' }}>
                    {TABS.map(t => (
                        <button key={t.id}
                            onClick={() => { setActiveTab(t.id); reset() }}
                            style={{ padding: '8px 20px', border: 'none', borderRadius: 999, cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', transition: 'all 0.2s', background: activeTab === t.id ? '#D4A017' : 'transparent', color: activeTab === t.id ? '#1f2a1f' : '#6B7280' }}>
                            {t.icon} {t.label}
                        </button>
                    ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: (result || error) && preview ? '1.1fr 0.9fr' : '1fr', gap: 24, alignItems: 'start' }}>

                    {/* ── Left panel: input ──────────────────────────────────────── */}
                    <div className="reveal">

                        {/* Upload tab */}
                        {activeTab === 'upload' && (
                            <>
                                <div className={`dropzone ${drag ? 'drag-over' : ''}`} style={{ minHeight: preview ? 340 : 280 }}
                                    onDragOver={e => { e.preventDefault(); setDrag(true) }}
                                    onDragLeave={() => setDrag(false)}
                                    onDrop={onDrop}>
                                    <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={e => pickFile(e.target.files?.[0])} />
                                    {preview ? (
                                        <img src={preview} alt="Preview" style={{ maxHeight: 300, maxWidth: '100%', borderRadius: 14, objectFit: 'contain', pointerEvents: 'none' }} />
                                    ) : (
                                        <>
                                            <div className="dz-icon">📷</div>
                                            <h3>Drop image here</h3>
                                            <p style={{ marginBottom: 10 }}>JPEG · PNG · WebP — or click to browse</p>
                                            <div style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 1.6, maxWidth: '36ch', margin: '0 auto' }}>
                                                💡 <strong>Tip:</strong> Side-on or face-on photos work best. Ensure the animal fills most of the frame and lighting is good.
                                            </div>
                                        </>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                                    {file && <button className="btn btn-gold btn-lg" onClick={detectIt} disabled={loading} style={{ flex: 1 }}>
                                        {loading ? <><div style={{ width: 18, height: 18, border: '2.5px solid rgba(26,26,26,0.25)', borderTopColor: '#1f2a1f', borderRadius: '50%', animation: 'spin 0.85s linear infinite' }} /> Analysing…</> : '🔬 Detect Breed'}
                                    </button>}
                                    {file && <button className="btn btn-ghost" onClick={reset}>✕ Clear</button>}
                                </div>
                            </>
                        )}

                        {/* Camera tab */}
                        {activeTab === 'camera' && (
                            <div style={{ background: '#fff', border: '1.5px solid #E5E0D8', borderRadius: 22, overflow: 'hidden' }}>
                                {!cameraActive && !preview && (
                                    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                                        <div style={{ fontSize: 64, marginBottom: 14 }}>📷</div>
                                        <h3 style={{ fontFamily: '"Playfair Display",serif', color: '#1B4332', marginBottom: 10 }}>Live Camera Detection</h3>
                                        <p style={{ color: '#6B7280', marginBottom: 8, fontSize: 14 }}>Position the animal in the frame — use the rule-of-thirds grid as a guide.</p>
                                        <ul style={{ textAlign: 'left', display: 'inline-block', color: '#6B7280', fontSize: 13, lineHeight: 2, marginBottom: 20, paddingLeft: 20 }}>
                                            <li>📐 Center the animal in the grid</li>
                                            <li>💡 Ensure good, even lighting</li>
                                            <li>🎯 Include head and at least half-body</li>
                                            <li>⛅ Avoid backlighting or harsh shadows</li>
                                        </ul>
                                        {camError && <div style={{ color: '#991b1b', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.18)', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 18, maxWidth: 380, margin: '0 auto 18px' }}>⚠️ {camError}</div>}
                                        <button onClick={startCamera} style={{ padding: '12px 32px', border: 'none', borderRadius: 14, background: '#D4A017', color: '#1f2a1f', fontWeight: 800, cursor: 'pointer', fontSize: 15, fontFamily: 'inherit' }}>
                                            📷 Start Camera
                                        </button>
                                    </div>
                                )}

                                {loading && (
                                    <div style={{ textAlign: 'center', padding: '48px 20px' }}>
                                        <div style={{ width: 40, height: 40, border: '3px solid rgba(45,106,79,0.20)', borderTopColor: '#1B4332', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 14px' }} />
                                        <span style={{ color: '#6B7280', fontSize: 14 }}>Analysing captured frame…</span>
                                    </div>
                                )}

                                {preview && !loading && (
                                    <div style={{ padding: 20 }}>
                                        <img src={preview} alt="Captured" style={{ width: '100%', borderRadius: 14, maxHeight: 300, objectFit: 'contain' }} />
                                        <button className="btn btn-ghost" onClick={reset} style={{ marginTop: 12, width: '100%' }}>🔄 Retake</button>
                                    </div>
                                )}

                                {/* Live camera feed with grid overlay */}
                                {cameraActive && !loading && !preview && (
                                    <div style={{ position: 'relative', background: '#000', lineHeight: 0 }}>
                                        <video ref={videoRef} muted playsInline autoPlay
                                            style={{ display: 'block', width: '100%', aspectRatio: '16/9', objectFit: 'cover', background: '#000' }} />
                                        <canvas ref={canvasRef} style={{ display: 'none' }} />

                                        {/* Rule-of-thirds grid overlay */}
                                        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                                            {/* Vertical lines */}
                                            {[1 / 3, 2 / 3].map((p, i) => (
                                                <div key={`v${i}`} style={{ position: 'absolute', top: 0, bottom: 0, left: `${p * 100}%`, width: 1, background: 'rgba(255,255,255,0.25)' }} />
                                            ))}
                                            {/* Horizontal lines */}
                                            {[1 / 3, 2 / 3].map((p, i) => (
                                                <div key={`h${i}`} style={{ position: 'absolute', left: 0, right: 0, top: `${p * 100}%`, height: 1, background: 'rgba(255,255,255,0.25)' }} />
                                            ))}
                                            {/* Center crop guide */}
                                            <div style={{ position: 'absolute', top: '15%', left: '15%', right: '15%', bottom: '15%', border: '2px solid rgba(212,160,23,0.7)', borderRadius: 10, boxShadow: '0 0 0 9999px rgba(0,0,0,0.25)' }} />
                                            {/* Corner dots at intersections */}
                                            {[[33, 33], [67, 33], [33, 67], [67, 67]].map(([x, y], i) => (
                                                <div key={i} style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%)', width: 8, height: 8, borderRadius: '50%', background: 'rgba(212,160,23,0.8)' }} />
                                            ))}
                                            {/* Capture guidance */}
                                            <div style={{ position: 'absolute', bottom: 56, left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.85)', fontSize: 12, letterSpacing: 0.5 }}>
                                                Position animal inside the golden frame
                                            </div>
                                        </div>

                                        {/* Capture button */}
                                        <div style={{ position: 'absolute', bottom: 16, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 12 }}>
                                            <button onClick={captureAndDetect} disabled={!captureReady}
                                                style={{ padding: '11px 28px', border: '2.5px solid rgba(255,255,255,0.6)', borderRadius: 50, background: captureReady ? '#D4A017' : 'rgba(255,255,255,0.2)', color: captureReady ? '#1f2a1f' : '#fff', fontWeight: 800, cursor: captureReady ? 'pointer' : 'not-allowed', fontSize: 14, fontFamily: 'inherit', transition: 'all 0.3s', backdropFilter: 'blur(8px)' }}>
                                                {captureReady ? '📸 Capture & Detect' : '⏳ Stabilising…'}
                                            </button>
                                            <button onClick={stopCamera}
                                                style={{ padding: '11px 20px', border: 'none', borderRadius: 50, background: 'rgba(0,0,0,0.5)', color: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', backdropFilter: 'blur(8px)' }}>
                                                ✕ Cancel
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Video upload tab */}
                        {activeTab === 'video' && (
                            <>
                                <div style={{ border: '2px dashed #D4A017', borderRadius: 18, padding: '40px 24px', textAlign: 'center', background: '#FFFBF0', cursor: 'pointer' }}
                                    onClick={() => videoInputRef.current?.click()}>
                                    <input ref={videoInputRef} type="file" accept="video/mp4,video/webm,video/avi,video/mov" style={{ display: 'none' }}
                                        onChange={e => { const f = e.target.files?.[0]; if (f) analyzeVideo(f) }} />
                                    <div style={{ fontSize: 56, marginBottom: 14 }}>🎥</div>
                                    <h3 style={{ fontFamily: '"Playfair Display",serif', color: '#1B4332', marginBottom: 8 }}>Upload a Video</h3>
                                    <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 4 }}>MP4 · WebM · MOV — up to 50 MB</p>
                                    <p style={{ color: '#9CA3AF', fontSize: 12 }}>We extract up to 5 frames and run detection on each, returning the highest-confidence result.</p>
                                </div>
                                {loading && (
                                    <div style={{ textAlign: 'center', padding: '28px 0' }}>
                                        <div style={{ width: 36, height: 36, border: '3px solid rgba(45,106,79,0.2)', borderTopColor: '#1B4332', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 12px' }} />
                                        <p style={{ color: '#6B7280', fontSize: 14 }}>Extracting frames and analysing…</p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* ── Right panel: results ───────────────────────────────────── */}
                    {(result || error) && (
                        <div style={{ animation: 'fadeSlideIn 0.45s ease both' }}>
                            <div className="results-panel">
                                <h3>Detection Results</h3>

                                {error && <div className="alert alert-error" style={{ marginBottom: 0 }}>⚠️ {error}</div>}

                                {result && (
                                    <>
                                        {/* Captured frame thumbnail */}
                                        {preview && (
                                            <img src={preview} alt="Analysed" style={{ width: '100%', borderRadius: 12, marginBottom: 16, maxHeight: 160, objectFit: 'cover' }} />
                                        )}

                                        {/* Top breed hero */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px', borderRadius: 16, background: 'rgba(250,247,240,0.80)', border: '1.5px solid var(--border)', marginBottom: 16 }}>
                                            <span style={{ fontSize: 42 }}>{result.species === 'buffalo' ? '🐃' : '🐄'}</span>
                                            <div>
                                                <div style={{ fontFamily: '"Playfair Display",serif', fontSize: 20, color: 'var(--primary)', fontWeight: 700 }}>{result.top_breed}</div>
                                                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2, textTransform: 'capitalize' }}>
                                                    {result.species} · {(result.confidence * 100).toFixed(1)}% confidence
                                                    {result.confidence < 0.60 && <span style={{ marginLeft: 6, color: '#D97706', fontWeight: 600 }}>· Low confidence</span>}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Confidence bars */}
                                        <div style={{ marginBottom: 16 }}>
                                            {result.predictions?.map((p, i) => (
                                                <ConfBar key={i} label={p.breed} value={p.confidence} rank={p.rank} />
                                            ))}
                                        </div>

                                        {/* Breed description */}
                                        {breedInfo && (
                                            <>
                                                <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, marginBottom: 12, padding: '10px 14px', background: '#F9F7F4', borderRadius: 10, border: '1px solid #E5E0D8' }}>
                                                    {breedInfo.description}
                                                </div>

                                                <div className="detail-grid" style={{ marginBottom: 12 }}>
                                                    <div className="detail-item"><div className="detail-key">Origin</div><div className="detail-val">{breedInfo.origin}</div></div>
                                                    {breedInfo.milkYield && <div className="detail-item"><div className="detail-key">Milk Yield</div><div className="detail-val">{breedInfo.milkYield}</div></div>}
                                                    {result.estimated_age && <div className="detail-item"><div className="detail-key">Est. Age</div><div className="detail-val">{result.estimated_age}</div></div>}
                                                    <div className="detail-item"><div className="detail-key">Model</div><div className="detail-val" style={{ fontSize: 11 }}>{result.model_version}</div></div>
                                                </div>

                                                <div style={{ marginBottom: 12 }}>
                                                    <div style={{ fontWeight: 700, fontSize: 13, color: '#1B4332', marginBottom: 6 }}>Key Characteristics</div>
                                                    <ul style={{ paddingLeft: 18, margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.8 }}>
                                                        {breedInfo.characteristics.map((c, i) => <li key={i}>{c}</li>)}
                                                    </ul>
                                                </div>

                                                <div>
                                                    <div style={{ fontWeight: 700, fontSize: 13, color: '#1B4332', marginBottom: 6 }}>Care Tips</div>
                                                    {breedInfo.careTips.map((tip, i) => (
                                                        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: '#374151', marginBottom: 5 }}>
                                                            <span style={{ color: '#D4A017', fontWeight: 700, marginTop: 1 }}>✓</span> {tip}
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        )}

                                        <button className="btn btn-ghost" onClick={reset} style={{ marginTop: 16, width: '100%' }}>🔄 Try Another</button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* How it works — shown only before results */}
                {!result && !error && activeTab === 'upload' && (
                    <div className="section" style={{ padding: '56px 0 0' }}>
                        <div className="sec-head reveal">How Detection Works</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 18 }}>
                            {[
                                { n: '01', emoji: '📤', title: 'Upload / Capture', desc: 'Drop a photo, capture live from camera, or upload a video clip.' },
                                { n: '02', emoji: '🧠', title: 'Preprocessing', desc: 'Image is auto-enhanced (contrast, normalisation) before inference.' },
                                { n: '03', emoji: '🔬', title: 'CLIP Zero-Shot AI', desc: 'OpenAI CLIP model scores the image against all 25 Indian breed labels.' },
                                { n: '04', emoji: '📊', title: 'Ensemble Scoring', desc: 'Low-confidence results undergo secondary heuristic classification.' },
                            ].map((s, i) => (
                                <div key={i} className="feature reveal" data-d={i + 1} style={{ borderLeft: '5px solid var(--accent)' }}>
                                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                                        <span style={{ fontFamily: '"Space Mono",monospace', fontWeight: 900, fontSize: 24, color: 'var(--accent)' }}>{s.n}</span>
                                        <span style={{ fontSize: 26 }}>{s.emoji}</span>
                                    </div>
                                    <h3>{s.title}</h3>
                                    <p>{s.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
