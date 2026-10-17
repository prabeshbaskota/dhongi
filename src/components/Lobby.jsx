import React, { useState } from 'react'
import { rpc } from '../lib/supabase.js'
import PlayerList from './PlayerList.jsx'
import { ai } from '../lib/ai.js'

const STARTERS = {
  Food: 'Momo, Pizza, Sushi, Chocolate, Mango, Ice cream, Noodles, Popcorn, Burger, Samosa, Pani puri, Watermelon',
  Places: 'Beach, Airport, Hospital, Cinema, Gym, Library, Zoo, Mountain, Supermarket, Casino, Petrol station, Temple',
  Animals: 'Crocodile, Kangaroo, Penguin, Elephant, Frog, Horse, Shark, Owl, Monkey, Yak, Spider, Dolphin',
  Things: 'Umbrella, Toothbrush, Phone charger, Mirror, Pillow, Guitar, Ladder, Candle, Wallet, Sunglasses, Remote, Backpack',
}

export default function Lobby({ room, players, me, isHost, session, online, aiReady }) {
  const [words, setWords] = useState('')
  const [theme, setTheme] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const auth = { p_player: session.player_id, p_token: session.token }

  const active = players.filter(p => !p.kicked)
  const playing = active.filter(p => !p.is_spectator)
  const watching = active.filter(p => p.is_spectator)

  const call = async (fn, args, ok) => {
    setErr(''); setMsg('')
    try { const r = await rpc(fn, { ...auth, ...args }); if (ok) setMsg(ok(r)); return r }
    catch (e) { setErr(e.message) }
  }

  const settings = (patch) => call('set_settings', {
    p_rounds: patch.rounds ?? room.max_rounds,
    p_impostors: patch.imp ?? room.impostor_count,
    p_director: patch.dir ?? room.director_view,
  })

  const fillJar = async () => {
    if (!words.trim()) { setErr('Type or add some words first.'); return }
    const n = await call('set_words', { p_words: words }, (n) => `${n} word${n === 1 ? '' : 's'} in the jar.`)
    if (typeof n === 'number') setWords('')
  }

  const start = async () => { setBusy(true); await call('start_game', {}); setBusy(false) }

  const aiWords = async () => {
    setErr(''); setMsg('')
    if (!theme.trim()) { setErr('Type a theme first, like “Bollywood” or “Darwin”.'); return }
    setAiBusy(true)
    try {
      const { words: list } = await ai('words', session, { theme })
      setWords(w => (w.trim() ? w.trim() + ', ' : '') + list.join(', '))
      setMsg(`AI made ${list.length} words. Check them, then put them in the jar.`)
    } catch (e) { setErr(e.message) }
    setAiBusy(false)
  }

  const humans = playing.filter(p => !p.is_bot).length
  const bots = playing.filter(p => p.is_bot).length
  const canAddBot = aiReady && humans < 3 && bots < 2

  const notReady = playing.length < 3 ? `Need ${3 - playing.length} more player${playing.length === 2 ? '' : 's'}`
    : room.word_count === 0 ? 'Fill the jar first' : null

  return (
    <div className="lobby">
      <section className="invite">
        <p className="invite-lead">Send friends the link, or tell them the code</p>
        <p className="invite-code" aria-label={`Room code ${room.code}`}>{room.code}</p>
        <InviteButtons code={room.code} />
      </section>

      <section className="block">
        <h2>Players <span className="count">{playing.length}</span></h2>
        <PlayerList list={playing} room={room} me={me} isHost={isHost} online={online} session={session} />
        {watching.length > 0 && (
          <>
            <h3 className="sub">Watching <span className="count">{watching.length}</span></h3>
            <PlayerList list={watching} room={room} me={me} isHost={isHost} online={online} session={session} />
          </>
        )}
        {isHost && canAddBot && (
          <button className="btn btn-second small" onClick={() => call('add_bot', {}, (b) => `${b.name} joined. It plays with AI.`)}>
            🤖 Add an AI player
          </button>
        )}
        {isHost && aiReady && humans < 3 && bots === 0 && (
          <p className="note">Short on friends? AI players can fill in until 3 people are here.</p>
        )}
        <button className="btn btn-quiet small"
          onClick={() => call('set_spectator', { p_spectator: !me.is_spectator })}>
          {me.is_spectator ? 'Play instead of watching' : 'Watch instead of playing'}
        </button>
      </section>

      {isHost ? (
        <>
          <section className="block">
            <h2>Game settings</h2>
            <div className="setting">
              <span id="rounds-l">Clue rounds</span>
              <div className="stepper" role="group" aria-labelledby="rounds-l">
                <button onClick={() => settings({ rounds: Math.max(1, room.max_rounds - 1) })} aria-label="Fewer rounds">−</button>
                <strong>{room.max_rounds}</strong>
                <button onClick={() => settings({ rounds: Math.min(7, room.max_rounds + 1) })} aria-label="More rounds">+</button>
              </div>
            </div>
            <div className="setting">
              <span id="imp-l">Dhongis</span>
              <div className="seg" role="group" aria-labelledby="imp-l">
                {[1, 2].map(n => (
                  <button key={n} className={room.impostor_count === n ? 'on' : ''} onClick={() => settings({ imp: n })}>{n}</button>
                ))}
              </div>
            </div>
            {room.impostor_count === 2 && playing.length < 7 && (
              <p className="note">Two Dhongis kicks in at 7+ players. With fewer, there’ll be one.</p>
            )}
            <label className="setting toggle">
              <span>
                Director view
                <small>Spectators see the word and who the Dhongi is. Only turn on if nobody playing is also watching on a second phone.</small>
              </span>
              <input type="checkbox" checked={room.director_view} onChange={e => settings({ dir: e.target.checked })} />
            </label>
          </section>

          <section className="block">
            <h2>The jar <span className="count">{room.word_count} word{room.word_count === 1 ? '' : 's'}</span></h2>
            <p className="note">One word, comma or new line each. Putting words in replaces what’s in the jar. Nobody else sees this list.</p>
            <textarea className="words" rows={4} value={words} onChange={e => setWords(e.target.value)}
              placeholder="Momo, Darwin, Crocodile, Mitchell Street…" />
            <div className="starters">
              <span>Add a starter pack:</span>
              {Object.keys(STARTERS).map(k => (
                <button key={k} className="chip" onClick={() => setWords(w => (w.trim() ? w.trim() + ', ' : '') + STARTERS[k])}>{k}</button>
              ))}
            </div>
            {aiReady && (
              <div className="ai-words">
                <label htmlFor="theme">Or let AI make words on a theme</label>
                <div className="clue-row">
                  <input id="theme" value={theme} maxLength={60} placeholder="e.g. Bollywood, Darwin, Nepali food"
                    onChange={e => setTheme(e.target.value)} />
                  <button className="btn btn-second" disabled={aiBusy} onClick={aiWords}>{aiBusy ? 'Thinking…' : '✨ Make'}</button>
                </div>
              </div>
            )}
            <button className="btn btn-second" onClick={fillJar}>Put words in the jar</button>
          </section>

          {msg && <p className="ok" role="status">{msg}</p>}
          {err && <p className="err" role="alert">{err}</p>}

          <div className="sticky-cta">
            <button className="btn btn-main" disabled={!!notReady || busy} onClick={start}>
              {busy ? 'Pulling a word…' : notReady || 'Start the game'}
            </button>
          </div>
        </>
      ) : (
        <section className="block waiting">
          <p className="big-emoji" aria-hidden="true">🫙</p>
          <p>Waiting for the host to fill the jar and start.</p>
          <p className="note">{room.max_rounds} clue round{room.max_rounds === 1 ? '' : 's'} · {room.word_count} word{room.word_count === 1 ? '' : 's'} in the jar</p>
          {err && <p className="err" role="alert">{err}</p>}
        </section>
      )}
    </div>
  )
}

function InviteButtons({ code }) {
  const [copied, setCopied] = useState(false)
  const url = `${location.origin}${location.pathname}?room=${code}`
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* ignore */ }
  }
  const wa = `https://wa.me/?text=${encodeURIComponent(`Come play Dhongi with me! Room ${code}: ${url}`)}`
  return (
    <div className="invite-actions">
      <button className="btn btn-second small" onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
      <a className="btn btn-second small" href={wa} target="_blank" rel="noreferrer">Share on WhatsApp</a>
    </div>
  )
}
