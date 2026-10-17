import React from 'react'
import { rpc } from '../lib/supabase.js'

export function initials(name) {
  return name.split(/\s+/).map(s => s[0]).join('').slice(0, 2).toUpperCase()
}

// A stable, friendly colour per player
const HUES = [12, 38, 160, 200, 260, 320, 90, 230, 290, 180]
export function hueFor(id) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return HUES[h % HUES.length]
}

export function Avatar({ p, size = 36, cry }) {
  return (
    <span className="avatar" style={{ '--h': hueFor(p.id), width: size, height: size, fontSize: size * 0.4 }} aria-hidden="true">
      {cry ? '😭' : p.is_bot ? '🤖' : initials(p.name)}
    </span>
  )
}

export default function PlayerList({ list, room, me, isHost, online, session, extra }) {
  const kick = async (p) => {
    if (!confirm(`Remove ${p.name} from the room?`)) return
    try { await rpc('kick_player', { p_player: session.player_id, p_token: session.token, p_target: p.id }) }
    catch (e) { alert(e.message) }
  }
  return (
    <ul className="players">
      {list.map(p => (
        <li key={p.id} className={p.id === me.id ? 'me' : ''}>
          <Avatar p={p} />
          <span className="pname">
            {p.name}
            {p.id === me.id && <em> (you)</em>}
            {p.id === room.host_id && <span className="crown" title="Host" aria-label="host"> 👑</span>}
            {p.is_bot && <span className="bot-tag">AI</span>}
          </span>
          {extra && extra(p)}
          {!p.is_bot && <span className={`dot ${online[p.id] ? 'on' : ''}`} title={online[p.id] ? 'Online' : 'Away'} />}
          {isHost && p.id !== me.id && (
            <button className="kick" onClick={() => kick(p)} aria-label={`Remove ${p.name}`}>✕</button>
          )}
        </li>
      ))}
    </ul>
  )
}
