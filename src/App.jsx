import React, { useEffect, useState } from 'react'
import Home from './components/Home.jsx'
import Room from './components/Room.jsx'
import { loadSession, clearSession } from './lib/session.js'

function codeFromUrl() {
  const p = new URLSearchParams(location.search)
  return (p.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5)
}

export default function App() {
  const [code, setCode] = useState(codeFromUrl())
  const [session, setSession] = useState(() => loadSession(codeFromUrl()))

  useEffect(() => {
    const onPop = () => { const c = codeFromUrl(); setCode(c); setSession(loadSession(c)) }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const enter = (s) => {
    history.pushState(null, '', `?room=${s.code}`)
    setCode(s.code); setSession(s)
  }
  const leave = () => {
    if (session) clearSession(session.code)
    history.pushState(null, '', location.pathname)
    setCode(''); setSession(null)
  }

  if (session) return <Room session={session} onLeave={leave} />
  return <Home initialCode={code} onEnter={enter} />
}
