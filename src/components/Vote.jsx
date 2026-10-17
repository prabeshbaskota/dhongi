import React, { useEffect, useMemo, useState } from 'react'
import { rpc } from '../lib/supabase.js'
import { play } from '../lib/sound.js'
import Card from './Card.jsx'
import Table from './Table.jsx'
import Audience from './Audience.jsx'
import { Avatar } from './PlayerList.jsx'

export default function Vote({ room, players, byId, me, isHost, session, card, clues, bubbles, reacts }) {
  const [pick, setPick] = useState(null)
  const [err, setErr] = useState('')
  const auth = { p_player: session.player_id, p_token: session.token }
  const canVote = card?.state === 'player'
  const inGame = room.turn_order.map(id => byId[id]).filter(Boolean)
  const voted = inGame.filter(p => p.has_voted).length
  const watching = players.filter(p => !p.kicked && !room.turn_order.includes(p.id))

  useEffect(() => { setPick(null) }, [room.game_no])

  const vote = async (p) => {
    if (!canVote || p.id === me.id) return
    setErr('')
    try { await rpc('cast_vote', { ...auth, p_target: p.id }); setPick(p.id); play('pop') }
    catch (e) { setErr(e.message) }
  }

  const tags = useMemo(() => {
    const t = {}
    clues.forEach(c => { t[c.player_id] = c.clue })
    return t
  }, [clues])
  const badges = useMemo(() => Object.fromEntries(inGame.map(p => [p.id, p.has_voted ? '✓' : null])), [inGame])
  const cluesOf = (pid) => clues.filter(c => c.player_id === pid).map(c => c.clue).join(', ')

  return (
    <div className="vote">
      <Table seats={inGame} meId={me.id} tags={tags} bubbles={bubbles} reacts={reacts} badges={badges}
        selectedId={pick} onSeat={canVote ? vote : undefined} canSelect={(p) => p.id !== me.id}
        center={
          <div className="center-note">
            <span className="turn">Who’s the Dhongi?</span>
            <span className="small">{voted} of {inGame.length} voted</span>
          </div>
        } />
      <Audience list={watching} bubbles={bubbles} reacts={reacts} />

      <p className="note center">{canVote ? 'Tap the person you think is faking it. You can change your vote until everyone’s in.' : 'Players are voting.'}</p>
      {err && <p className="err center" role="alert">{err}</p>}

      <Card card={card} byId={byId} compact />

      <ul className="vote-list" aria-label="Everyone's clues">
        {inGame.map(p => {
          const self = p.id === me.id
          return (
            <li key={p.id}>
              <button className={`vote-btn ${pick === p.id ? 'picked' : ''}`} disabled={!canVote || self} onClick={() => vote(p)}
                aria-pressed={pick === p.id}>
                <Avatar p={p} size={36} />
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

      {isHost && (
        <div className="host-row">
          <button className="btn btn-quiet small" onClick={() => { if (confirm('Close the vote and reveal now?')) rpc('end_vote', auth).catch(e => setErr(e.message)) }}>
            Reveal now
          </button>
        </div>
      )}
    </div>
  )
}
