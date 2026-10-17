import React, { useId, useMemo } from 'react'

// A procedural, shaded character for each player. The same player id always
// draws the same figure, so friends recognise each other across games.
// Pure SVG: no images, no 3D engine, light enough for cheap phones.

function seeded(str) {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)]

const SKIN = ['#F6D3B3', '#EBB98E', '#D9A066', '#C68642', '#A86B3C', '#8D5524', '#6B3E1E']
const SHIRT = ['#E5402F', '#2FB58A', '#3B82F6', '#A855F7', '#F5A524', '#EC4899', '#14B8A6', '#F97316', '#64748B']
const HAIR = ['#1F1308', '#2E1A0E', '#4A2C17', '#6B4423', '#A0522D', '#C9A15B', '#3B3B3B', '#7C3AED']

export function traitsFor(id) {
  const r = seeded(id)
  return {
    skin: pick(r, SKIN),
    shirt: pick(r, SHIRT),
    hairColor: pick(r, HAIR),
    top: pick(r, ['short', 'short', 'long', 'bun', 'curly', 'spiky', 'topi', 'topi', 'cap', 'beanie', 'bald']),
    glasses: r() < 0.25,
    blush: r() < 0.5,
    eyeShape: pick(r, ['round', 'round', 'oval']),
    capColor: pick(r, SHIRT),
  }
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16)
  const c = (v) => Math.max(0, Math.min(255, v + amt))
  const r = c(n >> 16), g = c((n >> 8) & 255), b = c(n & 255)
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}

export default function Figure({ id, size = 56, mood = 'normal', bot = false, title }) {
  const uid = useId().replace(/:/g, '')
  const t = useMemo(() => traitsFor(id), [id])
  const g = (k) => `${uid}-${k}`

  return (
    <svg className={`figure mood-${mood}`} width={size} height={size * 1.1} viewBox="0 0 100 110" role="img"
      aria-label={title || 'player'}>
      <defs>
        <radialGradient id={g('skin')} cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor={shade(bot ? '#CBD5E1' : t.skin, 28)} />
          <stop offset="70%" stopColor={bot ? '#94A3B8' : t.skin} />
          <stop offset="100%" stopColor={shade(bot ? '#94A3B8' : t.skin, -38)} />
        </radialGradient>
        <linearGradient id={g('shirt')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={shade(t.shirt, 40)} />
          <stop offset="100%" stopColor={shade(t.shirt, -45)} />
        </linearGradient>
        <linearGradient id={g('hair')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={shade(t.hairColor, 35)} />
          <stop offset="100%" stopColor={t.hairColor} />
        </linearGradient>
        <linearGradient id={g('cap')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={shade(t.capColor, 35)} />
          <stop offset="100%" stopColor={shade(t.capColor, -30)} />
        </linearGradient>
      </defs>

      <ellipse cx="50" cy="104" rx="30" ry="5" fill="rgba(0,0,0,.28)" />

      {/* long hair sits behind the body */}
      {!bot && t.top === 'long' && <path d="M22 44c0-22 12-32 28-32s28 10 28 32v34H22z" fill={`url(#${g('hair')})`} />}

      {/* body */}
      <path d="M18 104c0-20 14-33 32-33s32 13 32 33z" fill={`url(#${g('shirt')})`} />
      <path d="M40 72l10 10 10-10" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="44" y="60" width="12" height="14" rx="5" fill={shade(bot ? '#94A3B8' : t.skin, -25)} />

      {bot ? (
        <>
          <line x1="50" y1="12" x2="50" y2="4" stroke="#94A3B8" strokeWidth="3" />
          <circle cx="50" cy="4" r="4" fill="#F5A524" className="bot-led" />
          <rect x="24" y="12" width="52" height="50" rx="14" fill={`url(#${g('skin')})`} />
          <rect x="30" y="26" width="40" height="18" rx="9" fill="#1C2557" />
        </>
      ) : (
        <>
          <circle cx="25" cy="42" r="5" fill={shade(t.skin, -15)} />
          <circle cx="75" cy="42" r="5" fill={shade(t.skin, -15)} />
          <circle cx="50" cy="38" r="26" fill={`url(#${g('skin')})`} />
        </>
      )}

      {!bot && <Top t={t} g={g} />}
      <Face mood={mood} t={t} bot={bot} />
      {!bot && t.glasses && mood !== 'sus' && (
        <g fill="none" stroke="#1A1530" strokeWidth="2">
          <circle cx="40" cy="38" r="7" /><circle cx="60" cy="38" r="7" /><path d="M47 38h6" />
        </g>
      )}
      {mood === 'sus' && (
        <g>
          <path d="M29 33h42v6c0 5-4 8-9 8h-3c-4 0-6-3-9-3s-5 3-9 3h-3c-5 0-9-3-9-8z" fill="#111" />
          <path d="M33 36h8" stroke="rgba(255,255,255,.5)" strokeWidth="2" strokeLinecap="round" />
        </g>
      )}
    </svg>
  )
}

function Top({ t, g }) {
  const hair = `url(#${g('hair')})`
  switch (t.top) {
    case 'short':
      return <path d="M24 36c0-16 11-24 26-24s26 8 26 24c-6-7-14-10-26-10s-20 3-26 10z" fill={hair} />
    case 'long':
      return <path d="M24 38c0-17 11-26 26-26s26 9 26 26c-8-9-16-12-26-12s-18 3-26 12z" fill={hair} />
    case 'bun':
      return <g fill={hair}><circle cx="50" cy="10" r="9" /><path d="M24 36c0-16 11-24 26-24s26 8 26 24c-6-7-14-10-26-10s-20 3-26 10z" /></g>
    case 'curly':
      return <g fill={hair}>{[[30, 22], [40, 15], [50, 13], [60, 15], [70, 22], [26, 32], [74, 32]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="8" />)}</g>
    case 'spiky':
      return <path d="M24 34l4-14 6 8 5-14 6 10 5-14 5 14 6-10 5 14 6-8 4 14c-7-6-15-8-26-8s-19 2-26 8z" fill={hair} />
    case 'topi':
      // Dhaka topi: the patterned Nepali cap
      return (
        <g>
          <path d="M26 26l4-14h40l4 14z" fill="#B91C1C" />
          <path d="M28 21h44M30 16h40" stroke="#F5A524" strokeWidth="2" />
          <path d="M34 26l3-12M44 26l1-12M56 26l-1-12M66 26l-3-12" stroke="#2FB58A" strokeWidth="2" />
          <path d="M26 26h48" stroke="#7F1D1D" strokeWidth="2" />
        </g>
      )
    case 'cap':
      return (
        <g>
          <path d="M24 32c0-14 11-22 26-22s26 8 26 22z" fill={`url(#${g('cap')})`} />
          <path d="M50 30c12 0 24 1 34 5-2 3-8 4-14 3-7-1-13-2-20-2z" fill={shade(t.capColor, -40)} />
          <circle cx="50" cy="11" r="2.5" fill={shade(t.capColor, -40)} />
        </g>
      )
    case 'beanie':
      return (
        <g>
          <path d="M24 32c0-15 11-24 26-24s26 9 26 24z" fill={`url(#${g('cap')})`} />
          <rect x="22" y="28" width="56" height="8" rx="4" fill={shade(t.capColor, -30)} />
          <circle cx="50" cy="7" r="5" fill="#FFF4D6" />
        </g>
      )
    default:
      return null
  }
}

function Face({ mood, t, bot }) {
  if (bot) {
    const eye = mood === 'cry' ? '#60A5FA' : mood === 'happy' ? '#2FB58A' : '#F5A524'
    return (
      <g>
        {mood === 'happy'
          ? <><path d="M36 37q4-5 8 0M56 37q4-5 8 0" stroke={eye} strokeWidth="3" fill="none" strokeLinecap="round" /></>
          : <><rect x="36" y="31" width="8" height="8" rx="2" fill={eye} /><rect x="56" y="31" width="8" height="8" rx="2" fill={eye} /></>}
        <path d={mood === 'cry' ? 'M40 54q10-6 20 0' : 'M40 52q10 6 20 0'} stroke="#334155" strokeWidth="3" fill="none" strokeLinecap="round" />
        {mood === 'cry' && <Tears />}
      </g>
    )
  }
  const ink = '#1A1530'
  return (
    <g>
      {t.blush && mood !== 'cry' && <><ellipse cx="34" cy="48" rx="5" ry="3" fill="#F87171" opacity=".35" /><ellipse cx="66" cy="48" rx="5" ry="3" fill="#F87171" opacity=".35" /></>}
      {mood === 'happy' && (
        <>
          <path d="M35 39q5-6 10 0M55 39q5-6 10 0" stroke={ink} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M39 49q11 13 22 0z" fill="#7F1D1D" />
          <path d="M42 51q8 4 16 0" stroke="#fff" strokeWidth="2" fill="none" />
        </>
      )}
      {mood === 'cry' && (
        <>
          <path d="M35 38q5 4 10 0M55 38q5 4 10 0" stroke={ink} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M33 31l10 3M67 31l-10 3" stroke={ink} strokeWidth="2.5" strokeLinecap="round" />
          <ellipse cx="50" cy="55" rx="7" ry="5" fill="#7F1D1D" />
          <Tears />
        </>
      )}
      {mood === 'sus' && <path d="M42 53q8 3 14-2" stroke={ink} strokeWidth="3" fill="none" strokeLinecap="round" />}
      {(mood === 'normal' || mood === 'think') && (
        <>
          {t.eyeShape === 'oval'
            ? <><ellipse cx="40" cy="38" rx="3" ry="4.5" fill={ink} /><ellipse cx="60" cy="38" rx="3" ry="4.5" fill={ink} /></>
            : <><circle cx="40" cy="38" r="4" fill={ink} /><circle cx="60" cy="38" r="4" fill={ink} /></>}
          <circle cx="41.5" cy="36.5" r="1.4" fill="#fff" /><circle cx="61.5" cy="36.5" r="1.4" fill="#fff" />
          {mood === 'think'
            ? <path d="M43 52h12" stroke={ink} strokeWidth="3" strokeLinecap="round" />
            : <path d="M41 50q9 7 18 0" stroke={ink} strokeWidth="3" fill="none" strokeLinecap="round" />}
        </>
      )}
    </g>
  )
}

function Tears() {
  return (
    <g className="tears" fill="#60A5FA">
      <path d="M36 42q-2 6 0 9q2-3 0-9z" />
      <path d="M64 42q-2 6 0 9q2-3 0-9z" />
    </g>
  )
}
