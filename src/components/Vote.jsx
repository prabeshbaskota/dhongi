import React, { useEffect, useState } from 'react'
import { rpc } from '../lib/supabase.js'
import { play } from '../lib/sound.js'
import Card from './Card.jsx'
import { Avatar } from './PlayerList.jsx'

export default function Vote({ room, byId, me, isHost, session, card, clues }) {
  const [pick, setPick] = useState(null)
  const [err, setErr] = useState('')
  const auth = { p_player: session.player_id, p_token: session.token }
  const canVote = card?.state === 'player'
  const inGame = room.turn_order.map(id => byId[id]).filter(Boolean)
  const voted = inGame.filter(p => p.has_voted).length

  useEffect(() => { setPick(null) }, [room.game_no])

  const vote = async (p) => {
    setErr('')
    try { await rpc('cast_vote', { ...auth, p_target: p.id }); setPick(p.id); play('pop') }
    catch (e) { setErr(e.message) }
  }

  const cluesOf = (pid) => clues.filter(c => c.player_id === pid).map(c => c.clue).join(', ')

  return (
    <div className="vote">
      <Card card={card} byId={byId} />
      <h2 className="phase-title">Who’s the Dhongi?</h2>
      <p className="note center">{canVote ? 'Tap the person you think is faking it. You can change your vote until everyone’s in.' : 'Players are voting.'}</p>

      <ul className="vote-list">
        {inGame.map(p => {
          const self = p.id === me.id
          return (
            <li key={p.id}>
              <button className={`vote-btn ${pick === p.id ? 'picked' : ''}`} disabled={!canVote || self} onClick={() => vote(p)}
                aria-pressed={pick === p.id}>
                <Avatar p={p} size={40} />
                <span className="vote-main">
                  <span className="who">{p.name}{self && <em> (you)</em>}</span>
                  <span className="their-clues">{cluesOf(p.id) || 'no clues'}</span>
                </span>
                <span className={`voted-tick ${p.has_voted ? 'yes' : ''}`} aria-label={p.has_voted ? 'has voted' : 'not voted yet'}>
                  {p.has_voted ? '✓' : ''}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <div className="sticky-cta">
        <p className="turn-note">{voted} of {inGame.length} voted</p>
        {err && <p className="err" role="alert">{err}</p>}
        {isHost && (
          <div className="host-row">
            <button className="btn btn-quiet small" onClick={() => { if (confirm('Close the vote and reveal now?')) rpc('end_vote', auth).catch(e => setErr(e.message)) }}>
              Reveal now
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
