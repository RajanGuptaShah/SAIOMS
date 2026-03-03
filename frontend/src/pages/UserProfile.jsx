import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
    getUserProfile, getUserAnimals, followUser, unfollowUser,
    updateMyProfile, uploadAvatar,
} from '../services/api'

const BASE = import.meta.env.VITE_API_BASE_URL || ''

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function avatarUrl(path) {
    if (!path) return null
    return path.startsWith('http') ? path : `${BASE}${path}`
}

function AnimalCard({ animal }) {
    const species = animal.species === 'buffalo' ? '🐃' : '🐄'
    return (
        <Link to={`/animal/${animal.animal_id}`} style={{ textDecoration: 'none' }}>
            <div style={{ background: '#fff', border: '1.5px solid #E5E0D8', borderRadius: 18, overflow: 'hidden', transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(27,67,50,0.12)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}>
                <div style={{ background: 'linear-gradient(135deg, rgba(45,106,79,0.10), rgba(212,160,23,0.08))', padding: '24px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: 46 }}>{species}</div>
                </div>
                <div style={{ padding: '12px 14px' }}>
                    <div style={{ fontWeight: 700, color: '#1B4332', fontSize: 13, marginBottom: 3 }}>{animal.breed || 'Unknown Breed'}</div>
                    <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'capitalize' }}>
                        {animal.species} · {animal.gender}
                        {animal.health_status && ` · ${animal.health_status.replace('_', ' ')}`}
                    </div>
                    {(animal.city || animal.district) && (
                        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
                            📍 {[animal.city, animal.district, animal.state].filter(Boolean).join(', ')}
                        </div>
                    )}
                </div>
            </div>
        </Link>
    )
}

/* ── Edit Profile Modal ──────────────────────────────────────────────────── */
function EditProfileModal({ user, onClose, onSaved }) {
    const [form, setForm] = useState({ name: user.name || '', bio: user.bio || '', location: user.location || '', isPublic: user.isPublic !== false })
    const [avatarFile, setAvatarFile] = useState(null)
    const [avatarPreview, setAvatarPreview] = useState(user.profilePhoto ? avatarUrl(user.profilePhoto) : null)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)
    const fileRef = useRef(null)

    const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

    const handleAvatarChange = e => {
        const f = e.target.files?.[0]
        if (!f) return
        setAvatarFile(f)
        setAvatarPreview(URL.createObjectURL(f))
    }

    const handleSave = async e => {
        e.preventDefault()
        setSaving(true); setError(null)
        try {
            if (avatarFile) await uploadAvatar(avatarFile)
            const updated = await updateMyProfile({ name: form.name, bio: form.bio, location: form.location, isPublic: form.isPublic })
            onSaved(updated.user || { ...user, ...form })
        } catch (err) {
            setError(err.response?.data?.detail || 'Save failed.')
        } finally { setSaving(false) }
    }

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
            onClick={e => e.target === e.currentTarget && onClose()}>
            <div style={{ background: '#fff', borderRadius: 24, width: '100%', maxWidth: 480, padding: '28px 28px 24px', boxShadow: '0 24px 80px rgba(0,0,0,0.22)', animation: 'fadeSlideIn 0.25s ease both' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
                    <h3 style={{ fontFamily: '"Playfair Display",serif', color: '#1B4332', margin: 0, fontSize: 20 }}>Edit Profile</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#6B7280', lineHeight: 1 }}>✕</button>
                </div>

                {/* Avatar */}
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                    <div onClick={() => fileRef.current?.click()}
                        style={{ width: 84, height: 84, borderRadius: '50%', margin: '0 auto 8px', cursor: 'pointer', overflow: 'hidden', border: '3px solid #D4A017', background: avatarPreview ? 'transparent' : '#E5E0D8', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                        {avatarPreview
                            ? <img src={avatarPreview} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <span style={{ fontSize: 32 }}>👤</span>}
                    </div>
                    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleAvatarChange} />
                    <button type="button" onClick={() => fileRef.current?.click()}
                        style={{ fontSize: 12, color: '#D4A017', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                        📷 Change Photo
                    </button>
                </div>

                <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                        <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>Display Name</label>
                        <input className="form-input" value={form.name} onChange={set('name')} maxLength={100} />
                    </div>
                    <div>
                        <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>Bio</label>
                        <textarea className="form-input" rows={3} maxLength={300} value={form.bio} onChange={set('bio')} style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 14 }} placeholder="Tell others about yourself…" />
                        <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'right', marginTop: 2 }}>{form.bio.length}/300</div>
                    </div>
                    <div>
                        <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>Location</label>
                        <input className="form-input" value={form.location} onChange={set('location')} maxLength={100} placeholder="City, State" />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input type="checkbox" id="isPublic" checked={form.isPublic} onChange={e => setForm(f => ({ ...f, isPublic: e.target.checked }))} style={{ width: 16, height: 16, accentColor: '#1B4332' }} />
                        <label htmlFor="isPublic" style={{ fontSize: 13, color: '#374151' }}>Public profile (others can find and follow you)</label>
                    </div>
                    {error && <div style={{ color: '#991b1b', fontSize: 13, background: 'rgba(220,38,38,0.07)', borderRadius: 10, padding: '8px 12px' }}>⚠️ {error}</div>}
                    <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                        <button type="button" className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
                        <button type="submit" disabled={saving} style={{ flex: 2, padding: '11px', border: 'none', borderRadius: 12, background: '#1B4332', color: '#fff', fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: 14 }}>
                            {saving ? '⏳ Saving…' : '✓ Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

/* ── Stat Pill ───────────────────────────────────────────────────────────── */
function StatChip({ label, value }) {
    return (
        <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: 22, color: '#1B4332', lineHeight: 1 }}>{value ?? '—'}</div>
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 3 }}>{label}</div>
        </div>
    )
}

/* ── Notification Bell (named export for Navbar) ─────────────────────────── */
export function NotificationBell({ animals = [] }) {
    const [open, setOpen] = useState(false)

    // Check for overdue vaccinations (health_status contains 'sick' or last_checkup > 6 months)
    const alerts = animals.filter(a => {
        if (a.health_status === 'sick') return true
        if (!a.last_checkup) return false
        const months = (Date.now() - new Date(a.last_checkup)) / (1000 * 60 * 60 * 24 * 30)
        return months > 6
    }).slice(0, 5)

    const count = alerts.length

    return (
        <div style={{ position: 'relative' }}>
            <button
                onClick={() => setOpen(o => !o)}
                style={{ width: 36, height: 36, borderRadius: 10, border: '1.5px solid var(--nav-toggle-border)', background: 'var(--nav-toggle-bg)', color: 'var(--nav-toggle-color)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
                aria-label={`Notifications${count ? ` (${count})` : ''}`}
            >
                🔔
                {count > 0 && (
                    <span style={{ position: 'absolute', top: 2, right: 2, width: 14, height: 14, background: '#ef4444', borderRadius: '50%', fontSize: 9, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #fff' }}>
                        {count > 9 ? '9+' : count}
                    </span>
                )}
            </button>

            {open && (
                <>
                    {/* Backdrop */}
                    <div style={{ position: 'fixed', inset: 0, zIndex: 490 }} onClick={() => setOpen(false)} />
                    {/* Dropdown */}
                    <div style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, minWidth: 260, background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 16, boxShadow: '0 16px 50px rgba(27,67,50,0.18)', zIndex: 500, overflow: 'hidden', animation: 'fadeSlideIn 0.2s ease both' }}>
                        <div style={{ padding: '11px 14px', background: 'linear-gradient(135deg,#1B4332,#2D6A4F)', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 14 }}>🔔</span>
                            <span style={{ color: '#FAF7F0', fontWeight: 800, fontSize: 13 }}>Health Alerts</span>
                        </div>
                        {count === 0 ? (
                            <div style={{ padding: '20px 16px', textAlign: 'center', color: '#6B7280', fontSize: 13 }}>✅ All animals are up to date</div>
                        ) : (
                            <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                                {alerts.map((a, i) => (
                                    <div key={i} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                        <span style={{ fontSize: 20 }}>{a.species === 'buffalo' ? '🐃' : '🐄'}</span>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--dark)' }}>{a.breed || 'Animal'}</div>
                                            <div style={{ fontSize: 11, color: a.health_status === 'sick' ? '#ef4444' : '#D97706' }}>
                                                {a.health_status === 'sick' ? '🚨 Needs attention' : '⚠️ Checkup overdue'}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}

/* ── Main Component ──────────────────────────────────────────────────────── */

export default function UserProfile() {
    const { id } = useParams()
    const { user: me } = useAuth()
    const navigate = useNavigate()

    const isOwn = !id || id === me?._id

    const [profile, setProfile] = useState(null)
    const [animals, setAnimals] = useState([])
    const [loading, setLoading] = useState(true)
    const [animLoading, setAnimLoading] = useState(false)
    const [following, setFollowing] = useState(false)
    const [followLoading, setFollowLoading] = useState(false)
    const [tab, setTab] = useState('animals')
    const [editOpen, setEditOpen] = useState(false)
    const [error, setError] = useState(null)

    const targetId = isOwn ? me?._id : id

    const fetchProfile = useCallback(async () => {
        if (!targetId) return
        setLoading(true); setError(null)
        try {
            const data = await getUserProfile(targetId)
            setProfile(data.user)
            // Check if current user is following
            if (me && data.user?.followers?.includes?.(me._id)) setFollowing(true)
        } catch (err) {
            setError('Could not load profile.')
        } finally { setLoading(false) }
    }, [targetId, me])

    const fetchAnimals = useCallback(async () => {
        if (!targetId) return
        setAnimLoading(true)
        try {
            const data = await getUserAnimals(targetId)
            setAnimals(data.animals || [])
        } catch (_) { setAnimals([]) }
        finally { setAnimLoading(false) }
    }, [targetId])

    useEffect(() => { fetchProfile() }, [fetchProfile])
    useEffect(() => { if (tab === 'animals') fetchAnimals() }, [tab, fetchAnimals])

    const handleFollow = async () => {
        if (!me) { navigate('/login'); return }
        setFollowLoading(true)
        try {
            if (following) {
                await unfollowUser(targetId)
                setFollowing(false)
                setProfile(p => ({ ...p, followersCount: Math.max(0, (p.followersCount || 1) - 1) }))
            } else {
                await followUser(targetId)
                setFollowing(true)
                setProfile(p => ({ ...p, followersCount: (p.followersCount || 0) + 1 }))
            }
        } catch (err) {
            console.error('Follow error:', err.response?.data?.detail)
        } finally { setFollowLoading(false) }
    }

    const handleProfileSaved = (updatedUser) => {
        setProfile(p => ({ ...p, ...updatedUser }))
        setEditOpen(false)
    }

    /* ── Loading skeleton ── */
    if (loading) return (
        <div style={{ paddingTop: 'calc(var(--nav-h) + 40px)', textAlign: 'center', color: '#6B7280' }}>
            <div style={{ width: 40, height: 40, border: '3px solid rgba(45,106,79,0.2)', borderTopColor: '#1B4332', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 16px' }} />
            Loading profile…
        </div>
    )

    if (error || !profile) return (
        <div style={{ paddingTop: 'calc(var(--nav-h) + 60px)', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>😕</div>
            <h2 style={{ color: '#1B4332', marginBottom: 8 }}>Profile not found</h2>
            <p style={{ color: '#6B7280', marginBottom: 20 }}>{error || 'This user does not exist or their profile is private.'}</p>
            <Link to="/" className="btn btn-green">← Back to Home</Link>
        </div>
    )

    const photo = avatarUrl(profile.profilePhoto)
    const joinedYear = profile.joinedAt ? new Date(profile.joinedAt).getFullYear() : null
    const roleLabel = { farmer: '🌾 Farmer', vet: '🏥 Veterinarian', admin: '⚙️ Admin' }[profile.role] || profile.role

    return (
        <div style={{ paddingTop: 'var(--nav-h)', minHeight: '100vh', background: '#FAF7F0' }}>

            {/* ── Cover / Hero ── */}
            <div style={{ background: 'linear-gradient(135deg, #1B4332 0%, #2D6A4F 45%, #52796F 100%)', padding: '48px 20px 80px', textAlign: 'center', position: 'relative' }}>
                {/* Back button */}
                {!isOwn && (
                    <button onClick={() => navigate(-1)}
                        style={{ position: 'absolute', top: 18, left: 18, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, color: '#fff', padding: '7px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', backdropFilter: 'blur(8px)' }}>
                        ← Back
                    </button>
                )}
                {/* Private badge */}
                {!profile.isPublic && isOwn && (
                    <div style={{ position: 'absolute', top: 18, right: 18, background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: '5px 10px', color: '#fff', fontSize: 12, fontWeight: 700, backdropFilter: 'blur(8px)' }}>🔒 Private</div>
                )}

                {/* Avatar */}
                <div style={{ width: 100, height: 100, borderRadius: '50%', margin: '0 auto 14px', border: '4px solid rgba(255,255,255,0.85)', overflow: 'hidden', background: photo ? 'transparent' : 'rgba(255,255,255,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}>
                    {photo
                        ? <img src={photo} alt={profile.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontSize: 42, lineHeight: 1 }}>👤</span>}
                </div>

                {/* Name & role */}
                <h1 style={{ fontFamily: '"Playfair Display",serif', color: '#fff', fontSize: 26, fontWeight: 800, marginBottom: 4 }}>{profile.name}</h1>
                <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginBottom: 10 }}>
                    <span style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 999, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>{roleLabel}</span>
                    {profile.location && <span style={{ marginLeft: 10 }}>📍 {profile.location}</span>}
                </div>
                {profile.bio && (
                    <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, maxWidth: '50ch', margin: '0 auto 14px', lineHeight: 1.6 }}>{profile.bio}</p>
                )}
                {joinedYear && <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>Member since {joinedYear}</div>}
            </div>

            {/* ── Stats bar (floats over hero) ── */}
            <div style={{ maxWidth: 680, margin: '-36px auto 0', padding: '0 16px' }}>
                <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 8px 40px rgba(27,67,50,0.12)', padding: '18px 24px', display: 'flex', justifyContent: 'space-evenly', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <StatChip label="Animals" value={profile.animalsCount ?? animals.length} />
                    <div style={{ width: 1, height: 36, background: '#E5E0D8' }} />
                    <StatChip label="Followers" value={profile.followersCount ?? 0} />
                    <div style={{ width: 1, height: 36, background: '#E5E0D8' }} />
                    <StatChip label="Following" value={profile.followingCount ?? 0} />
                    <div style={{ width: 1, height: 36, background: '#E5E0D8' }} />
                    {/* Actions */}
                    {isOwn ? (
                        <button onClick={() => setEditOpen(true)}
                            style={{ padding: '9px 20px', border: '1.5px solid #1B4332', borderRadius: 12, background: 'transparent', color: '#1B4332', fontWeight: 700, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
                            ✏️ Edit Profile
                        </button>
                    ) : (
                        <button onClick={handleFollow} disabled={followLoading}
                            style={{ padding: '9px 22px', border: 'none', borderRadius: 12, background: following ? '#E5E0D8' : '#1B4332', color: following ? '#374151' : '#fff', fontWeight: 800, cursor: followLoading ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'inherit', transition: 'all 0.2s' }}>
                            {followLoading ? '⏳' : following ? '✓ Following' : '+ Follow'}
                        </button>
                    )}
                </div>
            </div>

            {/* ── Tab bar ── */}
            <div style={{ maxWidth: 680, margin: '24px auto 0', padding: '0 16px' }}>
                <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid #E5E0D8', marginBottom: 24 }}>
                    {[
                        { id: 'animals', label: '🐄 Animals' },
                        { id: 'about', label: '👤 About' },
                    ].map(t => (
                        <button key={t.id} onClick={() => setTab(t.id)}
                            style={{ padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: tab === t.id ? 800 : 500, fontSize: 14, color: tab === t.id ? '#1B4332' : '#6B7280', fontFamily: 'inherit', borderBottom: `3px solid ${tab === t.id ? '#1B4332' : 'transparent'}`, marginBottom: -2, transition: 'all 0.2s' }}>
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Animals grid */}
                {tab === 'animals' && (
                    animLoading ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>
                            <div style={{ width: 32, height: 32, border: '3px solid rgba(45,106,79,0.2)', borderTopColor: '#1B4332', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 12px' }} />
                            Loading animals…
                        </div>
                    ) : animals.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '48px 20px', color: '#6B7280' }}>
                            <div style={{ fontSize: 48, marginBottom: 12 }}>🐄</div>
                            <p style={{ fontSize: 15 }}>{isOwn ? 'You haven\'t registered any animals yet.' : 'No registered animals.'}</p>
                            {isOwn && <Link to="/register" className="btn btn-green" style={{ marginTop: 12, display: 'inline-block' }}>+ Register an Animal</Link>}
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16, paddingBottom: 40 }}>
                            {animals.map(a => <AnimalCard key={a.animal_id} animal={a} />)}
                        </div>
                    )
                )}

                {/* About tab */}
                {tab === 'about' && (
                    <div style={{ paddingBottom: 40 }}>
                        <div className="card">
                            <div className="card-body">
                                <div className="detail-grid">
                                    <div className="detail-item"><div className="detail-key">Name</div><div className="detail-val">{profile.name}</div></div>
                                    {profile.location && <div className="detail-item"><div className="detail-key">Location</div><div className="detail-val">📍 {profile.location}</div></div>}
                                    <div className="detail-item"><div className="detail-key">Role</div><div className="detail-val">{roleLabel}</div></div>
                                    {joinedYear && <div className="detail-item"><div className="detail-key">Member Since</div><div className="detail-val">{joinedYear}</div></div>}
                                    <div className="detail-item"><div className="detail-key">Profile</div><div className="detail-val">{profile.isPublic ? '🌐 Public' : '🔒 Private'}</div></div>
                                </div>
                                {profile.bio && (
                                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #E5E0D8' }}>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Bio</div>
                                        <p style={{ color: '#374151', fontSize: 14, lineHeight: 1.7, margin: 0 }}>{profile.bio}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                        {isOwn && (
                            <div style={{ marginTop: 16, textAlign: 'center' }}>
                                <button onClick={() => setEditOpen(true)} className="btn btn-ghost" style={{ fontSize: 13 }}>✏️ Edit Profile Details</button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Edit modal */}
            {editOpen && (
                <EditProfileModal
                    user={{ ...profile, profilePhoto: profile.profilePhoto }}
                    onClose={() => setEditOpen(false)}
                    onSaved={handleProfileSaved}
                />
            )}
        </div>
    )
}
