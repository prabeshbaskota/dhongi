import React, { useEffect, useRef, useState } from 'react'
import { hueFor } from './PlayerList.jsx'

export default function Chat({ messages, onSend, me }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [seen, setSeen] = useState(0)
  const listRef = useRef(null)
  const spectator = me.is_spectator
  const unread = open ? 0 : Math.max(0, messages.length - seen)

  useEffect(() => {
    if (open) {
      setSeen(messages.length)
      const el = listRef.current
      if (el) el.scrollTop = el.scrollHeight
    }
  }, [open, messages.length])

  const send = (e) => {
    e.preventDefault()
    if (!text.trim()) return
    onSend(text, spectator)
    setText('')
  }

  return (
    <div className={`chat ${open ? 'open' : ''}`}>
      <button className="chat-toggle" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        💬 Chat {unread > 0 && <span className="badge" aria-label={`${unread} new`}>{unread}</span>}
        <span className="chev" aria-hidden="true">{open ? '▾' : '▴'}</span>
      </button>
      {open && (
        <div className="chat-body">
          <ul className="chat-list" ref={listRef} aria-live="polite">
            {messages.length === 0 && <li className="chat-empty">Say hi. Accuse someone. Defend yourself.</li>}
            {messages.map(m => (
              <li key={m.id} className={`${m.pid === me.id ? 'mine' : ''} ${m.watch ? 'watch' : ''}`}>
                <span className="chat-name" style={{ '--h': hueFor(m.pid || m.name) }}>{m.name}{m.watch && ' 👀'}</span>
                <span className="chat-text">{m.text}</span>
              </li>
            ))}
          </ul>
          <form className="chat-form" onSubmit={send}>
            <input value={text} maxLength={200} placeholder={spectator ? 'Message other watchers' : 'Message everyone'}
              onChange={e => setText(e.target.value)} aria-label="Chat message" />
            <button className="btn btn-second small" disabled={!text.trim()}>Send</button>
          </form>
          {spectator && <p className="note small-note">You’re watching, so your messages only go to other watchers.</p>}
        </div>
      )}
    </div>
  )
}
