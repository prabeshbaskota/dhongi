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
import { aiAvailable } from '../lib/ai.js'
import { useBots } from '../lib/useBots.js'
import { rpc } from '../lib/supabase.js'
import Figure from './Figure.jsx'

export default function Room({ session, onLeave }) {
  const { room, players: allPlayers, clues, card, error, reload } = useRoom(session)
  const me = allPlayers.find(p => p.id === session.player_id)
  // people still knocking, or turned away, are not part of the room yet
  const players = useMemo(() => allPlayers.filter(p => !p.kicked && !p.pending), [allPlayers])
  const knocking = useMemo(() => allPlayers.filter(p => p.pending && !p.kicked), [allPlayers])
  const admitted = !!me && !me.pending && !me.kicked
  const live = useLive(session, admitted ? me : null)
  const [muted, setMutedState] = useState(isMuted())
  const [copied, setCopied] = useState(false)
  const isHost = !!room && !!me && room.host_id === me.id
  const prevStatus = useRef(null)

  const byId = useMemo(() => Object.fromEntries(allPlayers.map(p => [p.id, p])), [allPlayers])

  // the moment the host lets you in, fetch your real card
  const wasPending = useRef(me?.pending)
  useEffect(() => {
    if (wasPending.current && me && !me.pending) { reload(); play('ding') }
    wasPending.current = me?.pending
  }, [me?.pending]) // eslint-disable-line

  // host hears a knock
  const knockCount = useRef(0)
  useEffect(() => {
    if (isHost && knocking.length > knockCount.current) play('boing')
    knockCount.current = knocking.length
  }, [knocking.length, isHost])
  const [aiReady, setAiReady] = useState(false)
  useEffect(() => { aiAvailable().then(setAiReady) }, [])
  useBots({ room, byId, isHost, session, aiReady })

  // chat log for the current game, shown on the results screen
  const gameStart = useRef({ game: null, ts: 0 })
  if (room && gameStart.current.game !== room.game_no) {
    gameStart.current = { game: room.game_no, ts: room.status === 'clues' ? Date.now() - 5000 : 0 }
  }
  const gameMessages = useMemo(
    () => live.messages.filter(m => m.ts >= gameStart.current.ts),
    [live.messages, room?.game_no], // eslint-disable-line
  )

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
        <p>{me.declined ? 'The host didn’t let you in this time.' : 'The host removed you from this room.'}</p>
        <button className="btn btn-main" onClick={onLeave}>Back to start</button>
      </main>
    )
  }
  if (me.pending) {
    return (
      <main className="center-screen knock">
        <div className="knock-fig"><Figure id={me.id} size={110} mood="think" title={me.name} /></div>
        <h2>Knock knock…</h2>
        <p>Waiting for the host of room <strong>{room.code}</strong> to let you in.</p>
        <p className="note">Keep this page open. It moves on by itself.</p>
        <button className="btn btn-quiet small" onClick={onLeave}>Cancel</button>
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

  const respond = (p, allow) => rpc('respond_join', { p_player: session.player_id, p_token: session.token, p_target: p.id, p_allow: allow })
    .catch(e => alert(e.message))
  const toggleLock = () => rpc('set_lock', { p_player: session.player_id, p_token: session.token, p_locked: !room.locked })
    .catch(e => alert(e.message))

  const common = {
    room, players, byId, me, isHost, session, card, clues, online: live.online, aiReady,
    bubbles: live.bubbles, reacts: live.reacts, gameMessages, onInvite: share,
  }

  return (
    <div className="room">
      <header className="topbar">
        <button className="code-chip" onClick={share} aria-label={`Room code ${room.code}. Tap to share`}>
          <span className="code-label">{copied ? 'Link copied' : 'Room'}</span> <strong>{room.code}</strong>
        </button>
        <div className="topbar-right">
          {isHost && (
            <button className={`icon-btn ${room.locked ? 'locked' : ''}`} onClick={toggleLock}
              aria-label={room.locked ? 'Room is locked. Tap to unlock' : 'Lock the room so nobody new can join'}
              title={room.locked ? 'Locked: nobody new can join' : 'Open: people can knock to join'}>
              {room.locked ? '🔒' : '🔓'}
            </button>
          )}
          <button className="icon-btn" onClick={toggleMute} aria-label={muted ? 'Turn sound on' : 'Mute sounds'}>
            {muted ? '🔇' : '🔊'}
          </button>
          <button className="icon-btn" onClick={() => { if (confirm('Leave this room?')) onLeave() }} aria-label="Leave room">✕</button>
        </div>
      </header>

      {isHost && knocking.length > 0 && (
        <section className="knocks" aria-live="polite" aria-label="People asking to join">
          {knocking.map(p => (
            <div key={p.id} className="knock-row">
              <Figure id={p.id} size={34} title={p.name} />
              <span className="knock-name"><strong>{p.name}</strong> wants to {p.is_spectator ? 'watch' : 'join'}</span>
              <button className="btn btn-quiet small" onClick={() => respond(p, false)}>Decline</button>
              <button className="btn btn-main small" onClick={() => respond(p, true)}>Let in</button>
            </div>
          ))}
        </section>
      )}
      {room.locked && isHost && <p className="lock-note">🔒 Room locked. Nobody new can knock.</p>}

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
        <Chat onSend={live.sendChat} me={me} />
      </footer>
    </div>
  )
}
