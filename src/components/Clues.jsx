import React, { useEffect, useRef, useState } from 'react'
import { rpc } from '../lib/supabase.js'
import { play } from '../lib/sound.js'
import Card from './Card.jsx'
import { Avatar } from './PlayerList.jsx'

export default function Clues({ room, byId, me, isHost, session, card, clues }) {
  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const auth = { p_player: session.player_id, p_token: session.token }
  const current = room.turn_order[room.turn_idx]
  const myTurn = current === me.id
  const inputRef = useRef(null)

  useEffect(() => {
    if (myTurn) { play('ding'); setTimeout(() => inputRef.current?.focus(), 50) }
  }, [myTurn, room.round])

  const send = async (e) => {
    e.preventDefault()
    if (!text.trim()) return
    setErr(''); setBusy(true)
    try { await rpc('submit_clue', { ...auth, p_clue: text }); setText('') }
    catch (e2) { setErr(e2.message); play('boing') }
    setBusy(false)
  }

  const rounds = Array.from({ length: room.round }, (_, i) => i + 1)

  return (
    <div className="clues">
      <Card card={card} byId={byId} />

      <div className="round-bar" aria-live="polite">
        <span>Round {room.round} of {room.max_rounds}</span>
        <span className="round-dots" aria-hidden="true">
          {Array.from({ length: room.max_rounds }, (_, i) => (
            <i key={i} className={i + 1 < room.round ? 'done' : i + 1 === room.round ? 'now' : ''} />
          ))}
        </span>
      </div>

      <section className="board" aria-label="Clues so far">
        {rounds.map(r => (
          <div key={r} className="board-round">
            <h3>Round {r}</h3>
            <ul>
              {room.turn_order.map(pid => {
                const p = byId[pid]; if (!p) return null
                const c = clues.find(x => x.round === r && x.player_id === pid)
                const isNow = r === room.round && pid === current
                return (
                  <li key={pid} className={`${isNow ? 'now' : ''} ${c ? 'has' : ''}`}>
                    <Avatar p={p} size={28} />
                    <span className="who">{p.name}</span>
                    <span className="said">{c ? c.clue : isNow ? 'thinking…' : ''}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </section>

      <div className="sticky-cta">
        {myTurn ? (
          <form className="clue-form" onSubmit={send}>
            <label htmlFor="clue" className="your-turn">Your turn. One clue, related to the word.</label>
            <div className="clue-row">
              <input id="clue" ref={inputRef} value={text} maxLength={30} autoComplete="off" placeholder="Type your clue"
                onChange={e => setText(e.target.value)} />
              <button className="btn btn-main" disabled={busy || !text.trim()}>Send</button>
            </div>
            {err && <p className="err" role="alert">{err}</p>}
          </form>
        ) : (
          <p className="turn-note" aria-live="polite">
            {byId[current] ? <>{byId[current].is_bot ? '🤖 ' : ''}Waiting for <strong>{byId[current].name}</strong>…</> : 'Next player…'}
          </p>
        )}
        {isHost && (
          <div className="host-row">
            {!myTurn && <button className="btn btn-quiet small" onClick={() => rpc('skip_turn', auth).catch(e => setErr(e.message))}>Skip their turn</button>}
            <button className="btn btn-quiet small" onClick={() => { if (confirm('End the clues and vote now?')) rpc('go_to_vote', auth).catch(e => setErr(e.message)) }}>Vote now</button>
          </div>
        )}
      </div>
    </div>
  )
}
