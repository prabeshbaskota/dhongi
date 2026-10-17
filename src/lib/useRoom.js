import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, rpc } from './supabase.js'

// Loads a room, its players and clues, plus *your own* card,
// and keeps them live with Supabase Realtime.
export function useRoom(session) {
  const [room, setRoom] = useState(null)
  const [players, setPlayers] = useState([])
  const [clues, setClues] = useState([])
  const [card, setCard] = useState(null)
  const [error, setError] = useState(null)
  const gameNo = room?.game_no
  const roomId = session?.room_id
  const alive = useRef(true)

  const loadRoom = useCallback(async () => {
    const { data, error } = await supabase.from('rooms').select('*').eq('id', roomId).single()
    if (!alive.current) return
    if (error) { setError('This room no longer exists.'); return }
    setRoom(data)
  }, [roomId])

  const loadPlayers = useCallback(async () => {
    const { data } = await supabase.from('players').select('*').eq('room_id', roomId).order('joined_at')
    if (alive.current && data) setPlayers(data)
  }, [roomId])

  const loadClues = useCallback(async (g) => {
    if (!g) { setClues([]); return }
    const { data } = await supabase.from('clues').select('*')
      .eq('room_id', roomId).eq('game_no', g).order('id')
    if (alive.current && data) setClues(data)
  }, [roomId])

  const loadCard = useCallback(async () => {
    try {
      const c = await rpc('my_card', { p_player: session.player_id, p_token: session.token })
      if (alive.current) setCard(c)
    } catch (e) {
      if (alive.current) setError(e.message)
    }
  }, [session])

  useEffect(() => {
    alive.current = true
    if (!roomId) return
    loadRoom(); loadPlayers()
    const ch = supabase.channel(`db:${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (p) => { if (p.new && p.new.id) setRoom(p.new) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` },
        () => loadPlayers())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'clues', filter: `room_id=eq.${roomId}` },
        (p) => setClues(prev => (p.new && !prev.some(c => c.id === p.new.id) ? [...prev, p.new] : prev)))
      .subscribe((status) => {
        // after a reconnect, re-sync everything in case we missed updates
        if (status === 'SUBSCRIBED') { loadRoom(); loadPlayers() }
      })
    // safety net for flaky mobile connections
    const poll = setInterval(() => { loadRoom(); loadPlayers() }, 15000)
    return () => { alive.current = false; clearInterval(poll); supabase.removeChannel(ch) }
  }, [roomId, loadRoom, loadPlayers])

  // new game, new clues + new card
  useEffect(() => {
    if (gameNo === undefined) return
    loadClues(gameNo)
    loadCard()
  }, [gameNo, loadClues, loadCard])

  // director view can be toggled mid-game; refresh card when it changes
  useEffect(() => { if (room) loadCard() }, [room?.director_view]) // eslint-disable-line

  return { room, players, clues, card, error, reload: () => { loadRoom(); loadPlayers(); loadClues(gameNo); loadCard() } }
}
