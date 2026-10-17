// Remembers which seat you hold in each room so a refresh drops you back in.
const KEY = 'dhongi:sessions'
const NAME_KEY = 'dhongi:name'
const MUTE_KEY = 'dhongi:muted'

function readAll() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} }
}
function writeAll(all) {
  try { localStorage.setItem(KEY, JSON.stringify(all)) } catch { /* private mode: in-memory only */ }
}

const memory = {}

export function loadSession(code) {
  if (!code) return null
  const c = code.toUpperCase()
  return readAll()[c] || memory[c] || null
}

export function saveSession(s) {
  const c = s.code.toUpperCase()
  memory[c] = s
  const all = readAll()
  all[c] = s
  writeAll(all)
}

export function clearSession(code) {
  const c = code.toUpperCase()
  delete memory[c]
  const all = readAll()
  delete all[c]
  writeAll(all)
}

export function lastName() {
  try { return localStorage.getItem(NAME_KEY) || '' } catch { return '' }
}
export function rememberName(n) {
  try { localStorage.setItem(NAME_KEY, n) } catch { /* ignore */ }
}

export function loadMuted() {
  try { return localStorage.getItem(MUTE_KEY) === '1' } catch { return false }
}
export function saveMuted(m) {
  try { localStorage.setItem(MUTE_KEY, m ? '1' : '0') } catch { /* ignore */ }
}
