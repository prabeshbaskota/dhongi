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
| Hosting | Vercel |

Everything runs on free tiers.

## Run it locally

```bash
npm install
npm run dev
```

The app connects to the Dhongi Supabase project by default. To use your own, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY` (the publishable key) in a `.env` file. The database schema is in [`supabase/schema.sql`](supabase/schema.sql).

## Roadmap

- [ ] In-game voice chat
- [ ] Host hand-over if the host leaves
- [ ] Optional turn timer
- [ ] More starter word packs

## Licence

MIT © Prabesh Baskota
