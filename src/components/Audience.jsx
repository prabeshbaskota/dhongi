import React from 'react'
import Figure from './Figure.jsx'

// Spectators sit in a little gallery under the table.
export default function Audience({ list, bubbles = {}, reacts = {} }) {
  if (!list.length) return null
  return (
    <div className="audience" aria-label="Watching">
      <span className="audience-label">Watching</span>
      <ul>
        {list.map(p => (
          <li key={p.id}>
            <Figure id={p.id} size={30} title={p.name} />
            <span className="aud-name">{p.name}</span>
            {bubbles[p.id] && <span key={bubbles[p.id].id} className="bubble small" style={{ '--dur': `${bubbles[p.id].dur}ms` }}>{bubbles[p.id].text}</span>}
            {reacts[p.id] && <span key={reacts[p.id].id} className="seat-react small">{reacts[p.id].emoji}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
