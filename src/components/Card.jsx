import React, { useEffect, useState } from 'react'
import { play } from '../lib/sound.js'

// Your secret slip from the jar. Tap to peek, tap again to hide,
// so the person sitting next to you can't read it.
export default function Card({ card, byId }) {
  const [open, setOpen] = useState(false)
  useEffect(() => { setOpen(false) }, [card?.game_no])

  if (!card || card.state === 'lobby') return null

  if (card.state === 'watcher') {
    return (
      <div className="slip slip-watch">
        <p className="slip-title">You’re watching</p>
        <p className="slip-sub">The word stays secret until the reveal. You’ll be dealt in next game.</p>
      </div>
    )
  }

  if (card.state === 'director') {
    const names = (card.impostors || []).map(id => byId[id]?.name || 'someone').join(' & ')
    return (
      <div className="slip slip-director">
        <p className="slip-title">Director view</p>
        <p className="slip-word">{card.word}</p>
        <p className="slip-sub">The Dhongi is <strong>{names}</strong>. Keep it quiet. Your chat only goes to other watchers.</p>
      </div>
    )
  }

  const toggle = () => { setOpen(o => !o); play('pop') }

  return (
    <button className={`slip ${open ? 'open' : ''} ${open && card.is_impostor ? 'is-dhongi' : ''}`} onClick={toggle}
      aria-label={open ? 'Hide your word' : 'Tap to see your word'}>
      {!open ? (
        <>
          <p className="slip-title">Your slip</p>
          <p className="slip-sub">Tap to peek. Tap again to hide.</p>
        </>
      ) : card.is_impostor ? (
        <>
          <span className="stamp" lang="ne">ढोंगी</span>
          <p className="slip-word">You are the Dhongi</p>
          <p className="slip-sub">You don’t know the word. Read the clues and blend in.</p>
        </>
      ) : (
        <>
          <p className="slip-title">The secret word is</p>
          <p className="slip-word">{card.word}</p>
          <p className="slip-sub">Give clues about it, but don’t make it too easy.</p>
        </>
      )}
    </button>
  )
}
