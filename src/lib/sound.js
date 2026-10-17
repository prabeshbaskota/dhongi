// Every sound is synthesised in the browser with the Web Audio API,
// so there are no audio files to download and no licences to worry about.
import { loadMuted, saveMuted } from './session.js'

let ctx = null
let muted = loadMuted()

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

// Browsers only allow audio after a tap, so unlock on the first one.
export function unlockAudio() { ac() }

export function isMuted() { return muted }
export function setMuted(m) { muted = m; saveMuted(m) }

function out(c, gain = 0.5) {
  const g = c.createGain()
  g.gain.value = gain
  g.connect(c.destination)
  return g
}

function env(c, g, t, a, d, peak = 1) {
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(peak, t + a)
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d)
}

function noiseBuffer(c, secs) {
  const b = c.createBuffer(1, Math.floor(c.sampleRate * secs), c.sampleRate)
  const d = b.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return b
}

const SOUNDS = {
  frog(c, t) {
    const master = out(c, 0.55)
    for (let k = 0; k < 2; k++) {
      const s = t + k * 0.22
      const o = c.createOscillator(); o.type = 'square'
      o.frequency.setValueAtTime(140, s); o.frequency.linearRampToValueAtTime(95, s + 0.16)
      const lfo = c.createOscillator(); lfo.frequency.value = 38
      const lfoG = c.createGain(); lfoG.gain.value = 0.5
      const amp = c.createGain(); amp.gain.value = 0.5
      lfo.connect(lfoG); lfoG.connect(amp.gain)
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900
      const e = c.createGain()
      o.connect(lp); lp.connect(amp); amp.connect(e); e.connect(master)
      env(c, e, s, 0.01, 0.17)
      o.start(s); lfo.start(s); o.stop(s + 0.2); lfo.stop(s + 0.2)
    }
  },
  horse(c, t) {
    const master = out(c, 0.35)
    const o = c.createOscillator(); o.type = 'sawtooth'
    o.frequency.setValueAtTime(700, t)
    o.frequency.linearRampToValueAtTime(1150, t + 0.15)
    o.frequency.exponentialRampToValueAtTime(380, t + 1.0)
    const vib = c.createOscillator(); vib.frequency.value = 17
    const vibG = c.createGain(); vibG.gain.value = 90
    vib.connect(vibG); vibG.connect(o.frequency)
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 1.2
    const e = c.createGain()
    o.connect(bp); bp.connect(e); e.connect(master)
    env(c, e, t, 0.04, 1.0)
    o.start(t); vib.start(t); o.stop(t + 1.1); vib.stop(t + 1.1)
    // snort
    const n = c.createBufferSource(); n.buffer = noiseBuffer(c, 0.3)
    const nf = c.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 500
    const ne = c.createGain()
    n.connect(nf); nf.connect(ne); ne.connect(master)
    env(c, ne, t + 1.1, 0.02, 0.25, 0.9)
    n.start(t + 1.1)
  },
  duck(c, t) {
    const master = out(c, 0.4)
    for (let k = 0; k < 2; k++) {
      const s = t + k * 0.2
      const o = c.createOscillator(); o.type = 'sawtooth'
      o.frequency.setValueAtTime(620, s); o.frequency.exponentialRampToValueAtTime(380, s + 0.14)
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 4
      const e = c.createGain()
      o.connect(bp); bp.connect(e); e.connect(master)
      env(c, e, s, 0.01, 0.14)
      o.start(s); o.stop(s + 0.17)
    }
  },
  boing(c, t) {
    const master = out(c, 0.45)
    const o = c.createOscillator(); o.type = 'sine'
    o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(520, t + 0.35)
    const vib = c.createOscillator(); vib.frequency.setValueAtTime(22, t)
    const vibG = c.createGain(); vibG.gain.setValueAtTime(60, t); vibG.gain.linearRampToValueAtTime(0, t + 0.6)
    vib.connect(vibG); vibG.connect(o.frequency)
    const e = c.createGain(); o.connect(e); e.connect(master)
    env(c, e, t, 0.01, 0.6)
    o.start(t); vib.start(t); o.stop(t + 0.65); vib.stop(t + 0.65)
  },
  airhorn(c, t) {
    const master = out(c, 0.22)
    ;[466, 470, 698].forEach(f => {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f
      const e = c.createGain(); o.connect(e); e.connect(master)
      ;[0, 0.18, 0.36].forEach((d, i) => {
        const len = i === 2 ? 0.6 : 0.12
        e.gain.setValueAtTime(0.0001, t + d)
        e.gain.exponentialRampToValueAtTime(1, t + d + 0.01)
        e.gain.setValueAtTime(1, t + d + len)
        e.gain.exponentialRampToValueAtTime(0.0001, t + d + len + 0.05)
      })
      o.start(t); o.stop(t + 1.1)
    })
  },
  sadTrombone(c, t) {
    const master = out(c, 0.3)
    const notes = [311, 294, 277, 262]
    notes.forEach((f, i) => {
      const s = t + i * 0.42
      const len = i === 3 ? 1.1 : 0.38
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f
      if (i === 3) {
        const vib = c.createOscillator(); vib.frequency.value = 6
        const vg = c.createGain(); vg.gain.value = 7
        vib.connect(vg); vg.connect(o.frequency); vib.start(s); vib.stop(s + len)
      }
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1300
      const e = c.createGain(); o.connect(lp); lp.connect(e); e.connect(master)
      env(c, e, s, 0.04, len)
      o.start(s); o.stop(s + len + 0.05)
    })
  },
  tada(c, t) {
    const master = out(c, 0.25)
    ;[523, 659, 784, 1047].forEach((f, i) => {
      const s = t + i * 0.08
      const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f
      const e = c.createGain(); o.connect(e); e.connect(master)
      env(c, e, s, 0.01, 0.9)
      o.start(s); o.stop(s + 1)
    })
  },
  drumroll(c, t) {
    const master = out(c, 0.35)
    for (let i = 0; i < 22; i++) {
      const s = t + i * 0.055
      const n = c.createBufferSource(); n.buffer = noiseBuffer(c, 0.05)
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800
      const e = c.createGain(); n.connect(bp); bp.connect(e); e.connect(master)
      env(c, e, s, 0.002, 0.045, 0.3 + i / 30)
      n.start(s)
    }
  },
  pop(c, t) {
    const master = out(c, 0.3)
    const o = c.createOscillator(); o.type = 'sine'
    o.frequency.setValueAtTime(500, t); o.frequency.exponentialRampToValueAtTime(1100, t + 0.06)
    const e = c.createGain(); o.connect(e); e.connect(master)
    env(c, e, t, 0.005, 0.09)
    o.start(t); o.stop(t + 0.12)
  },
  ding(c, t) {
    const master = out(c, 0.3)
    ;[880, 1320].forEach((f, i) => {
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f
      const e = c.createGain(); o.connect(e); e.connect(master)
      env(c, e, t + i * 0.12, 0.005, 0.5)
      o.start(t + i * 0.12); o.stop(t + i * 0.12 + 0.6)
    })
  },
}

export function play(name) {
  if (muted) return
  const c = ac()
  if (!c || !SOUNDS[name]) return
  try { SOUNDS[name](c, c.currentTime + 0.02) } catch { /* ignore audio errors */ }
}

// The reaction soundboard everyone can tap.
export const REACTIONS = [
  { id: 'frog', emoji: '🐸', label: 'Frog croak' },
  { id: 'horse', emoji: '🐴', label: 'Horse neigh' },
  { id: 'duck', emoji: '🦆', label: 'Duck quack' },
  { id: 'boing', emoji: '🤪', label: 'Boing' },
  { id: 'airhorn', emoji: '📯', label: 'Air horn' },
  { id: 'sadTrombone', emoji: '🎺', label: 'Sad trombone' },
]
