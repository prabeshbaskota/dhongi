import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase.js'
import { play } from './sound.js'

// Chat, reactions and "who's online" over Realtime broadcast.
// Players only ever subscribe to the players channel. Spectators also get a
// separate watchers channel, so anything they say (for example while
// director view shows them the Dhongi) never reaches a player's phone.
export function useLive(session, me) {
  const [messages, setMessages] = useState([])
  const [floaters, setFloaters] = useState([])
  const [online, setOnline] = useState({})
  // speech bubbles and emoji pops over each seat, keyed by player id
  const [bubbles, setBubbles] = useState({})
  const [reacts, setReacts] = useState({})
  const playersCh = useRef(null)
  const watchCh = useRef(null)
  const isSpectator = !!me?.is_spectator
  const roomId = session?.room_id

  const addMessage = useCallback((m) => {
    setMessages(prev => [...prev.slice(-199), m])
    if (!m.pid) return
    // short messages stay 3 seconds; longer ones get a little more time to read
    const dur = Math.min(7000, 3000 + m.text.length * 45)
    const text = m.text.length > 90 ? m.text.slice(0, 88) + '…' : m.text
    setBubbles(prev => ({ ...prev, [m.pid]: { id: m.id, text, dur } }))
    setTimeout(() => setBubbles(prev => (prev[m.pid]?.id === m.id ? (({ [m.pid]: _, ...rest }) => rest)(prev) : prev)), dur)
  }, [])

  const addFloater = useCallback((emoji, name, pid) => {
    const id = Math.random().toString(36).slice(2)
    const left = 10 + Math.random() * 80
    setFloaters(prev => [...prev, { id, emoji, name, left }])
    setTimeout(() => setFloaters(prev => prev.filter(f => f.id !== id)), 2600)
    if (pid) {
      setReacts(prev => ({ ...prev, [pid]: { id, emoji } }))
      setTimeout(() => setReacts(prev => (prev[pid]?.id === id ? (({ [pid]: _, ...rest }) => rest)(prev) : prev)), 1600)
    }
  }, [])

  useEffect(() => {
    if (!roomId || !me) return
    const p = supabase.channel(`room:${roomId}:players`, { config: { presence: { key: session.player_id } } })
    p.on('broadcast', { event: 'chat' }, ({ payload }) => { addMessage(payload); play('pop') })
     .on('broadcast', { event: 'react' }, ({ payload }) => { addFloater(payload.emoji, payload.name, payload.pid); play(payload.sound) })
     .on('presence', { event: 'sync' }, () => {
       const st = p.presenceState()
       const o = {}
       Object.keys(st).forEach(k => { o[k] = true })
       setOnline(o)
     })
     .subscribe(async (status) => {
       if (status === 'SUBSCRIBED') await p.track({ at: Date.now() })
     })
    playersCh.current = p

    let w = null
    if (isSpectator) {
      w = supabase.channel(`room:${roomId}:watch`)
      w.on('broadcast', { event: 'chat' }, ({ payload }) => { addMessage({ ...payload, watch: true }); play('pop') })
       .subscribe()
      watchCh.current = w
    }
    return () => {
      supabase.removeChannel(p)
      if (w) supabase.removeChannel(w)
      playersCh.current = null; watchCh.current = null
    }
  }, [roomId, session?.player_id, !!me, isSpectator, addMessage, addFloater]) // eslint-disable-line

  const sendChat = useCallback((text, toWatchers) => {
    const t = text.trim().slice(0, 200)
    if (!t || !me) return
    const msg = { id: Math.random().toString(36).slice(2), name: me.name, pid: me.id, text: t, ts: Date.now(), watch: !!toWatchers }
    const ch = toWatchers ? watchCh.current : playersCh.current
    if (!ch) return
    ch.send({ type: 'broadcast', event: 'chat', payload: msg })
    addMessage(msg) // broadcast doesn't echo to the sender
  }, [me, addMessage])

  const lastReact = useRef(0)
  const sendReaction = useCallback((r) => {
    const now = Date.now()
    if (now - lastReact.current < 700 || !me || !playersCh.current) return
    lastReact.current = now
    const payload = { emoji: r.emoji, sound: r.id, name: me.name, pid: me.id }
    playersCh.current.send({ type: 'broadcast', event: 'react', payload })
    addFloater(r.emoji, me.name, me.id)
    play(r.id)
  }, [me, addFloater])

  return { messages, floaters, online, bubbles, reacts, sendChat, sendReaction }
}
