import { useEffect, useRef } from 'react'
import { ai } from './ai.js'

// The host's phone nudges the server when it's a bot's turn, when bots need to
// vote, and when the round needs a roast. The server checks everything itself,
// so a duplicate nudge does nothing.
export function useBots({ room, byId, isHost, session, aiReady }) {
  const lastTurn = useRef('')
  const lastVote = useRef('')
  const lastRoast = useRef('')

  const currentId = room?.turn_order?.[room?.turn_idx]
  const currentIsBot = !!(currentId && byId[currentId]?.is_bot)
  const turnKey = room ? `${room.game_no}:${room.round}:${room.turn_idx}` : ''

  useEffect(() => {
    if (!isHost || !aiReady || room?.status !== 'clues' || !currentIsBot) return
    if (lastTurn.current === turnKey) return
    lastTurn.current = turnKey
    const t = setTimeout(() => { ai('bot_turn', session).catch(() => { lastTurn.current = '' }) }, 1800 + Math.random() * 1200)
    return () => clearTimeout(t)
  }, [isHost, aiReady, room?.status, currentIsBot, turnKey]) // eslint-disable-line

  const botsInGame = room?.turn_order?.some(id => byId[id]?.is_bot)
  useEffect(() => {
    if (!isHost || !aiReady || room?.status !== 'voting' || !botsInGame) return
    const key = String(room.game_no)
    if (lastVote.current === key) return
    lastVote.current = key
    const t = setTimeout(() => { ai('bot_votes', session).catch(() => { lastVote.current = '' }) }, 2500)
    return () => clearTimeout(t)
  }, [isHost, aiReady, room?.status, room?.game_no, botsInGame]) // eslint-disable-line

  useEffect(() => {
    if (!isHost || !aiReady || room?.status !== 'result' || room?.roast) return
    const key = String(room.game_no)
    if (lastRoast.current === key) return
    lastRoast.current = key
    const t = setTimeout(() => { ai('roast', session).catch(() => {}) }, 1500)
    return () => clearTimeout(t)
  }, [isHost, aiReady, room?.status, room?.game_no, room?.roast]) // eslint-disable-line
}
