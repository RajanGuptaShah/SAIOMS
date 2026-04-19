// import { useState, useEffect, useRef, useCallback } from 'react'
// import { useParams, Link, useNavigate, useLocation } from 'react-router-dom'
// import { useAuth } from '../context/AuthContext'
// import {
//     getUserProfile, getUserAnimals, followUser, unfollowUser,
//     updateMyProfile, uploadAvatar,
// } from '../services/api'

// const BASE = import.meta.env.VITE_API_BASE_URL || ''

// /* ── Helpers ─────────────────────────────────────────────────────────────── */
// function avatarUrl(path) {
//     if (!path) return null
//     return path.startsWith('http') ? path : `${BASE}${path}`
// }

// function AnimalCard({ animal }) {
//     const species = animal.species === 'buffalo' ? '🐃' : '🐄'
//     return (
//         <Link to={`/animal/${animal.animal_id}`} style={{ textDecoration: 'none' }}>
//             <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 18, overflow: 'hidden', transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'pointer' }}
//                 onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(27,67,50,0.12)' }}
//                 onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}>
//                 <div style={{ background: 'linear-gradient(135deg, rgba(45,106,79,0.10), rgba(212,160,23,0.08))', padding: '24px 16px', textAlign: 'center' }}>
//                     <div style={{ fontSize: 46 }}>{species}</div>
//                 </div>
//                 <div style={{ padding: '12px 14px' }}>
//                     <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 13, marginBottom: 3 }}>{animal.breed || 'Unknown Breed'}</div>
//                     <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'capitalize' }}>
//                         {animal.species} · {animal.gender}
//                         {animal.health_status && ` · ${animal.health_status.replace('_', ' ')}`}
//                     </div>
//                     {(animal.city || animal.district) && (
//                         <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
//                             📍 {[animal.city, animal.district, animal.state].filter(Boolean).join(', ')}
//                         </div>
//                     )}
//                 </div>
//             </div>
//         </Link>
//     )
// }

// /* ── Edit Profile Modal ──────────────────────────────────────────────────── */
// function EditProfileModal({ user, onClose, onSaved }) {
//     const [form, setForm] = useState({ name: user.name || '', bio: user.bio || '', location: user.location || '', isPublic: user.isPublic !== false })
//     const [avatarFile, setAvatarFile] = useState(null)
//     const [avatarPreview, setAvatarPreview] = useState(user.profilePhoto ? avatarUrl(user.profilePhoto) : null)
//     const [saving, setSaving] = useState(false)
//     const [error, setError] = useState(null)
//     const fileRef = useRef(null)

//     const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

//     const handleAvatarChange = e => {
//         const f = e.target.files?.[0]
//         if (!f) return
//         setAvatarFile(f)
//         setAvatarPreview(URL.createObjectURL(f))
//     }

//     const handleSave = async e => {
//         e.preventDefault()
//         setSaving(true); setError(null)
//         try {
//             if (avatarFile) await uploadAvatar(avatarFile)
//             const updated = await updateMyProfile({ name: form.name, bio: form.bio, location: form.location, isPublic: form.isPublic })
//             onSaved(updated.user || { ...user, ...form })
//         } catch (err) {
//             setError(err.response?.data?.detail || 'Save failed.')
//         } finally { setSaving(false) }
//     }

//     return (
//         <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
//             onClick={e => e.target === e.currentTarget && onClose()}>
//             <div style={{ background: 'var(--surface)', borderRadius: 24, width: '100%', maxWidth: 480, padding: '28px 28px 24px', boxShadow: '0 24px 80px rgba(0,0,0,0.22)', animation: 'fadeSlideIn 0.25s ease both' }}>
//                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
//                     <h3 style={{ fontFamily: '"Playfair Display",serif', color: 'var(--primary)', margin: 0, fontSize: 20 }}>Edit Profile</h3>
//                     <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--muted)', lineHeight: 1 }}>✕</button>
//                 </div>

//                 {/* Avatar */}
//                 <div style={{ textAlign: 'center', marginBottom: 20 }}>
//                     <div onClick={() => fileRef.current?.click()}
//                         style={{ width: 84, height: 84, borderRadius: '50%', margin: '0 auto 8px', cursor: 'pointer', overflow: 'hidden', border: '3px solid #D4A017', background: avatarPreview ? 'transparent' : '#E5E0D8', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
//                         {avatarPreview
//                             ? <img src={avatarPreview} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
//                             : <span style={{ fontSize: 32 }}>👤</span>}
//                     </div>
//                     <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleAvatarChange} />
//                     <button type="button" onClick={() => fileRef.current?.click()}
//                         style={{ fontSize: 12, color: '#D4A017', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
//                         📷 Change Photo
//                     </button>
//                 </div>

//                 <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
//                     <div>
//                         <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>Display Name</label>
//                         <input className="form-input" value={form.name} onChange={set('name')} maxLength={100} />
//                     </div>
//                     <div>
//                         <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>Bio</label>
//                         <textarea className="form-input" rows={3} maxLength={300} value={form.bio} onChange={set('bio')} style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 14 }} placeholder="Tell others about yourself…" />
//                         <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'right', marginTop: 2 }}>{form.bio.length}/300</div>
//                     </div>
//                     <div>
//                         <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>Location</label>
//                         <input className="form-input" value={form.location} onChange={set('location')} maxLength={100} placeholder="City, State" />
//                     </div>
//                     <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
//                         <input type="checkbox" id="isPublic" checked={form.isPublic} onChange={e => setForm(f => ({ ...f, isPublic: e.target.checked }))} style={{ width: 16, height: 16, accentColor: '#1B4332' }} />
//                         <label htmlFor="isPublic" style={{ fontSize: 13, color: '#374151' }}>Public profile (others can find and follow you)</label>
//                     </div>
//                     {error && <div style={{ color: '#991b1b', fontSize: 13, background: 'rgba(220,38,38,0.07)', borderRadius: 10, padding: '8px 12px' }}>⚠️ {error}</div>}
//                     <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
//                         <button type="button" className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
//                         <button type="submit" disabled={saving} style={{ flex: 2, padding: '11px', border: 'none', borderRadius: 12, background: '#1B4332', color: '#fff', fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: 14 }}>
//                             {saving ? '⏳ Saving…' : '✓ Save Changes'}
//                         </button>
//                     </div>
//                 </form>
//             </div>
//         </div>
//     )
// }

// /* ── Stat Pill ───────────────────────────────────────────────────────────── */
// function StatChip({ label, value }) {
//     return (
//         <div style={{ textAlign: 'center' }}>
//             <div style={{ fontWeight: 800, fontSize: 22, color: '#1B4332', lineHeight: 1 }}>{value ?? '—'}</div>
//             <div style={{ fontSize: 12, color: '#6B7280', marginTop: 3 }}>{label}</div>
//         </div>
//     )
// }

// /* ── Notification Bell (named export for Navbar) ─────────────────────────── */
// export function NotificationBell({ animals = [] }) {
//     const [open, setOpen] = useState(false)

//     // Check for overdue vaccinations (health_status contains 'sick' or last_checkup > 6 months)
//     const alerts = animals.filter(a => {
//         if (a.health_status === 'sick') return true
//         if (!a.last_checkup) return false
//         const months = (Date.now() - new Date(a.last_checkup)) / (1000 * 60 * 60 * 24 * 30)
//         return months > 6
//     }).slice(0, 5)

//     const count = alerts.length

//     return (
//         <div style={{ position: 'relative' }}>
//             <button
//                 onClick={() => setOpen(o => !o)}
//                 style={{ width: 36, height: 36, borderRadius: 10, border: '1.5px solid var(--nav-toggle-border)', background: 'var(--nav-toggle-bg)', color: 'var(--nav-toggle-color)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
//                 aria-label={`Notifications${count ? ` (${count})` : ''}`}
//             >
//                 🔔
//                 {count > 0 && (
//                     <span style={{ position: 'absolute', top: 2, right: 2, width: 14, height: 14, background: '#ef4444', borderRadius: '50%', fontSize: 9, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #fff' }}>
//                         {count > 9 ? '9+' : count}
//                     </span>
//                 )}
//             </button>

//             {open && (
//                 <>
//                     {/* Backdrop — keep below profile dropdown (9000) */}
//                     <div style={{ position: 'fixed', inset: 0, zIndex: 8900 }} onClick={() => setOpen(false)} />
//                     {/* Dropdown */}
//                     <div style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, minWidth: 260, background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 16, boxShadow: '0 16px 50px rgba(27,67,50,0.18)', zIndex: 8950, overflow: 'hidden', animation: 'fadeSlideIn 0.2s ease both' }}>
//                         <div style={{ padding: '11px 14px', background: 'linear-gradient(135deg,#1B4332,#2D6A4F)', display: 'flex', alignItems: 'center', gap: 8 }}>
//                             <span style={{ fontSize: 14 }}>🔔</span>
//                             <span style={{ color: '#FAF7F0', fontWeight: 800, fontSize: 13 }}>Health Alerts</span>
//                         </div>
//                         {count === 0 ? (
//                             <div style={{ padding: '20px 16px', textAlign: 'center', color: '#6B7280', fontSize: 13 }}>✅ All animals are up to date</div>
//                         ) : (
//                             <div style={{ maxHeight: 240, overflowY: 'auto' }}>
//                                 {alerts.map((a, i) => (
//                                     <div key={i} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
//                                         <span style={{ fontSize: 20 }}>{a.species === 'buffalo' ? '🐃' : '🐄'}</span>
//                                         <div>
//                                             <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--dark)' }}>{a.breed || 'Animal'}</div>
//                                             <div style={{ fontSize: 11, color: a.health_status === 'sick' ? '#ef4444' : '#D97706' }}>
//                                                 {a.health_status === 'sick' ? '🚨 Needs attention' : '⚠️ Checkup overdue'}
//                                             </div>
//                                         </div>
//                                     </div>
//                                 ))}
//                             </div>
//                         )}
//                     </div>
//                 </>
//             )}
//         </div>
//     )
// }

// /* ── Main Component ──────────────────────────────────────────────────────── */

// // Map nav tab IDs → profile tab IDs
// const NAV_TAB_MAP = {
//     notifications: 'about',
//     vaccines: 'about',
//     transfers: 'about',
//     animals: 'animals',
//     about: 'about',
// }

// export default function UserProfile() {
//     const { id } = useParams()
//     const { user: me } = useAuth()
//     const navigate = useNavigate()
//     const location = useLocation()

//     const isOwn = !id || id === me?._id

//     // Determine initial tab from navbar navigation state
//     const initTab = NAV_TAB_MAP[location.state?.tab] || 'animals'

//     const [profile, setProfile] = useState(null)
//     const [animals, setAnimals] = useState([])
//     const [loading, setLoading] = useState(true)
//     const [animLoading, setAnimLoading] = useState(false)
//     const [following, setFollowing] = useState(false)
//     const [followLoading, setFollowLoading] = useState(false)
//     const [tab, setTab] = useState(initTab)
//     const [editOpen, setEditOpen] = useState(false)
//     const [error, setError] = useState(null)

//     const targetId = isOwn ? me?._id : id

//     const fetchProfile = useCallback(async () => {
//         if (!targetId) return
//         setLoading(true); setError(null)
//         try {
//             const data = await getUserProfile(targetId)
//             setProfile(data.user)
//             // Check if current user is following
//             if (me && data.user?.followers?.includes?.(me._id)) setFollowing(true)
//         } catch (err) {
//             setError('Could not load profile.')
//         } finally { setLoading(false) }
//     }, [targetId, me])

//     const fetchAnimals = useCallback(async () => {
//         if (!targetId) return
//         setAnimLoading(true)
//         try {
//             const data = await getUserAnimals(targetId)
//             setAnimals(data.animals || [])
//         } catch (_) { setAnimals([]) }
//         finally { setAnimLoading(false) }
//     }, [targetId])

//     useEffect(() => { fetchProfile() }, [fetchProfile])
//     useEffect(() => { if (tab === 'animals') fetchAnimals() }, [tab, fetchAnimals])

//     const handleFollow = async () => {
//         if (!me) { navigate('/login'); return }
//         setFollowLoading(true)
//         try {
//             if (following) {
//                 await unfollowUser(targetId)
//                 setFollowing(false)
//                 setProfile(p => ({ ...p, followersCount: Math.max(0, (p.followersCount || 1) - 1) }))
//             } else {
//                 await followUser(targetId)
//                 setFollowing(true)
//                 setProfile(p => ({ ...p, followersCount: (p.followersCount || 0) + 1 }))
//             }
//         } catch (err) {
//             console.error('Follow error:', err.response?.data?.detail)
//         } finally { setFollowLoading(false) }
//     }

//     const handleProfileSaved = (updatedUser) => {
//         setProfile(p => ({ ...p, ...updatedUser }))
//         setEditOpen(false)
//     }

//     /* ── Loading skeleton ── */
//     if (loading) return (
//         <div style={{ paddingTop: 'calc(var(--nav-h) + 40px)', textAlign: 'center', color: '#6B7280' }}>
//             <div style={{ width: 40, height: 40, border: '3px solid rgba(45,106,79,0.2)', borderTopColor: '#1B4332', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 16px' }} />
//             Loading profile…
//         </div>
//     )

//     if (error || !profile) return (
//         <div style={{ paddingTop: 'calc(var(--nav-h) + 60px)', textAlign: 'center' }}>
//             <div style={{ fontSize: 48, marginBottom: 12 }}>😕</div>
//             <h2 style={{ color: '#1B4332', marginBottom: 8 }}>Profile not found</h2>
//             <p style={{ color: '#6B7280', marginBottom: 20 }}>{error || 'This user does not exist or their profile is private.'}</p>
//             <Link to="/" className="btn btn-green">← Back to Home</Link>
//         </div>
//     )

//     const photo = avatarUrl(profile.profilePhoto)
//     const joinedYear = profile.joinedAt ? new Date(profile.joinedAt).getFullYear() : null
//     const roleLabel = { farmer: '🌾 Farmer', vet: '🏥 Veterinarian', admin: '⚙️ Admin' }[profile.role] || profile.role

//     return (
//         <div style={{ paddingTop: 'var(--nav-h)', minHeight: '100vh', background: '#FAF7F0' }}>

//             {/* ── Cover / Hero ── */}
//             <div style={{ background: 'linear-gradient(135deg, #1B4332 0%, #2D6A4F 45%, #52796F 100%)', padding: '48px 20px 80px', textAlign: 'center', position: 'relative' }}>
//                 {/* Back button */}
//                 {!isOwn && (
//                     <button onClick={() => navigate(-1)}
//                         style={{ position: 'absolute', top: 18, left: 18, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, color: '#fff', padding: '7px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', backdropFilter: 'blur(8px)' }}>
//                         ← Back
//                     </button>
//                 )}
//                 {/* Private badge */}
//                 {!profile.isPublic && isOwn && (
//                     <div style={{ position: 'absolute', top: 18, right: 18, background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: '5px 10px', color: '#fff', fontSize: 12, fontWeight: 700, backdropFilter: 'blur(8px)' }}>🔒 Private</div>
//                 )}

//                 {/* Avatar */}
//                 <div style={{ width: 100, height: 100, borderRadius: '50%', margin: '0 auto 14px', border: '4px solid rgba(255,255,255,0.85)', overflow: 'hidden', background: photo ? 'transparent' : 'rgba(255,255,255,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}>
//                     {photo
//                         ? <img src={photo} alt={profile.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
//                         : <span style={{ fontSize: 42, lineHeight: 1 }}>👤</span>}
//                 </div>

//                 {/* Name & role */}
//                 <h1 style={{ fontFamily: '"Playfair Display",serif', color: '#fff', fontSize: 26, fontWeight: 800, marginBottom: 4 }}>{profile.name}</h1>
//                 <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginBottom: 10 }}>
//                     <span style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 999, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>{roleLabel}</span>
//                     {profile.location && <span style={{ marginLeft: 10 }}>📍 {profile.location}</span>}
//                 </div>
//                 {profile.bio && (
//                     <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, maxWidth: '50ch', margin: '0 auto 14px', lineHeight: 1.6 }}>{profile.bio}</p>
//                 )}
//                 {joinedYear && <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>Member since {joinedYear}</div>}
//             </div>

//             {/* ── Stats bar (floats over hero) ── */}
//             <div style={{ maxWidth: 680, margin: '-36px auto 0', padding: '0 16px' }}>
//                 <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 8px 40px rgba(27,67,50,0.12)', padding: '18px 24px', display: 'flex', justifyContent: 'space-evenly', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
//                     <StatChip label="Animals" value={profile.animalsCount ?? animals.length} />
//                     <div style={{ width: 1, height: 36, background: '#E5E0D8' }} />
//                     <StatChip label="Followers" value={profile.followersCount ?? 0} />
//                     <div style={{ width: 1, height: 36, background: '#E5E0D8' }} />
//                     <StatChip label="Following" value={profile.followingCount ?? 0} />
//                     <div style={{ width: 1, height: 36, background: '#E5E0D8' }} />
//                     {/* Actions */}
//                     {isOwn ? (
//                         <button onClick={() => setEditOpen(true)}
//                             style={{ padding: '9px 20px', border: '1.5px solid #1B4332', borderRadius: 12, background: 'transparent', color: '#1B4332', fontWeight: 700, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
//                             ✏️ Edit Profile
//                         </button>
//                     ) : (
//                         <button onClick={handleFollow} disabled={followLoading}
//                             style={{ padding: '9px 22px', border: 'none', borderRadius: 12, background: following ? '#E5E0D8' : '#1B4332', color: following ? '#374151' : '#fff', fontWeight: 800, cursor: followLoading ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'inherit', transition: 'all 0.2s' }}>
//                             {followLoading ? '⏳' : following ? '✓ Following' : '+ Follow'}
//                         </button>
//                     )}
//                 </div>
//             </div>

//             {/* ── Tab bar ── */}
//             <div style={{ maxWidth: 680, margin: '24px auto 0', padding: '0 16px' }}>
//                 <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid #E5E0D8', marginBottom: 24 }}>
//                     {[
//                         { id: 'animals', label: '🐄 Animals' },
//                         { id: 'about', label: '👤 About' },
//                     ].map(t => (
//                         <button key={t.id} onClick={() => setTab(t.id)}
//                             style={{ padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: tab === t.id ? 800 : 500, fontSize: 14, color: tab === t.id ? '#1B4332' : '#6B7280', fontFamily: 'inherit', borderBottom: `3px solid ${tab === t.id ? '#1B4332' : 'transparent'}`, marginBottom: -2, transition: 'all 0.2s' }}>
//                             {t.label}
//                         </button>
//                     ))}
//                 </div>

//                 {/* Animals grid */}
//                 {tab === 'animals' && (
//                     animLoading ? (
//                         <div style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>
//                             <div style={{ width: 32, height: 32, border: '3px solid rgba(45,106,79,0.2)', borderTopColor: '#1B4332', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 12px' }} />
//                             Loading animals…
//                         </div>
//                     ) : animals.length === 0 ? (
//                         <div style={{ textAlign: 'center', padding: '48px 20px', color: '#6B7280' }}>
//                             <div style={{ fontSize: 48, marginBottom: 12 }}>🐄</div>
//                             <p style={{ fontSize: 15 }}>{isOwn ? 'You haven\'t registered any animals yet.' : 'No registered animals.'}</p>
//                             {isOwn && <Link to="/register" className="btn btn-green" style={{ marginTop: 12, display: 'inline-block' }}>+ Register an Animal</Link>}
//                         </div>
//                     ) : (
//                         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16, paddingBottom: 40 }}>
//                             {animals.map(a => <AnimalCard key={a.animal_id} animal={a} />)}
//                         </div>
//                     )
//                 )}

//                 {/* About tab */}
//                 {tab === 'about' && (
//                     <div style={{ paddingBottom: 40 }}>
//                         <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 20, padding: '22px 24px', boxShadow: '0 4px 18px rgba(27,67,50,0.06)' }}>
//                             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px 24px' }}>
//                                 <div>
//                                     <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>Full Name</div>
//                                     <div style={{ fontWeight: 700, color: 'var(--dark)', fontSize: 14 }}>{profile.name}</div>
//                                 </div>
//                                 {isOwn && me?.email && (
//                                     <div>
//                                         <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>Email</div>
//                                         <div style={{ fontWeight: 600, color: 'var(--dark)', fontSize: 14 }}>✉️ {me.email}</div>
//                                     </div>
//                                 )}
//                                 {profile.location && (
//                                     <div>
//                                         <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>Location</div>
//                                         <div style={{ fontWeight: 600, color: 'var(--dark)', fontSize: 14 }}>📍 {profile.location}</div>
//                                     </div>
//                                 )}
//                                 <div>
//                                     <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>Role</div>
//                                     <div style={{ fontWeight: 600, color: 'var(--dark)', fontSize: 14 }}>{roleLabel}</div>
//                                 </div>
//                                 {joinedYear && (
//                                     <div>
//                                         <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>Member Since</div>
//                                         <div style={{ fontWeight: 600, color: 'var(--dark)', fontSize: 14 }}>🗓️ {joinedYear}</div>
//                                     </div>
//                                 )}
//                                 <div>
//                                     <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>Visibility</div>
//                                     <div style={{ fontWeight: 600, color: 'var(--dark)', fontSize: 14 }}>{profile.isPublic ? '🌐 Public' : '🔒 Private'}</div>
//                                 </div>
//                             </div>
//                             {/* Bio */}
//                             <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
//                                 <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Bio</div>
//                                 {profile.bio
//                                     ? <p style={{ color: 'var(--dark)', fontSize: 14, lineHeight: 1.75, margin: 0 }}>{profile.bio}</p>
//                                     : <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0, fontStyle: 'italic' }}>
//                                         {isOwn ? 'No bio yet — click Edit Profile to add one.' : 'No bio provided.'}
//                                     </p>
//                                 }
//                             </div>
//                         </div>
//                         {isOwn && (
//                             <div style={{ marginTop: 16, textAlign: 'center' }}>
//                                 <button onClick={() => setEditOpen(true)} className="btn btn-ghost" style={{ fontSize: 13 }}>✏️ Edit Profile Details</button>
//                             </div>
//                         )}
//                     </div>
//                 )}
//             </div>

//             {/* Edit modal */}
//             {editOpen && (
//                 <EditProfileModal
//                     user={{ ...profile, profilePhoto: profile.profilePhoto }}
//                     onClose={() => setEditOpen(false)}
//                     onSaved={handleProfileSaved}
//                 />
//             )}
//         </div>
//     )
// }


// =====================================================================================================



// =====================================================================================================

import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { listAnimals, getGeminiVaccineAlerts } from '../services/api'

const SP = { cattle: '🐄', buffalo: '🐃' }

function age(dob) {
    if (!dob) return null
    const ms = Date.now() - new Date(dob).getTime()
    const yrs = Math.floor(ms / (365.25 * 864e5)), mos = Math.floor((ms % (365.25 * 864e5)) / (30.44 * 864e5))
    return yrs > 0 ? `${yrs}y ${mos}m` : `${mos}m`
}
function daysUntil(d) { return d ? Math.ceil((new Date(d) - Date.now()) / 864e5) : null }

/* ── Seasonal vaccine schedule ─────────────────────────── */
const VACC_SCHEDULE = {
    cattle: [
        { vaccine: 'FMD (Foot & Mouth Disease)', months: [1, 7], notes: 'Every 6 months. Government IVRI vaccine, free at govt camps.' },
        { vaccine: 'HS (Haemorrhagic Septicaemia)', months: [5, 6], notes: 'Annually before monsoon (May–June). Especially important.' },
        { vaccine: 'BQ (Black Quarter)', months: [5, 6], notes: 'Annually before monsoon. Often combined with HS.' },
        { vaccine: 'Brucellosis', months: [0], notes: 'Female calves (4–8 months old) once in lifetime.' },
        { vaccine: 'Theileriosis (Tick Fever)', months: [3, 4], notes: 'Once — protects against tick-borne disease. Ask local vet.' },
        { vaccine: 'Deworming', months: [0, 3, 6, 9], notes: 'Every 3 months — improves milk & weight gain.' },
    ],
    buffalo: [
        { vaccine: 'FMD (Foot & Mouth Disease)', months: [1, 7], notes: 'Every 6 months. Same as cattle.' },
        { vaccine: 'HS (Haemorrhagic Septicaemia)', months: [5, 6], notes: 'Annually before monsoon. Critical for buffaloes.' },
        { vaccine: 'BQ (Black Quarter)', months: [5, 6], notes: 'Annually before monsoon.' },
        { vaccine: 'Brucellosis', months: [0], notes: 'Female calves once in lifetime.' },
        { vaccine: 'Deworming', months: [0, 3, 6, 9], notes: 'Every 3 months.' },
    ],
}

function getScheduleAlerts(animals) {
    const nowMonth = new Date().getMonth() // 0-11
    const alerts = []
    for (const a of animals) {
        const sched = VACC_SCHEDULE[a.species] || VACC_SCHEDULE.cattle
        const given = new Set((a.vaccinations || []).map(v => v.vaccine?.toLowerCase()))
        for (const s of sched) {
            // Check if due this month or next 2 months
            const isDue = s.months.some(m => {
                const diff = (m - nowMonth + 12) % 12
                return diff <= 2
            })
            if (!isDue) continue
            // Check if already vaccinated recently (within 5 months)
            const alreadyDone = [...given].some(g => g.includes(s.vaccine.split(' ')[0].toLowerCase()))
            if (alreadyDone) continue
            alerts.push({ animal: a, ...s, urgency: s.months.includes(nowMonth) ? 'now' : 'soon' })
        }
    }
    return alerts
}

/* ── Notification Bell ──────────────────────────────────── */
export function NotificationBell({ animals }) {
    const [open, setOpen] = useState(false)
    const navigate = useNavigate()
    const schedAlerts = getScheduleAlerts(animals)
    const count = schedAlerts.length
    return (
        <div style={{ position: 'relative' }}>
            <button onClick={() => setOpen(o => !o)} style={{
                position: 'relative', background: 'none', border: '1.5px solid var(--border)',
                borderRadius: 12, width: 38, height: 38, cursor: 'pointer', fontSize: 18,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                🔔
                {count > 0 && (
                    <span style={{ position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: '50%', background: '#dc2626', color: '#fff', fontSize: 10, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>
                        {count > 9 ? '9+' : count}
                    </span>
                )}
            </button>
            {open && (
                <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 400 }}>
                    <div onClick={e => e.stopPropagation()} style={{
                        position: 'absolute', top: 48, right: 0, width: 310,
                        background: '#fff', borderRadius: 18, border: '1.5px solid #E5E0D8',
                        boxShadow: '0 20px 50px rgba(27,67,50,0.16)', zIndex: 500, overflow: 'hidden',
                        animation: 'fadeSlideIn 0.2s ease both',
                    }}>
                        <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #F0EDE8' }}>
                            <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--primary)' }}>🔔 Vaccination Alerts</div>
                            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{count > 0 ? `${count} action${count > 1 ? 's' : ''} recommended` : 'All vaccinations up to date!'}</div>
                        </div>
                        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                            {count === 0 ? (
                                <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>✅ No alerts right now</div>
                            ) : schedAlerts.map((a, i) => (
                                <div key={i} style={{ padding: '10px 16px', borderBottom: '1px solid #F7F4EF', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                    <span style={{ fontSize: 20, flexShrink: 0 }}>{a.urgency === 'now' ? '🚨' : '💉'}</span>
                                    <div>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: a.urgency === 'now' ? '#991b1b' : 'var(--primary)' }}>{a.vaccine}</div>
                                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{SP[a.animal.species]} {a.animal.breed} · {a.animal.animal_id}</div>
                                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{a.notes}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div style={{ padding: '10px 16px', borderTop: '1px solid #F0EDE8' }}>
                            <button onClick={() => { setOpen(false); navigate('/profile', { state: { tab: 'vaccines' } }) }} style={{ width: '100%', padding: '9px', border: 'none', borderRadius: 10, background: 'var(--primary)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
                                View All Vaccine Alerts →
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

/* ── Stat Box ───────────────────────────────────────────── */
function Stat({ icon, value, label, color }) {
    return (
        <div style={{ background: '#fff', border: '1.5px solid #E5E0D8', borderRadius: 18, padding: '16px 18px', display: 'flex', gap: 12, alignItems: 'center', boxShadow: '0 2px 10px rgba(27,67,50,0.05)' }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{icon}</div>
            <div>
                <div style={{ fontSize: 26, fontWeight: 900, color: '#1A1A1A', lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{label}</div>
            </div>
        </div>
    )
}

/* ── Page ───────────────────────────────────────────────── */
export default function UserProfile() {
    const { user, logout, isAuth } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const [animals, setAnimals] = useState([])
    const [loading, setLoading] = useState(true)
    // Read initial tab from router state (set by dropdown links)
    const [tab, setTab] = useState(location.state?.tab || 'overview')
    const [geminiAlerts, setGeminiAlerts] = useState([])

    useEffect(() => {
        if (!isAuth) { navigate('/login'); return }
        listAnimals({ limit: 200 }).then(d => {
            const animalList = d.animals || d
            setAnimals(animalList)
            // Fetch Gemini AI vaccine alerts after loading animals
            if (animalList.length > 0) {
                const payload = {
                    animals: animalList.map(a => ({
                        species: a.species, breed: a.breed,
                        age: a.dob ? `${Math.floor((Date.now() - new Date(a.dob).getTime()) / (365.25 * 864e5))} years` : 'unknown',
                        vaccinations: a.vaccinations || [],
                        district: a.district, state: a.state || 'Uttar Pradesh',
                    })),
                    month: new Date().getMonth(),
                }
                getGeminiVaccineAlerts(payload)
                    .then(d => { if (d.alerts?.length) setGeminiAlerts(d.alerts) })
                    .catch(() => { /* silent fail — static fallback shown */ })
            }
        }).catch(() => setAnimals([])).finally(() => setLoading(false))
    }, [isAuth])

    // Also react if navigated again with different state
    useEffect(() => { if (location.state?.tab) setTab(location.state.tab) }, [location.state?.tab])

    if (!isAuth) return null

    // ── Derived ──────────────────────────────────────────
    const allTransfers = animals.flatMap(a =>
        (a.transfer_history || []).map(t => ({ ...t, animal_id: a.animal_id, breed: a.breed, species: a.species }))
    ).sort((a, b) => (b.date || '').localeCompare(a.date || ''))

    const schedAlerts = getScheduleAlerts(animals)
    const vaccDue = animals.flatMap(a =>
        (a.vaccinations || []).filter(v => v.next_due).map(v => ({ ...v, animal_id: a.animal_id, breed: a.breed, species: a.species, days: daysUntil(v.next_due) }))
    ).filter(v => v.days !== null && v.days <= 60).sort((a, b) => a.days - b.days)
    const overdue = vaccDue.filter(v => v.days < 0)
    const upcoming = vaccDue.filter(v => v.days >= 0)

    // All notifications combined
    const notifs = [
        ...overdue.map(v => ({ t: 'danger', icon: '🚨', txt: `${v.vaccine} OVERDUE (${Math.abs(v.days)}d) — ${v.breed} · ${v.animal_id}` })),
        ...schedAlerts.slice(0, 5).map(a => ({ t: a.urgency === 'now' ? 'warning' : 'info', icon: a.urgency === 'now' ? '⚠️' : '💉', txt: `${a.vaccine} due for your ${a.animal.breed} — ${a.notes}` })),
        ...allTransfers.slice(0, 3).map(t => ({ t: 'info', icon: '🔄', txt: `Transferred ${t.breed} from ${t.from_owner}${t.date ? ' · ' + t.date.slice(0, 10) : ''}` })),
    ]

    const NC = { danger: { bg: 'rgba(220,38,38,0.07)', c: '#991b1b', b: 'rgba(220,38,38,0.18)' }, warning: { bg: 'rgba(212,160,23,0.07)', c: '#92400e', b: 'rgba(212,160,23,0.22)' }, info: { bg: 'rgba(59,130,246,0.07)', c: '#1d4ed8', b: 'rgba(59,130,246,0.18)' } }

    const totalAlerts = schedAlerts.length + geminiAlerts.length
    const TABS = [
        { id: 'overview', label: '👤 Overview' },
        { id: 'vaccines', label: `💉 Vaccines${totalAlerts ? ` (${totalAlerts})` : ''}` },
        { id: 'notifications', label: `🔔 Alerts${notifs.length ? ` (${notifs.length})` : ''}` },
        { id: 'transfers', label: `🔄 Transfers${allTransfers.length ? ` (${allTransfers.length})` : ''}` },
    ]

    return (
        <div style={{ paddingTop: 'calc(var(--nav-h) + 28px)', paddingBottom: 60, minHeight: '100vh', background: '#FAF7F0' }}>
            <div style={{ width: 'min(860px, calc(100% - 36px))', margin: '0 auto' }}>

                {/* Profile card */}
                <div style={{ background: 'linear-gradient(135deg,#1B4332,#2D6A4F)', borderRadius: 22, padding: '24px 26px', marginBottom: 22, color: '#FAF7F0', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: -50, right: -50, width: 180, height: 180, borderRadius: '50%', background: 'rgba(250,247,240,0.05)' }} />
                    <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ width: 64, height: 64, borderRadius: 18, background: 'rgba(250,247,240,0.14)', border: '2px solid rgba(250,247,240,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, flexShrink: 0 }}>👤</div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontFamily: '"Playfair Display",serif', fontSize: 'clamp(18px,2.5vw,26px)', fontWeight: 800 }}>{user?.name}</div>
                            <div style={{ fontSize: 12, color: 'rgba(250,247,240,0.68)', marginTop: 2 }}>{user?.email}</div>
                            {user?.phone && <div style={{ fontSize: 12, color: 'rgba(250,247,240,0.68)' }}>📞 {user.phone}</div>}
                            {overdue.length > 0 && (
                                <div style={{ marginTop: 6, display: 'inline-block', fontSize: 11, padding: '2px 10px', borderRadius: 999, background: 'rgba(220,38,38,0.22)', border: '1px solid rgba(220,38,38,0.4)', color: '#fca5a5', fontWeight: 700 }}>
                                    🚨 {overdue.length} vaccine{overdue.length > 1 ? 's' : ''} overdue
                                </div>
                            )}
                        </div>
                        <button onClick={() => { logout(); navigate('/') }} style={{ padding: '8px 16px', border: '1.5px solid rgba(250,247,240,0.28)', borderRadius: 12, background: 'rgba(250,247,240,0.10)', color: 'rgba(250,247,240,0.88)', fontWeight: 700, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
                            🚪 Logout
                        </button>
                    </div>
                </div>

                {/* Stats */}
                {!loading && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12, marginBottom: 22 }}>
                        <Stat icon="📋" value={animals.length} label="Animals" color="rgba(45,106,79,0.10)" />
                        <Stat icon="❤️" value={animals.filter(a => a.health_status === 'healthy').length} label="Healthy" color="rgba(45,106,79,0.12)" />
                        <Stat icon="🔄" value={allTransfers.length} label="Transfers" color="rgba(59,130,246,0.10)" />
                        <Stat icon="💉" value={schedAlerts.length} label="Vaccine Alerts" color="rgba(220,38,38,0.08)" />
                    </div>
                )}

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 20, overflowX: 'auto', paddingBottom: 2 }}>
                    {TABS.map(t => (
                        <button key={t.id} onClick={() => setTab(t.id)} style={{
                            padding: '9px 14px', border: '1.5px solid', borderRadius: 12, cursor: 'pointer',
                            fontSize: 13, fontWeight: 700, fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all 0.18s',
                            borderColor: tab === t.id ? 'var(--primary)' : '#E5E0D8',
                            background: tab === t.id ? 'var(--primary)' : '#fff',
                            color: tab === t.id ? '#fff' : '#374151',
                        }}>{t.label}</button>
                    ))}
                </div>

                {loading && <div style={{ textAlign: 'center', padding: '50px 0', color: '#6B7280' }}><div style={{ width: 34, height: 34, border: '3px solid rgba(45,106,79,0.18)', borderTopColor: '#1B4332', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />Loading…</div>}

                {/* ── OVERVIEW ─────────────────────────────── */}
                {!loading && tab === 'overview' && (
                    <div style={{ display: 'grid', gap: 16 }}>
                        {/* Quick actions */}
                        <div style={{ background: '#fff', border: '1.5px solid #E5E0D8', borderRadius: 18, padding: '18px 20px' }}>
                            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#6B7280', marginBottom: 12 }}>Quick Actions</div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <Link to="/register" className="btn btn-gold btn-sm">➕ Register Animal</Link>
                                <Link to="/dashboard" className="btn btn-ghost btn-sm">📊 Dashboard</Link>
                                <Link to="/nearby" className="btn btn-ghost btn-sm">🗺️ Find Vets</Link>
                                <Link to="/detect" className="btn btn-ghost btn-sm">🔬 Breed Detect</Link>
                            </div>
                        </div>
                        {/* Top urgent alert */}
                        {schedAlerts.length > 0 && (
                            <div style={{ background: 'rgba(212,160,23,0.07)', border: '1.5px solid rgba(212,160,23,0.25)', borderRadius: 18, padding: '16px 20px' }}>
                                <div style={{ fontWeight: 800, fontSize: 13, color: '#92400e', marginBottom: 10 }}>💉 Recommended Vaccinations This Season</div>
                                {schedAlerts.slice(0, 4).map((a, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: i < Math.min(schedAlerts.length, 4) - 1 ? '1px solid rgba(212,160,23,0.15)' : 'none', fontSize: 13 }}>
                                        <span>{SP[a.animal.species]} <strong>{a.vaccine}</strong> — {a.animal.breed}</span>
                                        <span style={{ fontSize: 11, color: a.urgency === 'now' ? '#991b1b' : '#92400e', fontWeight: 700 }}>{a.urgency === 'now' ? 'Due Now' : 'Due Soon'}</span>
                                    </div>
                                ))}
                                <button onClick={() => setTab('vaccines')} style={{ marginTop: 10, fontSize: 12, color: 'var(--accent)', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>See all vaccine details →</button>
                            </div>
                        )}
                        {/* Account summary */}
                        <div style={{ background: '#fff', border: '1.5px solid #E5E0D8', borderRadius: 18, padding: '16px 20px' }}>
                            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#6B7280', marginBottom: 10 }}>Your Animals</div>
                            {animals.length === 0 ? (
                                <p style={{ color: '#6B7280', fontSize: 13 }}>No animals registered yet. <Link to="/register" style={{ color: 'var(--accent)', fontWeight: 700 }}>Register one →</Link></p>
                            ) : (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                    {animals.map(a => (
                                        <Link key={a.animal_id} to={`/animal/${a.animal_id}`} style={{ textDecoration: 'none', padding: '6px 12px', background: 'rgba(45,106,79,0.07)', border: '1px solid rgba(45,106,79,0.18)', borderRadius: 10, fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}>
                                            {SP[a.species]} {a.breed}
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── VACCINE ALERTS ──────────────────────── */}
                {!loading && tab === 'vaccines' && (
                    <div>
                        {/* Overdue from recorded vaccinations */}
                        {overdue.length > 0 && (
                            <div style={{ marginBottom: 18 }}>
                                <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#991b1b', marginBottom: 8 }}>🚨 Overdue Vaccines</div>
                                {overdue.map((v, i) => (
                                    <div key={i} style={{ background: 'rgba(220,38,38,0.06)', border: '1.5px solid rgba(220,38,38,0.18)', borderRadius: 14, padding: '12px 16px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                                        <div>
                                            <div style={{ fontWeight: 700, color: '#991b1b', fontSize: 13 }}>💉 {v.vaccine}</div>
                                            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{SP[v.species]} {v.breed} · <code>{v.animal_id}</code> · Was due: {v.next_due}</div>
                                        </div>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: '#991b1b', background: 'rgba(220,38,38,0.10)', padding: '3px 10px', borderRadius: 999 }}>Overdue {Math.abs(v.days)}d</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* ── Gemini AI Vaccine Alerts ── */}
                        {geminiAlerts.length > 0 && (
                            <div style={{ marginBottom: 20 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                    <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#6B7280' }}>🤖 AI-Powered Recommendations</span>
                                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: 'rgba(184,134,11,0.12)', color: '#B8860B', fontWeight: 700, border: '1px solid rgba(184,134,11,0.22)' }}>Gemini AI · Next 60 days</span>
                                </div>
                                {geminiAlerts.map((a, i) => {
                                    const animal = animals[a.animalIndex - 1]
                                    return (
                                        <div key={i} style={{ background: a.urgency === 'now' ? 'rgba(220,38,38,0.04)' : 'rgba(184,134,11,0.04)', border: `1.5px solid ${a.urgency === 'now' ? 'rgba(220,38,38,0.18)' : 'rgba(184,134,11,0.22)'}`, borderRadius: 14, padding: '13px 17px', marginBottom: 8 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                                                <div>
                                                    <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        💉 {a.vaccine}
                                                        {a.isGovtFree && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 999, background: 'rgba(45,106,79,0.10)', color: '#1B4332', fontWeight: 700 }}>🏛 Free at Govt Camp</span>}
                                                    </div>
                                                    {animal && <div style={{ fontSize: 12, color: '#6B7280', marginTop: 3 }}>{SP[animal.species]} <strong>{animal.breed}</strong> · <code style={{ fontSize: 11 }}>{animal.animal_id}</code></div>}
                                                    {a.notes && <div style={{ fontSize: 12, color: '#374151', marginTop: 4 }}>📝 {a.notes}</div>}
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
                                                    <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, fontWeight: 700, background: a.urgency === 'now' ? 'rgba(220,38,38,0.10)' : 'rgba(212,160,23,0.12)', color: a.urgency === 'now' ? '#991b1b' : '#92400e' }}>
                                                        {a.urgency === 'now' ? '🚨 Due Now' : '⏰ Due Soon'}
                                                    </span>
                                                    <Link to="/nearby" style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' }}>Find Vet →</Link>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        {/* Seasonal schedule recommendations */}
                        <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#6B7280', marginBottom: 8 }}>
                            📅 Seasonal Schedule (next 60 days)
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, marginTop: -4 }}>
                            Based on your animals' species and the current month — consult your nearest vet
                        </p>
                        {schedAlerts.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '30px', color: '#6B7280', background: '#fff', borderRadius: 16, border: '1.5px solid #E5E0D8' }}>
                                ✅ No seasonal vaccinations due in the next 60 days for your animals.
                            </div>
                        ) : schedAlerts.map((a, i) => (
                            <div key={i} style={{ background: '#fff', border: '1.5px solid #E5E0D8', borderRadius: 14, padding: '14px 18px', marginBottom: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--primary)' }}>💉 {a.vaccine}</div>
                                        <div style={{ fontSize: 12, color: '#6B7280', marginTop: 3 }}>{SP[a.animal.species]} <strong>{a.animal.breed}</strong> · <code style={{ fontSize: 11 }}>{a.animal.animal_id}</code></div>
                                        <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>📝 {a.notes}</div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
                                        <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, fontWeight: 700, background: a.urgency === 'now' ? 'rgba(220,38,38,0.10)' : 'rgba(212,160,23,0.12)', color: a.urgency === 'now' ? '#991b1b' : '#92400e' }}>
                                            {a.urgency === 'now' ? '🚨 Due Now' : '⏰ Due Soon'}
                                        </span>
                                        <Link to="/nearby" style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' }}>Find Vet →</Link>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── NOTIFICATIONS ─────────────────────── */}
                {!loading && tab === 'notifications' && (
                    <div>
                        {notifs.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: 18, border: '1.5px solid #E5E0D8' }}>
                                <div style={{ fontSize: 46, marginBottom: 10 }}>🔔</div>
                                <p style={{ color: '#6B7280', fontWeight: 700 }}>No alerts right now</p>
                                <p style={{ color: '#6B7280', fontSize: 13 }}>We'll notify you when vaccinations are due</p>
                            </div>
                        ) : notifs.map((n, i) => {
                            const nc = NC[n.t] || NC.info
                            return (
                                <div key={i} style={{ background: nc.bg, border: `1.5px solid ${nc.b}`, borderRadius: 14, padding: '12px 16px', marginBottom: 8, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                    <span style={{ fontSize: 18, flexShrink: 0 }}>{n.icon}</span>
                                    <span style={{ fontSize: 13, color: nc.c, fontWeight: 600 }}>{n.txt}</span>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* ── TRANSFERS ─────────────────────────── */}
                {!loading && tab === 'transfers' && (
                    <div>
                        {allTransfers.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: 18, border: '1.5px solid #E5E0D8' }}>
                                <div style={{ fontSize: 46, marginBottom: 10 }}>🔄</div>
                                <p style={{ color: '#6B7280', fontWeight: 700 }}>No transfer history yet</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {allTransfers.map((t, i) => (
                                    <div key={i} style={{ background: '#fff', border: '1.5px solid #E5E0D8', borderRadius: 16, padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: 22, flexShrink: 0 }}>{SP[t.species] || '🐾'}</span>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--primary)' }}>{t.breed} <code style={{ fontSize: 11, fontWeight: 400, color: '#6B7280' }}>· {t.animal_id}</code></div>
                                            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 3 }}>
                                                <strong>{t.from_owner}</strong> → (current owner)
                                                {t.date && <span> · {t.date.slice(0, 10)}</span>}
                                                {t.reason && <span> · {t.reason}</span>}
                                            </div>
                                        </div>
                                        <Link to={`/animal/${t.animal_id}`} style={{ padding: '6px 12px', background: '#1B4332', color: '#fff', borderRadius: 10, fontSize: 11, fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}>View →</Link>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
    )
}

