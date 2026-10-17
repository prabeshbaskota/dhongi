// Dhongi AI: bot players, themed word packs, and the reveal roast.
// Runs as a Supabase Edge Function so the Groq API key never reaches a browser.
//
// Secrets:  GROQ_API_KEY (required for AI)   GROQ_MODEL (optional)
// Provided by Supabase automatically: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { createClient } from 'jsr:@supabase/supabase-js@2'

const GROQ_KEY = Deno.env.get('GROQ_API_KEY') ?? ''
const MODEL = Deno.env.get('GROQ_MODEL') ?? 'openai/gpt-oss-120b'
const DAILY_CAP = 80 // AI calls per room per day, so nobody can burn the free quota

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

class HttpError extends Error { constructor(public status: number, msg: string) { super(msg) } }

// ---------- helpers ----------
async function caller(playerId: string, token: string) {
  if (!playerId || !token) throw new HttpError(401, 'Missing player')
  const { data: t } = await db.from('player_tokens').select('token').eq('player_id', playerId).maybeSingle()
  if (!t || t.token !== token) throw new HttpError(401, 'Not in this room')
  const { data: p } = await db.from('players').select('*').eq('id', playerId).single()
  if (!p || p.kicked) throw new HttpError(403, 'Not in this room')
  const { data: room } = await db.from('rooms').select('*').eq('id', p.room_id).single()
  return { me: p, room }
}

async function spend(room: any, n = 1) {
  const today = new Date().toISOString().slice(0, 10)
  const used = room.ai_day === today ? room.ai_calls : 0
  if (used + n > DAILY_CAP) throw new HttpError(429, 'AI is resting for today in this room. The game still works without it.')
  await db.from('rooms').update({ ai_calls: used + n, ai_day: today }).eq('id', room.id)
}

async function ask(system: string, user: string, maxTokens = 500, temperature = 0.9): Promise<string> {
  if (!GROQ_KEY) throw new HttpError(503, 'AI is not set up yet')
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      temperature,
      max_completion_tokens: maxTokens,
      reasoning_effort: 'low',
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
  })
  if (!res.ok) throw new HttpError(502, `AI request failed (${res.status})`)
  const data = await res.json()
  return String(data?.choices?.[0]?.message?.content ?? '').trim()
}

const clean = (s: string) =>
  s.split('\n')[0].replace(/^["'“”‘’\s-]+|["'“”‘’\s.!]+$/g, '').replace(/^clue:\s*/i, '').slice(0, 30)

async function gameState(room: any) {
  const [{ data: players }, { data: clues }, { data: roles }] = await Promise.all([
    db.from('players').select('id,name,is_bot,kicked').eq('room_id', room.id),
    db.from('clues').select('player_id,round,clue').eq('room_id', room.id).eq('game_no', room.game_no).order('id'),
    db.from('roles').select('player_id,is_impostor,word').eq('room_id', room.id).eq('game_no', room.game_no),
  ])
  const byId = Object.fromEntries((players ?? []).map((p: any) => [p.id, p]))
  return { players: players ?? [], clues: clues ?? [], roles: roles ?? [], byId }
}

const clueLines = (clues: any[], byId: any) =>
  clues.length ? clues.map(c => `Round ${c.round} - ${byId[c.player_id]?.name ?? '?'}: ${c.clue}`).join('\n') : '(no clues yet)'

async function tokenOf(id: string) {
  const { data } = await db.from('player_tokens').select('token').eq('player_id', id).single()
  return data!.token as string
}

// ---------- actions ----------
async function words(me: any, room: any, theme: string) {
  if (room.host_id !== me.id) throw new HttpError(403, 'Only the host can do that')
  const t = String(theme ?? '').trim().slice(0, 60)
  if (!t) throw new HttpError(400, 'Type a theme first')
  await spend(room)
  const out = await ask(
    'You create word lists for a family-friendly party game where players give one-word clues about a secret word. ' +
      'Reply with ONLY a comma-separated list. No numbering, no explanations.',
    `Theme: ${t}\nGive 20 varied secret words or short phrases (1-3 words each) that fit this theme. ` +
      'Mix easy and tricky ones. Only real, well-known things that most people in a friend group would recognise. ' +
      'If you are not sure something is real, leave it out. Nothing offensive.',
    700,
    0.5,
  )
  const list = [...new Set(out.split(/[,\n]/).map(w => w.replace(/^\d+[.)]\s*/, '').trim()).filter(w => w && w.length <= 30))].slice(0, 25)
  if (!list.length) throw new HttpError(502, 'AI came back empty. Try another theme.')
  return { words: list }
}

async function botTurn(room: any) {
  if (room.status !== 'clues') return { skipped: 'not clue phase' }
  const botId = room.turn_order[room.turn_idx]
  const st = await gameState(room)
  const bot = st.byId[botId]
  if (!bot?.is_bot) return { skipped: 'not a bot turn' }
  const role = st.roles.find((r: any) => r.player_id === botId)
  const said = st.clues.filter((c: any) => c.player_id === botId).map((c: any) => c.clue)

  let clue = ''
  try {
    await spend(room)
    if (role?.is_impostor) {
      clue = clean(await ask(
        'You are playing an impostor word game and you are secretly the impostor: you do NOT know the secret word. ' +
          'Everyone else knows it and gives short clues. Blend in. Reply with ONLY your clue: 1-3 words.',
        `Clues so far:\n${clueLines(st.clues, st.byId)}\n\nYour earlier clues: ${said.join(', ') || 'none'}\n` +
          'Work out what the word probably is from the clues and give a new clue that fits but is a bit vague. ' +
          'If there are no clues yet, give a very general clue that could fit almost anything.',
      ))
    } else {
      clue = clean(await ask(
        'You are playing an impostor word game. You know the secret word. Give a clue that proves you know it, ' +
          'but is not so obvious that the impostor can guess the word. Reply with ONLY your clue: 1-3 words.',
        `Secret word: ${role?.word}\nClues so far:\n${clueLines(st.clues, st.byId)}\n` +
          `Your earlier clues: ${said.join(', ') || 'none'}\nNever use the secret word or part of it. Don't repeat a clue.`,
      ))
    }
  } catch (_) { /* fall through to fallback */ }

  const token = await tokenOf(botId)
  const tryClue = async (c: string) => db.rpc('submit_clue', { p_player: botId, p_token: token, p_clue: c })
  let { error } = clue ? await tryClue(clue) : { error: { message: 'empty' } }
  if (error && !/Wait for your turn|Not the clue phase/.test(error.message)) {
    ;({ error } = await tryClue('🤔 hmm'))
  }
  return { clue: error ? null : clue || '🤔 hmm' }
}

async function botVotes(room: any) {
  if (room.status !== 'voting') return { skipped: 'not voting' }
  const st = await gameState(room)
  const inGame = room.turn_order.map((id: string) => st.byId[id]).filter(Boolean)
  const bots = inGame.filter((p: any) => p.is_bot)
  const { data: voted } = await db.from('votes').select('voter_id').eq('room_id', room.id).eq('game_no', room.game_no)
  const done = new Set((voted ?? []).map((v: any) => v.voter_id))
  const results: any[] = []

  for (const bot of bots) {
    if (done.has(bot.id)) continue
    const role = st.roles.find((r: any) => r.player_id === bot.id)
    const others = inGame.filter((p: any) => p.id !== bot.id)
    let target = others[Math.floor(Math.random() * others.length)]
    try {
      await spend(room)
      const roster = others.map((p: any) => {
        const cs = st.clues.filter((c: any) => c.player_id === p.id).map((c: any) => c.clue).join(', ')
        return `${p.name}: ${cs || 'no clues'}`
      }).join('\n')
      const answer = await ask(
        'You are voting in an impostor word game. Reply with ONLY the exact name of one player from the list.',
        role?.is_impostor
          ? `You are secretly the impostor and want an innocent player voted out. Pick the player whose clues look most suspicious to others.\n${roster}`
          : `The secret word is "${role?.word}". The impostor didn't know it, so their clues fit less well. Who is the impostor?\n${roster}`,
        300,
      )
      const pick = others.find((p: any) => answer.toLowerCase().includes(p.name.toLowerCase()))
      if (pick) target = pick
    } catch (_) { /* random vote fallback */ }
    const { error } = await db.rpc('cast_vote', { p_player: bot.id, p_token: await tokenOf(bot.id), p_target: target.id })
    results.push({ bot: bot.name, ok: !error })
  }
  return { votes: results }
}

async function roast(room: any) {
  if (room.status !== 'result' || room.roast) return { roast: room.roast ?? null }
  const st = await gameState(room)
  const names = (room.reveal_impostors ?? []).map((id: string) => st.byId[id]?.name).join(' & ')
  const out = room.voted_out ? st.byId[room.voted_out]?.name : null
  await spend(room)
  const text = (await ask(
    'You are the funny host of a party game played by friends. Write a short, playful roast of how the round went. ' +
      'Friendly teasing only: no insults about appearance, race, religion, gender or anything hurtful. ' +
      'Max 2 sentences, under 220 characters. You can use one emoji.',
    `Secret word: ${room.reveal_word}\nThe Dhongi (impostor): ${names}\n` +
      `Result: ${room.result === 'innocents' ? 'the Dhongi was caught' : out ? `the group wrongly voted out ${out}` : 'the vote tied and the Dhongi escaped'}\n` +
      `Clues:\n${clueLines(st.clues, st.byId)}\nRoast the funniest clue or the worst detective work.`,
    500,
  )).slice(0, 260)
  if (!text) return { roast: null }
  await db.from('rooms').update({ roast: text }).eq('id', room.id).is('roast', null)
  return { roast: text }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const body = await req.json().catch(() => ({}))
    if (body.action === 'status') return json({ ai: !!GROQ_KEY })
    const { me, room } = await caller(body.player_id, body.token)
    switch (body.action) {
      case 'words': return json(await words(me, room, body.theme))
      case 'bot_turn': return json(await botTurn(room))
      case 'bot_votes': return json(await botVotes(room))
      case 'roast': return json(await roast(room))
      default: return json({ error: 'Unknown action' }, 400)
    }
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500
    return json({ error: e instanceof Error ? e.message : 'Something went wrong' }, status)
  }
})
