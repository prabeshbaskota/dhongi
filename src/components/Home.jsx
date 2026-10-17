import React, { useState } from 'react'
import { rpc } from '../lib/supabase.js'
import { saveSession, lastName, rememberName } from '../lib/session.js'
import { play } from '../lib/sound.js'
import HowTo from './HowTo.jsx'

export default function Home({ initialCode, onEnter }) {
  const [name, setName] = useState(lastName())
  const [code, setCode] = useState(initialCode || '')
  const [watch, setWatch] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const joining = !!initialCode

  const go = async (kind) => {
    setErr('')
    const n = name.trim()
    if (!n) { setErr('Type your name first.'); return }
    if (kind === 'join' && code.trim().length < 5) { setErr('Room codes are 5 characters.'); return }
    setBusy(true)
    try {
      const res = kind === 'create'
        ? await rpc('create_room', { p_name: n })
        : await rpc('join_room', { p_code: code.trim(), p_name: n, p_spectator: watch })
      rememberName(n)
      saveSession(res)
      play('ding')
      onEnter(res)
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="home">
      <header className="brand">
        <Jar />
        <h1 className="logo"><span lang="ne">ढोंगी</span><span className="logo-latin">Dhongi</span></h1>
        <p className="tagline">Everyone gets the secret word except the Dhongi. Give clues, vote, catch them.</p>
      </header>

      <section className="panel">
        <label className="field">
          <span>Your name</span>
          <input value={name} maxLength={20} autoComplete="nickname" placeholder="e.g. Prabesh"
            onChange={e => setName(e.target.value)} />
        </label>

        {joining ? (
          <>
            <p className="join-code">Joining room <strong>{code}</strong></p>
            <label className="check">
              <input type="checkbox" checked={watch} onChange={e => setWatch(e.target.checked)} />
              <span>Just watch (spectator)</span>
            </label>
            <button className="btn btn-main" disabled={busy} onClick={() => go('join')}>
              {busy ? 'Joining…' : watch ? 'Watch the game' : 'Join the game'}
            </button>
            <button className="btn btn-quiet" onClick={() => { history.pushState(null, '', location.pathname); location.reload() }}>
              Start my own room instead
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-main" disabled={busy} onClick={() => go('create')}>
              {busy ? 'Making room…' : 'Start a room'}
            </button>
            <div className="or"><span>or join a friend</span></div>
            <div className="join-row">
              <input className="code-input" value={code} maxLength={5} placeholder="CODE" autoCapitalize="characters"
                onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
              <button className="btn btn-second" disabled={busy} onClick={() => go('join')}>Join</button>
            </div>
            <label className="check">
              <input type="checkbox" checked={watch} onChange={e => setWatch(e.target.checked)} />
              <span>Join as a spectator</span>
            </label>
          </>
        )}
        {err && <p className="err" role="alert">{err}</p>}
      </section>

      <HowTo />
      <footer className="foot">Free. No app, no sign-up. Made in Darwin.</footer>
    </main>
  )
}

function Jar() {
  return (
    <svg className="jar" viewBox="0 0 120 120" aria-hidden="true">
      <rect x="30" y="14" width="60" height="14" rx="6" fill="var(--marigold)" />
      <path d="M34 28h52v6c0 3-2 5-4 6l4 52c0 10-7 16-16 16H50c-9 0-16-6-16-16l4-52c-2-1-4-3-4-6z"
        fill="var(--glass)" stroke="var(--paper)" strokeWidth="3" />
      <g className="slips">
        <rect x="46" y="70" width="18" height="10" rx="2" fill="var(--paper)" transform="rotate(-14 55 75)" />
        <rect x="60" y="78" width="18" height="10" rx="2" fill="var(--paper)" transform="rotate(10 69 83)" />
        <rect x="50" y="86" width="18" height="10" rx="2" fill="var(--chili)" transform="rotate(-4 59 91)" />
        <rect x="64" y="62" width="16" height="9" rx="2" fill="var(--paper)" transform="rotate(22 72 66)" />
      </g>
    </svg>
  )
}
