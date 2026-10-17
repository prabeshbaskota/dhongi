import React, { useEffect, useMemo, useState } from 'react'
import { rpc } from '../lib/supabase.js'
import { play } from '../lib/sound.js'
import { Avatar } from './PlayerList.jsx'

export default function Result({ room, byId, me, isHost, session, card, aiReady }) {
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const auth = { p_player: session.player_id, p_token: session.token }
  const impostors = room.reveal_impostors || []
  const dhongiWon = room.result === 'impostor'
  const iWasPlayer = card?.state === 'player' && card.game_no === room.game_no
  const iAmDhongi = iWasPlayer && card.is_impostor
  const iLost = iWasPlayer && (dhongiWon ? !iAmDhongi : iAmDhongi)
  const names = impostors.map(id => byId[id]?.name || 'Someone').join(' & ')
  const out = room.voted_out ? byId[room.voted_out] : null

  useEffect(() => {
    play('drumroll')
    const t = setTimeout(() => play(iLost ? 'sadTrombone' : 'tada'), 1300)
    return () => clearTimeout(t)
  }, [room.game_no]) // eslint-disable-line

  const tally = useMemo(() => {
    const t = room.vote_tally || {}
    const max = Math.max(1, ...Object.values(t))
    return room.turn_order.map(id => ({ p: byId[id], n: t[id] || 0, max })).filter(x => x.p)
      .sort((a, b) => b.n - a.n)
  }, [room, byId])

  const next = async () => { setErr(''); setBusy(true); try { await rpc('start_game', auth) } catch (e) { setErr(e.message) } setBusy(false) }
  const lobby = () => rpc('back_to_lobby', auth).catch(e => setErr(e.message))

  let headline, sub
  if (!dhongiWon) {
    headline = 'Caught!'
    sub = <><strong>{names}</strong> {impostors.length > 1 ? 'were' : 'was'} the Dhongi. Innocents win.</>
  } else if (!out) {
    headline = 'The Dhongi escaped'
    sub = <>The vote was a tie, so nobody was caught. <strong>{names}</strong> {impostors.length > 1 ? 'were' : 'was'} the Dhongi.</>
  } else {
    headline = 'The Dhongi escaped'
    sub = <>You voted out <strong>{out.name}</strong>, who was innocent. <strong>{names}</strong> {impostors.length > 1 ? 'were' : 'was'} the Dhongi.</>
  }

  return (
    <div className={`result ${dhongiWon ? 'r-dhongi' : 'r-innocent'}`}>
      {dhongiWon && iLost && <CryRain />}
      <section className="reveal">
        <p className="reveal-emoji" aria-hidden="true">{dhongiWon ? '🕵️' : '🎉'}</p>
        <h2 className="reveal-head">{headline}</h2>
        <p className="reveal-sub">{sub}</p>
        <p className="reveal-word">The word was <span>{room.reveal_word}</span></p>
        {iWasPlayer && <p className={`you-result ${iLost ? 'lost' : 'won'}`}>{iLost ? 'You lost this one.' : 'You won!'}</p>}
      </section>

      {(room.roast || aiReady) && (
        <section className={`roast ${room.roast ? '' : 'pending'}`} aria-live="polite">
          <span className="roast-who" aria-hidden="true">🎤</span>
          <p>{room.roast || 'The AI host is writing a roast…'}</p>
        </section>
      )}

      <section className="block">
        <h3 className="sub">Votes</h3>
        <ul className="tally">
          {tally.map(({ p, n, max }) => (
            <li key={p.id} className={impostors.includes(p.id) ? 'was-dhongi' : ''}>
              <Avatar p={p} size={28} />
              <span className="who">{p.name}{impostors.includes(p.id) && <span className="tag-dhongi">Dhongi</span>}</span>
              <span className="bar"><i style={{ width: `${(n / max) * 100}%` }} /></span>
              <span className="n">{n}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="sticky-cta">
        {isHost ? (
          <>
            <button className="btn btn-main" disabled={busy} onClick={next}>{busy ? 'Pulling a word…' : 'Next game'}</button>
            <button className="btn btn-quiet small" onClick={lobby}>Back to lobby (change settings or words)</button>
          </>
        ) : (
          <p className="turn-note">Waiting for the host to start the next game.</p>
        )}
        {err && <p className="err" role="alert">{err}</p>}
      </div>
    </div>
  )
}

// Losers get crying emojis raining on their screen until the next game starts.
function CryRain() {
  const drops = useMemo(() => Array.from({ length: 18 }, (_, i) => ({
    i, left: Math.random() * 100, delay: Math.random() * 4, dur: 3.5 + Math.random() * 3, size: 22 + Math.random() * 22,
  })), [])
  return (
    <div className="cry-rain" aria-hidden="true">
      {drops.map(d => (
        <span key={d.i} style={{ left: `${d.left}%`, animationDelay: `${d.delay}s`, animationDuration: `${d.dur}s`, fontSize: d.size }}>😭</span>
      ))}
    </div>
  )
}
