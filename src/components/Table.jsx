import React from 'react'
import Figure from './Figure.jsx'

function sizeFor(n) {
  if (n <= 4) return 66
  if (n <= 6) return 58
  if (n <= 8) return 50
  if (n <= 10) return 44
  if (n <= 12) return 40
  return 34
}

// Everyone sits around one table. You are always at the bottom, and seats run
// clockwise in turn order, so the turn literally travels round the table.
export default function Table({
  seats, meId, currentId, bubbles = {}, reacts = {}, tags = {}, moods = {}, badges = {},
  stamps, selectedId, onSeat, canSelect, center, emptyChair, onEmptyChair,
}) {
  const list = emptyChair ? [...seats, { id: '__empty__', empty: true }] : seats
  const n = Math.max(list.length, 1)
  const meIdx = Math.max(0, list.findIndex(p => p.id === meId))
  const size = sizeFor(n)

  return (
    <div className="table-wrap" style={{ '--seat': `${size}px` }}>
      <div className="table-top" aria-hidden="true"><div className="table-felt" /></div>
      <div className="table-center">{center}</div>

      {list.map((p, i) => {
        const angle = (Math.PI / 2) + ((i - meIdx) * 2 * Math.PI) / n
        const x = 50 + 41 * Math.cos(angle)
        const y = 50 + 37 * Math.sin(angle)
        const top = y < 40

        if (p.empty) {
          return (
            <button key={p.id} className="seat seat-empty" style={{ left: `${x}%`, top: `${y}%` }} onClick={onEmptyChair}
              aria-label="Empty chair. Invite a friend">
              <span className="chair" />
              <span className="plus" aria-hidden="true">+</span>
              <span className="seat-name">Invite</span>
            </button>
          )
        }

        const selectable = !!onSeat && (!canSelect || canSelect(p))
        const bubble = bubbles[p.id]
        const react = reacts[p.id]
        const Tag = selectable ? 'button' : 'div'
        return (
          <Tag key={p.id}
            className={[
              'seat',
              p.id === currentId && 'is-turn',
              p.id === meId && 'is-me',
              selectedId === p.id && 'is-picked',
              stamps?.has(p.id) && 'is-dhongi',
              selectable && 'is-selectable',
            ].filter(Boolean).join(' ')}
            style={{ left: `${x}%`, top: `${y}%` }}
            onClick={selectable ? () => onSeat(p) : undefined}
            aria-label={selectable ? `Vote for ${p.name}` : undefined}
            aria-pressed={selectable ? selectedId === p.id : undefined}
          >
            <span className="chair" aria-hidden="true" />
            <span className="seat-fig">
              <Figure id={p.id} size={size} mood={moods[p.id] || (p.id === currentId ? 'think' : 'normal')} bot={p.is_bot} title={p.name} />
              {stamps?.has(p.id) && <span className="seat-stamp" lang="ne">ढोंगी</span>}
              {badges[p.id] !== undefined && badges[p.id] !== null && <span className="seat-badge">{badges[p.id]}</span>}
            </span>
            <span className="seat-name">{p.name}{p.id === meId ? ' (you)' : ''}</span>
            {tags[p.id] && <span className="seat-tag">{tags[p.id]}</span>}

            {bubble && (
              <span key={bubble.id} className={`bubble ${top ? 'below' : ''}`} style={{ '--dur': `${bubble.dur}ms` }}>
                {bubble.text}
              </span>
            )}
            {react && <span key={react.id} className="seat-react" aria-hidden="true">{react.emoji}</span>}
          </Tag>
        )
      })}
    </div>
  )
}
