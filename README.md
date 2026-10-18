# ढोंगी Dhongi

**A free party game for friends. Everyone gets the secret word except the Dhongi. Give clues, vote, and catch them.**

*Dhongi* (ढोंगी) means "impostor" or "pretender" in Nepali.

![Dhongi preview](public/og.png)

## How to play

1. The host starts a room and shares the link or 5-letter code. Friends join with just a name. No app, no sign-up.
2. The host fills **the jar** with words (their own, or a starter pack). One word is pulled out at random each game.
3. Everyone sees the word, except the Dhongi, who only sees **"You are the Dhongi"**.
4. Players take turns typing one clue related to the word, for 1–7 rounds (3 by default). Too obvious and the Dhongi learns the word. Too vague and you look suspicious.
5. After the last round, everyone votes. Catch the Dhongi and the innocents win. A tie, or the wrong person, and the Dhongi escapes, and the losers get crying emojis raining down their screen until the next game.

## Features

- Join by link or room code, from any phone browser
- 3 to 40 people per room, with 1 or 2 Dhongis (2 kicks in at 7+ players)
- Spectator mode, plus an optional **director view** where watchers see who the Dhongi is
- Live text chat (watchers have their own channel, so they can't leak the answer)
- Soundboard everyone hears: frog, horse, duck, boing, air horn, sad trombone
- Host controls: skip a slow player, end voting early, remove a player
- Built-in check that stops innocent players typing the secret word by accident

### AI features (optional, free tier)

- **AI host roast:** after every reveal, an AI host roasts the funniest clue or the worst detective work
- **AI word packs:** type a theme ("Bollywood", "Darwin", "Nepali food") and get 20 words for the jar
- **AI players:** for small groups, up to 2 bots fill in until 3 people are in. They give clues, bluff as the Dhongi, and vote

AI runs in a Supabase Edge Function using Groq's free plan, so the API key never reaches the browser. Only player names and clues are sent to the AI, never chat. Each room has a daily cap so nobody can drain the free quota, and if AI is off or unavailable the game still works without it.

## Who can play

- **Host codes:** only people with a host code can start a room. The owner hands codes out and can switch any code off from the owner page (`?admin`).
- **Knock to join:** anyone who opens a shared link waits on a "Knock knock…" screen until the host taps *Let in*. A forwarded link is useless without the host's approval.
- **Room lock:** the host can lock the room so nobody new can even knock.

## Fair play by design

Each phone only ever receives its own word. Roles, words and votes live in private database tables that the browser cannot read. Every game action goes through a database function that checks the player's secret token first, so opening browser dev tools won't reveal the Dhongi.

## Tech stack

| Part | Tool |
| --- | --- |
| Frontend | React 18 + Vite |
| Realtime game state | Supabase Postgres + Realtime (row changes) |
| Chat, reactions, presence | Supabase Realtime broadcast + presence |
| Game rules and anti-cheat | Postgres `SECURITY DEFINER` functions with row-level security |
| Sounds | Synthesised in the browser with the Web Audio API, so there are no audio files |
| AI | Supabase Edge Function (Deno) calling Groq's OpenAI-compatible API |
| Hosting | Vercel |

Everything runs on free tiers.

## Run it locally

```bash
npm install
npm run dev
```

The app connects to the Dhongi Supabase project by default. To use your own, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY` (the publishable key) in a `.env` file. The database schema is in [`supabase/schema.sql`](supabase/schema.sql), with the AI additions in [`supabase/ai.sql`](supabase/ai.sql) and access control in [`supabase/access.sql`](supabase/access.sql).

To turn on AI, deploy [`supabase/functions/ai`](supabase/functions/ai/index.ts) and add a `GROQ_API_KEY` secret to your Supabase project's Edge Function secrets.

## Roadmap

- [ ] In-game voice chat
- [ ] Host hand-over if the host leaves
- [ ] Optional turn timer
- [ ] More starter word packs

## Licence

MIT © Prabesh Baskota
