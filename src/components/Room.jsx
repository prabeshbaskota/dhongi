import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useRoom } from '../lib/useRoom.js'
import { useLive } from '../lib/useLive.js'
import { isMuted, setMuted, play } from '../lib/sound.js'
import Lobby from './Lobby.jsx'
import Clues from './Clues.jsx'
import Vote from './Vote.jsx'
import Result from './Result.jsx'
import Chat from './Chat.jsx'
import Reactions from './Reactions.jsx'

export default function Room({ session, onLeave }) {
  const { room, players, clues, card, error } = useRoom(session)
  const me = players.find(p => p.id === session.player_id)
  const live = useLive(session, me)
  const [muted, setMutedState] = useState(isMuted())
  const [copied, setCopied] = useState(false)
  const isHost = !!room && !!me && room.host_id === me.id
  const prevStatus = useRef(null)

  const byId = useMemo(() => Object.fromEntries(players.map(p => [p.id, p])), [players])

  // little sound cues when the phase changes
  useEffect(() => {
    if (!room) return
    const s = room.status
    if (prevStatus.current && prevStatus.current !== s) {
      if (s === 'clues') play('ding')
      if (s === 'voting') play('drumroll')
    }
    prevStatus.current = s
  }, [room?.status])

  if (error) {
    return (
      <main className="center-screen">
        <p className="err">{error}</p>
        <button className="btn btn-main" onClick={onLeave}>Back to start</button>
      </main>
    )
  }
  if (!room || !me) {
    return <main className="center-screen"><div className="loader" aria-label="Loading" /></main>
  }
  if (me.kicked) {
    return (
      <main className="center-screen">
        <p className="big-emoji">🚪</p>
        <p>The host removed you from this room.</p>
        <button className="btn btn-main" onClick={onLeave}>Back to start</button>
      </main>
    )
  }

  const toggleMute = () => { const m = !muted; setMuted(m); setMutedState(m); if (!m) play('pop') }
  const share = async () => {
    const url = `${location.origin}${location.pathname}?room=${room.code}`
    try {
      if (navigator.share) await navigator.share({ title: 'Play Dhongi with me', text: `Join my Dhongi room: ${room.code}`, url })
      else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800) }
    } catch { /* user cancelled */ }
  }

  const common = { room, players, byId, me, isHost, session, card, clues, online: live.online }

  return (
    <div className="room">
      <header className="topbar">
        <button className="code-chip" onClick={share} aria-label={`Room code ${room.code}. Tap to share`}>
          <span className="code-label">{copied ? 'Link copied' : 'Room'}</span> <strong>{room.code}</strong>
        </button>
        <div className="topbar-right">
          <button className="icon-btn" onClick={toggleMute} aria-label={muted ? 'Turn sound on' : 'Mute sounds'}>
            {muted ? '🔇' : '🔊'}
          </button>
          <button className="icon-btn" onClick={() => { if (confirm('Leave this room?')) onLeave() }} aria-label="Leave room">✕</button>
        </div>
      </header>

      <main className="stage">
        {room.status === 'lobby' && <Lobby {...common} />}
        {room.status === 'clues' && <Clues {...common} />}
        {room.status === 'voting' && <Vote {...common} />}
        {room.status === 'result' && <Result {...common} />}
      </main>

      <div className="floaters" aria-hidden="true">
        {live.floaters.map(f => (
          <div key={f.id} className="floater" style={{ left: `${f.left}%` }}>
            <span className="floater-emoji">{f.emoji}</span>
            <span className="floater-name">{f.name}</span>
          </div>
        ))}
      </div>

      <footer className="dock">
        <Reactions onReact={live.sendReaction} />
        <Chat messages={live.messages} onSend={live.sendChat} me={me} />
      </footer>
    </div>
  )
}
