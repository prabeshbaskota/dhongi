import React, { useEffect, useMemo, useRef, useState } from 'react'
import { rpc } from '../lib/supabase.js'
import { play } from '../lib/sound.js'
import Card from './Card.jsx'
import Table from './Table.jsx'
import Audience from './Audience.jsx'
import { Avatar } from './PlayerList.jsx'

export default function Clues({ room, players, byId, me, isHost, session, card, clues, bubbles, reacts }) {
  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const auth = { p_player: session.player_id, p_token: session.token }
  const current = room.turn_order[room.turn_idx]
  const myTurn = current === me.id
  const inputRef = useRef(null)
  const seats = room.turn_order.map(id => byId[id]).filter(Boolean)
  const watching = players.filter(p => !p.kicked && !room.turn_order.includes(p.id))

  useEffect(() => {
    if (myTurn) { play('ding'); setTimeout(() => inputRef.current?.focus(), 50) }
  }, [myTurn, room.round])

  // each seat shows that player's latest clue
  const tags = useMemo(() => {
    const t = {}
    clues.forEach(c => { t[c.player_id] = c.clue })
    return t
  }, [clues])

  const send = async (e) => {
    e.preventDefault()
    if (!text.trim()) return
    setErr(''); setBusy(true)
    try { await rpc('submit_clue', { ...auth, p_clue: text }); setText('') }
    catch (e2) { setErr(e2.message); play('boing') }
    setBusy(false)
  }

  const rounds = Array.from({ length: room.round }, (_, i) => i + 1)
  const cur = byId[current]

  return (
    <div className="clues">
      <Table seats={seats} meId={me.id} currentId={current} tags={tags} bubbles={bubbles} reacts={reacts}
        center={
          <div className="center-note">
            <span className="small">Round {room.round} of {room.max_rounds}</span>
            <span className="turn">{myTurn ? 'Your turn' : cur ? `${cur.is_bot ? '🤖 ' : ''}${cur.name}’s turn` : '…'}</span>
          </div>
        } />
      <Audience list={watching} bubbles={bubbles} reacts={reacts} />

      <Card card={card} byId={byId} compact />

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
      ) : err ? <p className="err" role="alert">{err}</p> : null}

      {isHost && (
        <div className="host-row">
          {!myTurn && <button className="btn btn-quiet small" onClick={() => rpc('skip_turn', auth).catch(e => setErr(e.message))}>Skip their turn</button>}
          <button className="btn btn-quiet small" onClick={() => { if (confirm('End the clues and vote now?')) rpc('go_to_vote', auth).catch(e => setErr(e.message)) }}>Vote now</button>
        </div>
      )}

      <details className="board-wrap">
        <summary>All clues so far</summary>
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
      </details>
    </div>
  )
}
