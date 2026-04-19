import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LanguageContext'
import { createChatRoom, getChatRooms, sendChatMessage, getChatMessages, getChatUsers, geminiChat, createPost, getPosts } from '../services/api'

const POLL_MS = 3000
const POST_POLL_MS = 8000

/* ── Message bubble ── */
function MsgBubble({ m, isMine, isNew }) {
    return (
        <div style={{
            alignSelf: isMine ? 'flex-end' : 'flex-start',
            maxWidth: '75%',
            animation: isNew ? 'msgSlideIn 0.28s ease both' : 'none',
        }}>
            {!isMine && <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--primary)', marginBottom: 2 }}>{m.senderName}</div>}
            <div style={{
                background: isMine ? 'var(--primary)' : 'rgba(45,106,79,0.08)',
                color: isMine ? '#FAF7F0' : 'var(--dark)',
                padding: '10px 14px', borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                fontSize: 13, lineHeight: 1.5,
                boxShadow: isMine ? '0 2px 8px rgba(27,67,50,0.22)' : '0 1px 4px rgba(0,0,0,0.06)',
            }}>
                {m.type === 'image' && m.image && (
                    <img src={m.image} alt="shared" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 10, marginBottom: m.text ? 6 : 0, display: 'block' }} />
                )}
                {m.text && m.text !== '📷 Image' && <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.text}</div>}
            </div>
            <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2, textAlign: isMine ? 'right' : 'left' }}>
                {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
        </div>
    )
}

/* ── Community Post Card ── */
function PostCard({ p, isNew }) {
    const timeAgo = (d) => {
        const diff = Date.now() - new Date(d).getTime()
        const m = Math.floor(diff / 60000)
        if (m < 1) return 'just now'
        if (m < 60) return `${m}m ago`
        const h = Math.floor(m / 60)
        if (h < 24) return `${h}h ago`
        return `${Math.floor(h / 24)}d ago`
    }
    return (
        <div style={{
            background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 18,
            padding: '16px 18px', animation: isNew ? 'msgSlideIn 0.3s ease both' : 'none',
        }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#1B4332,#2D6A4F)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>👤</div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--primary)' }}>{p.authorName}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{timeAgo(p.createdAt)}</div>
                </div>
            </div>
            <p style={{ fontSize: 14, color: 'var(--dark)', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{p.text}</p>
        </div>
    )
}

export default function ChatPage() {
    const { user, isAuth } = useAuth()
    const { t, isHindi } = useLang()
    const [rooms, setRooms] = useState([])
    const [activeRoom, setActiveRoom] = useState(null)
    const [messages, setMessages] = useState([])
    const [newMsgIds, setNewMsgIds] = useState(new Set())
    const [text, setText] = useState('')
    const [users, setUsers] = useState([])
    const [userSearch, setUserSearch] = useState('')
    const [showUsers, setShowUsers] = useState(false)
    const [usersLoading, setUsersLoading] = useState(false)
    const [loading, setLoading] = useState(false)
    const [sending, setSending] = useState(false)
    const [aiMode, setAiMode] = useState(false)
    const [aiMessages, setAiMessages] = useState([])
    const [aiLoading, setAiLoading] = useState(false)
    const [communityMode, setCommunityMode] = useState(false)
    const [posts, setPosts] = useState([])
    const [newPostIds, setNewPostIds] = useState(new Set())
    const [postText, setPostText] = useState('')
    const [postSending, setPostSending] = useState(false)
    const [postsLoading, setPostsLoading] = useState(false)
    const msgEndRef = useRef(null)
    const fileRef = useRef(null)

    const scrollDown = useCallback(() => msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }), [])

    /* ── Load rooms ── */
    const loadRooms = useCallback(async () => {
        if (!isAuth) return
        try { const d = await getChatRooms(); setRooms(d.rooms || []) } catch { }
    }, [isAuth])
    useEffect(() => { loadRooms() }, [loadRooms])

    /* ── Load messages ── */
    const loadMessages = useCallback(async () => {
        if (!activeRoom) return
        try { const d = await getChatMessages(activeRoom); setMessages(d.messages || []) } catch { }
    }, [activeRoom])
    useEffect(() => { loadMessages() }, [loadMessages])

    /* ── Poll messages ── */
    useEffect(() => {
        if (!activeRoom || aiMode || communityMode) return
        const iv = setInterval(async () => {
            try {
                const last = messages[messages.length - 1]
                const d = await getChatMessages(activeRoom, last?.createdAt)
                if (d.messages?.length > 0) {
                    setMessages(prev => {
                        const ids = new Set(prev.map(m => m._id))
                        const newMsgs = d.messages.filter(m => !ids.has(m._id))
                        if (newMsgs.length > 0) {
                            setNewMsgIds(old => { const n = new Set(old); newMsgs.forEach(m => n.add(m._id)); return n })
                            setTimeout(() => setNewMsgIds(new Set()), 500)
                        }
                        return newMsgs.length > 0 ? [...prev, ...newMsgs] : prev
                    })
                }
            } catch { }
        }, POLL_MS)
        return () => clearInterval(iv)
    }, [activeRoom, messages, aiMode, communityMode])

    /* ── Load & poll posts ── */
    const loadPosts = useCallback(async () => {
        if (!isAuth) return
        setPostsLoading(true)
        try { const d = await getPosts(); setPosts(d.posts || []) } catch { } finally { setPostsLoading(false) }
    }, [isAuth])

    useEffect(() => { if (communityMode) loadPosts() }, [communityMode, loadPosts])

    useEffect(() => {
        if (!communityMode || !isAuth) return
        const iv = setInterval(async () => {
            try {
                const last = posts[0]
                const d = await getPosts(last ? undefined : undefined)
                if (d.posts?.length > 0) {
                    setPosts(prev => {
                        const ids = new Set(prev.map(p => p._id))
                        const newP = d.posts.filter(p => !ids.has(p._id))
                        if (newP.length > 0) {
                            setNewPostIds(old => { const n = new Set(old); newP.forEach(p => n.add(p._id)); return n })
                            setTimeout(() => setNewPostIds(new Set()), 500)
                        }
                        return newP.length > 0 ? [...newP, ...prev] : prev
                    })
                }
            } catch { }
        }, POST_POLL_MS)
        return () => clearInterval(iv)
    }, [communityMode, posts, isAuth])

    useEffect(() => { scrollDown() }, [messages, aiMessages, scrollDown])

    /* ── Community post submit ── */
    const handlePostSubmit = async (e) => {
        e.preventDefault()
        if (!postText.trim() || postSending) return
        setPostSending(true)
        try {
            const d = await createPost({ text: postText.trim() })
            if (d.post) setPosts(prev => [d.post, ...prev])
            setPostText('')
        } catch { }
        setPostSending(false)
    }

    /* ── Join global room ── */
    const joinGlobal = async () => {
        setLoading(true)
        try {
            const d = await createChatRoom({ isGlobal: true })
            setActiveRoom(d.room?.roomId || 'global-community')
            setAiMode(false); setCommunityMode(false)
            loadRooms()
        } catch { }
        setLoading(false)
    }

    /* ── Start DM ── */
    const startDM = async (targetId) => {
        setLoading(true)
        try {
            const d = await createChatRoom({ targetUserId: targetId })
            setActiveRoom(d.room?.roomId)
            setAiMode(false); setCommunityMode(false)
            setShowUsers(false)
            loadRooms()
        } catch { }
        setLoading(false)
    }

    /* ── Send message ── */
    const handleSend = async (e) => {
        e.preventDefault()
        if (!text.trim() || sending) return
        if (aiMode) {
            const q = text.trim()
            setText('')
            setAiMessages(prev => [...prev, { role: 'user', text: q }])
            setAiLoading(true)
            try {
                // Pass last 6 turns as history for multi-turn context
                const history = aiMessages.slice(-6)
                const d = await geminiChat({ message: q, history })
                setAiMessages(prev => [...prev, { role: 'ai', text: d.response || 'No response.' }])
            } catch {
                setAiMessages(prev => [...prev, { role: 'ai', text: '❌ Could not reach AI. Check internet connection and try again.' }])
            }
            setAiLoading(false)
            return
        }

        setSending(true)
        try {
            await sendChatMessage({ room: activeRoom, text: text.trim() })
            setText(''); loadMessages()
        } catch { }
        setSending(false)
    }

    /* ── Send image ── */
    const handleImage = (e) => {
        const file = e.target.files?.[0]
        if (!file || !activeRoom) return
        const reader = new FileReader()
        reader.onload = async () => {
            setSending(true)
            try { await sendChatMessage({ room: activeRoom, image: reader.result, text: '📷 Image' }); loadMessages() } catch { }
            setSending(false)
        }
        reader.readAsDataURL(file)
    }

    /* ── Show users panel with search ── */
    const handleShowUsers = async (searchVal = '') => {
        setUsersLoading(true)
        try {
            const d = await getChatUsers(searchVal)
            setUsers(d.users || [])
            setShowUsers(true)
        } catch { }
        setUsersLoading(false)
    }

    const handleUserSearch = async (val) => {
        setUserSearch(val)
        clearTimeout(window._userSearchTimer)
        window._userSearchTimer = setTimeout(() => handleShowUsers(val), 300)
    }

    if (!isAuth) {
        return (
            <div className="page-wrap">
                <div className="container" style={{ maxWidth: 600, textAlign: 'center', paddingTop: 'calc(var(--nav-h) + 40px)' }}>
                    <div style={{ fontSize: 64, marginBottom: 16 }}>💬</div>
                    <h1 className="page-title">{isHindi ? 'चैट सेवा' : 'Chat Service'}</h1>
                    <p style={{ color: 'var(--muted)', marginBottom: 20 }}>{isHindi ? 'चैट का उपयोग करने के लिए कृपया लॉग इन करें' : 'Please log in to use the chat service'}</p>
                    <a href="/login" className="btn btn-gold">{t('Sign In')}</a>
                </div>
            </div>
        )
    }

    const currentRoomData = rooms.find(r => r.roomId === activeRoom)
    const roomDisplayName = (r) => {
        if (r.isGlobal) return isHindi ? '🌐 सामुदायिक चैट' : '🌐 Community Chat'
        const otherName = r.participantNames?.find(n => n !== user?.name)
        return otherName ? `💬 ${otherName}` : '💬 Chat'
    }

    return (
        <div className="page-wrap">
            <div className="container" style={{ maxWidth: 1100, paddingTop: 'calc(var(--nav-h) + 16px)' }}>
                <h1 className="page-title" style={{ marginBottom: 16 }}>💬 {isHindi ? 'चैट और समुदाय' : 'Chat & Community'}</h1>

                <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, minHeight: 560, background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 22, overflow: 'hidden' }}>
                    {/* Sidebar */}
                    <div style={{ borderRight: '1.5px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--primary)', marginBottom: 10 }}>{isHindi ? 'वार्तालाप' : 'Conversations'}</div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                <button onClick={joinGlobal} disabled={loading} className="btn btn-green btn-sm" style={{ fontSize: 11, padding: '5px 10px' }}>
                                    🌐 {isHindi ? 'समूह' : 'Group'}
                                </button>
                                <button onClick={() => { setCommunityMode(true); setActiveRoom(null); setAiMode(false) }} className="btn btn-sm" style={{ fontSize: 11, padding: '5px 10px', background: communityMode ? '#D4A017' : 'none', color: communityMode ? '#1f2a1f' : 'var(--muted)', border: '1.5px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit', borderRadius: 10, fontWeight: 700 }}>
                                    📢 {isHindi ? 'पोस्ट' : 'Posts'}
                                </button>
                                <button onClick={() => { handleShowUsers(userSearch) }} className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '5px 10px' }}>
                                    👥 {isHindi ? 'नया' : 'New'}
                                </button>
                                <button onClick={() => { setAiMode(true); setActiveRoom(null); setCommunityMode(false) }} className="btn btn-gold btn-sm" style={{ fontSize: 11, padding: '5px 10px' }}>
                                    🤖 AI
                                </button>
                            </div>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                            {rooms.map(r => (
                                <button key={r.roomId} onClick={() => { setActiveRoom(r.roomId); setAiMode(false); setCommunityMode(false) }}
                                    style={{
                                        width: '100%', padding: '10px 12px', border: 'none', borderRadius: 12,
                                        background: activeRoom === r.roomId && !communityMode && !aiMode ? 'rgba(45,106,79,0.12)' : 'none',
                                        cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', marginBottom: 4,
                                        transition: 'background 0.15s',
                                    }}
                                    onMouseEnter={e => { if (activeRoom !== r.roomId) e.currentTarget.style.background = 'rgba(45,106,79,0.06)' }}
                                    onMouseLeave={e => { if (activeRoom !== r.roomId) e.currentTarget.style.background = 'none' }}>
                                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--dark)' }}>{roomDisplayName(r)}</div>
                                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.lastMessage}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Main area */}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {/* Header */}
                        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14, color: 'var(--primary)' }}>
                            {communityMode ? `📢 ${isHindi ? 'सामुदायिक पोस्ट' : 'Community Posts'}` :
                                aiMode ? `🤖 ${isHindi ? 'AI पशु सहायक (Gemini)' : 'AI Animal Assistant (Gemini)'}` :
                                    activeRoom ? (currentRoomData ? roomDisplayName(currentRoomData) : activeRoom) :
                                        (isHindi ? 'एक वार्तालाप चुनें' : 'Select a conversation')}
                        </div>

                        {/* Community Posts Mode */}
                        {communityMode ? (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                {/* New post form */}
                                <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: 'rgba(45,106,79,0.03)' }}>
                                    <form onSubmit={handlePostSubmit} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                                        <textarea
                                            className="form-input"
                                            rows={2}
                                            style={{ flex: 1, fontSize: 13, resize: 'none' }}
                                            placeholder={isHindi ? 'अपनी पोस्ट लिखें — खेत की खबर, पशु स्वास्थ्य, मदद की जरूरत...' : 'Share an update — farm news, animal health, need help...'}
                                            value={postText}
                                            onChange={e => setPostText(e.target.value)}
                                        />
                                        <button type="submit" disabled={!postText.trim() || postSending} className="btn btn-gold btn-sm" style={{ padding: '8px 16px', flexShrink: 0 }}>
                                            {postSending ? '⏳' : '📢 ' + (isHindi ? 'पोस्ट करें' : 'Post')}
                                        </button>
                                    </form>
                                </div>
                                {/* Posts feed */}
                                <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {postsLoading && (
                                        <div style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>
                                            <div style={{ width: 28, height: 28, border: '3px solid rgba(45,106,79,0.18)', borderTopColor: '#1B4332', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 8px' }} />
                                            {isHindi ? 'लोड हो रहा है...' : 'Loading posts...'}
                                        </div>
                                    )}
                                    {!postsLoading && posts.length === 0 && (
                                        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
                                            <div style={{ fontSize: 36, marginBottom: 10 }}>📢</div>
                                            <p style={{ fontWeight: 700 }}>{isHindi ? 'अभी कोई पोस्ट नहीं' : 'No posts yet'}</p>
                                            <p style={{ fontSize: 13 }}>{isHindi ? 'पहली पोस्ट करें!' : 'Be the first to post!'}</p>
                                        </div>
                                    )}
                                    {posts.map(p => <PostCard key={p._id} p={p} isNew={newPostIds.has(p._id)} />)}
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Messages area */}
                                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {aiMode ? (
                                        <>
                                            <div style={{ background: 'rgba(45,106,79,0.08)', padding: '12px 16px', borderRadius: 16, fontSize: 13, color: 'var(--primary)', fontWeight: 600, maxWidth: '85%', animation: 'msgSlideIn 0.3s ease both', lineHeight: 1.6 }}>
                                                🤖 {isHindi
                                                    ? 'नमस्ते! मैं SAIOMS AI सहायक हूँ। मैं इन विषयों में मदद कर सकता हूँ:'
                                                    : "Hello! I'm SAIOMS AI Assistant. I can help you with:"}
                                                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12 }}>
                                                    {['🐄 Animal breeds & identification', '💉 Vaccination schedules & reminders', '🏥 Finding nearby vets & gaushalas', '📱 How to use SAIOMS features', '🌿 Healthcare & disease symptoms', '📋 Government schemes for farmers'].map((item, i) => (
                                                        <div key={i} style={{ opacity: 0.9 }}>{item}</div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Quick suggestion chips — shown only when no messages yet */}
                                            {aiMessages.length === 0 && (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, maxWidth: '85%' }}>
                                                    {[
                                                        isHindi ? 'गिर गाय की पहचान कैसे करें?' : 'How to identify a Gir cow?',
                                                        isHindi ? 'FMD टीकाकरण कब करें?' : 'When to give FMD vaccine?',
                                                        isHindi ? 'नज़दीकी गौशाला कैसे खोजें?' : 'How to find nearby gaushala?',
                                                        isHindi ? 'QR कोड कैसे स्कैन करें?' : 'How to scan a QR code?',
                                                        isHindi ? 'पशु कैसे रजिस्टर करें?' : 'How to register an animal?',
                                                    ].map((q, i) => (
                                                        <button key={i}
                                                            onClick={() => { setText(q); setTimeout(() => document.querySelector('form[data-ai-form]')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })), 50) }}
                                                            style={{ padding: '6px 12px', borderRadius: 999, border: '1.5px solid rgba(45,106,79,0.25)', background: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', color: '#1B4332', transition: 'background 0.15s' }}
                                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(45,106,79,0.08)'}
                                                            onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                                                        >
                                                            {q}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            {aiMessages.map((m, i) => (
                                                <div key={i} style={{
                                                    alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                                                    background: m.role === 'user' ? 'var(--primary)' : 'rgba(45,106,79,0.08)',
                                                    color: m.role === 'user' ? '#FAF7F0' : 'var(--dark)',
                                                    padding: '10px 14px',
                                                    borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                                                    maxWidth: '80%', fontSize: 13, lineHeight: 1.6,
                                                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                                                    animation: 'msgSlideIn 0.28s ease both',
                                                }}>
                                                    {m.role === 'ai' && <span style={{ fontWeight: 700 }}>🤖 </span>}
                                                    {m.text}
                                                </div>
                                            ))}
                                            {aiLoading && (
                                                <div style={{ alignSelf: 'flex-start', background: 'rgba(45,106,79,0.08)', padding: '10px 16px', borderRadius: '18px 18px 18px 4px', animation: 'msgSlideIn 0.2s ease both' }}>
                                                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--primary)', animation: 'dotPulse 1.2s ease infinite 0s' }} />
                                                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--primary)', animation: 'dotPulse 1.2s ease infinite 0.2s' }} />
                                                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--primary)', animation: 'dotPulse 1.2s ease infinite 0.4s' }} />
                                                    </div>
                                                </div>
                                            )}
                                        </>

                                    ) : activeRoom ? (
                                        messages.length > 0 ? messages.map((m, i) => {
                                            const isMine = m.sender === user?._id || m.senderName === user?.name
                                            return <MsgBubble key={m._id || i} m={m} isMine={isMine} isNew={newMsgIds.has(m._id)} />
                                        }) : (
                                            <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px 0', fontSize: 13 }}>
                                                {isHindi ? 'अभी कोई संदेश नहीं। बातचीत शुरू करें!' : 'No messages yet. Start the conversation!'}
                                            </div>
                                        )
                                    ) : (
                                        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '60px 0' }}>
                                            <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
                                            <p>{isHindi ? 'बाईं ओर से एक वार्तालाप चुनें या नया शुरू करें' : 'Select a conversation from the left, or start a new one'}</p>
                                        </div>
                                    )}
                                    <div ref={msgEndRef} />
                                </div>

                                {/* Input */}
                                {(activeRoom || aiMode) && (
                                    <form data-ai-form onSubmit={handleSend} style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center' }}>

                                        {!aiMode && (
                                            <>
                                                <input type="file" ref={fileRef} accept="image/*" style={{ display: 'none' }} onChange={handleImage} />
                                                <button type="button" onClick={() => fileRef.current?.click()} style={{
                                                    background: 'none', border: '1.5px solid var(--border)', borderRadius: 10,
                                                    padding: '8px 10px', cursor: 'pointer', fontSize: 16, color: 'var(--primary)',
                                                }}>📷</button>
                                            </>
                                        )}
                                        <input
                                            className="form-input"
                                            style={{ flex: 1, fontSize: 13 }}
                                            placeholder={aiMode ? (isHindi ? 'AI से कुछ भी पूछें...' : 'Ask AI anything about animals...') : (isHindi ? 'संदेश लिखें...' : 'Type a message...')}
                                            value={text}
                                            onChange={e => setText(e.target.value)}
                                            autoFocus
                                        />
                                        <button type="submit" disabled={!text.trim() || sending || aiLoading} className="btn btn-gold btn-sm" style={{ padding: '8px 16px' }}>
                                            {sending || aiLoading ? '⏳' : '📤'}
                                        </button>
                                    </form>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* User search modal */}
                {showUsers && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowUsers(false)}>
                        <div style={{ background: 'var(--surface)', borderRadius: 22, padding: '24px', maxWidth: 420, width: '90%', maxHeight: '65vh', display: 'flex', flexDirection: 'column', border: '1.5px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }} onClick={e => e.stopPropagation()}>
                            <h3 style={{ color: 'var(--primary)', marginBottom: 14 }}>👥 {isHindi ? 'उपयोगकर्ता खोजें' : 'Find User'}</h3>
                            <input
                                className="form-input"
                                style={{ marginBottom: 12, fontSize: 13 }}
                                placeholder={isHindi ? 'नाम या ईमेल से खोजें...' : 'Search by name or email...'}
                                value={userSearch}
                                onChange={e => handleUserSearch(e.target.value)}
                                autoFocus
                            />
                            <div style={{ overflowY: 'auto', flex: 1 }}>
                                {usersLoading && <div style={{ padding: 16, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>🔍 {isHindi ? 'खोज रहे हैं...' : 'Searching...'}</div>}
                                {!usersLoading && users.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13, padding: '8px 0' }}>{isHindi ? 'कोई उपयोगकर्ता नहीं मिला' : 'No users found'}</p>}
                                {users.map(u => (
                                    <button key={u.id} onClick={() => startDM(u.id)} style={{
                                        width: '100%', padding: '12px 14px', border: '1px solid var(--border)',
                                        borderRadius: 14, background: 'none', cursor: 'pointer', textAlign: 'left',
                                        fontFamily: 'inherit', marginBottom: 8, transition: 'background 0.15s',
                                    }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(45,106,79,0.06)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--dark)' }}>👤 {u.name}</div>
                                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{u.email}</div>
                                    </button>
                                ))}
                            </div>
                            <button onClick={() => { setShowUsers(false); setUserSearch('') }} className="btn btn-ghost btn-sm" style={{ marginTop: 10 }}>{t('Close')}</button>
                        </div>
                    </div>
                )}
            </div>
            <style>{`
                @keyframes msgSlideIn {
                    from { opacity: 0; transform: translateY(8px) scale(0.97); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes dotPulse {
                    0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
                    40% { transform: scale(1); opacity: 1; }
                }
                @keyframes spin { to { transform: rotate(360deg) } }
            `}</style>
        </div>
    )
}
