import React from 'react'
import { REACTIONS } from '../lib/sound.js'

export default function Reactions({ onReact }) {
  return (
    <div className="reactions" role="toolbar" aria-label="Funny sounds everyone hears">
      {REACTIONS.map(r => (
        <button key={r.id} onClick={() => onReact(r)} aria-label={r.label} title={r.label}>{r.emoji}</button>
      ))}
    </div>
  )
}
