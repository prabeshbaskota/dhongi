import React, { useState } from 'react'

// No chat history during the game: messages pop up over the sender's seat for
// a few seconds and vanish. The full log appears after the vote.
export default function Chat({ onSend, me }) {
  const [text, setText] = useState('')
  const spectator = me.is_spectator

  const send = (e) => {
    e.preventDefault()
    if (!text.trim()) return
    onSend(text, spectator)
    setText('')
  }

  return (
    <form className="chat-bar" onSubmit={send}>
      <input value={text} maxLength={140} enterKeyHint="send" autoComplete="off"
        placeholder={spectator ? 'Whisper to other watchers…' : 'Say something… it vanishes in seconds'}
        onChange={e => setText(e.target.value)} aria-label="Chat message" />
      <button className="btn btn-second small" disabled={!text.trim()}>Send</button>
    </form>
  )
}

export function ChatLog({ messages, title = 'What everyone said' }) {
  if (!messages.length) return null
  return (
    <section className="block chat-log">
      <h3 className="sub">{title}</h3>
      <ul>
        {messages.map(m => (
          <li key={m.id} className={m.watch ? 'watch' : ''}>
            <strong>{m.name}{m.watch ? ' 👀' : ''}</strong> {m.text}
          </li>
        ))}
      </ul>
    </section>
  )
}
