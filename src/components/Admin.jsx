import React, { useEffect, useState } from 'react'
import { rpc } from '../lib/supabase.js'

// Owner page: hand out host codes and switch them off. Open with ?admin
// The admin code is kept only for this browser tab.
const KEY = 'dhongi:admin'

function fmt(ts) {
  if (!ts) return 'never'
  const d = new Date(ts)
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ' ' +
    d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export default function Admin() {
  const [admin, setAdmin] = useState(() => { try { return sessionStorage.getItem(KEY) || '' } catch { return '' } })
  const [entry, setEntry] = useState('')
  const [codes, setCodes] = useState(null)
  const [label, setLabel] = useState('')
  const [makeAdmin, setMakeAdmin] = useState(false)
  const [fresh, setFresh] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async (a = admin) => {
    setErr('')
    try { setCodes(await rpc('admin_list_codes', { p_admin: a })); return true }
    catch (e) { setErr(e.message); setCodes(null); return false }
  }

  useEffect(() => { if (admin) load(admin) }, []) // eslint-disable-line

  const signIn = async (e) => {
    e.preventDefault()
    const a = entry.trim()
    if (!a) return
    if (await load(a)) {
      setAdmin(a)
      try { sessionStorage.setItem(KEY, a) } catch { /* ignore */ }
      setEntry('')
    }
  }
  const signOut = () => {
    try { sessionStorage.removeItem(KEY) } catch { /* ignore */ }
    setAdmin(''); setCodes(null); setFresh(null)
  }

  const create = async (e) => {
    e.preventDefault()
    if (!label.trim()) { setErr('Give it a name, like who it’s for.'); return }
    setBusy(true); setErr('')
    try {
      const c = await rpc('admin_create_code', { p_admin: admin, p_label: label, p_is_admin: makeAdmin })
      setFresh({ code: c, label: label.trim(), isAdmin: makeAdmin })
      setLabel(''); setMakeAdmin(false)
      await load()
    } catch (e2) { setErr(e2.message) }
    setBusy(false)
  }

  const toggle = async (c) => {
    setErr('')
    try { await rpc('admin_set_active', { p_admin: admin, p_code: c.code, p_active: !c.active }); await load() }
    catch (e) { setErr(e.message) }
  }

  const shareText = (c) => `You can host Dhongi rooms now! Go to ${location.origin}${location.pathname}, tap "Start a room" and use host code: ${c}`

  if (!codes) {
    return (
      <main className="home">
        <header className="brand">
          <h1 className="logo"><span lang="ne">ढोंगी</span><span className="logo-latin">Owner page</span></h1>
          <p className="tagline">Hand out host codes and switch them off.</p>
        </header>
        <form className="panel" onSubmit={signIn}>
          <label className="field">
            <span>Admin code</span>
            <input value={entry} onChange={e => setEntry(e.target.value)} autoComplete="off" autoCapitalize="characters" />
          </label>
          <button className="btn btn-main">Open</button>
          {err && <p className="err" role="alert">{err}</p>}
        </form>
        <a className="btn btn-quiet" href={location.pathname}>Back to the game</a>
      </main>
    )
  }

  const hosts = codes.filter(c => !c.is_admin)
  const admins = codes.filter(c => c.is_admin)

  return (
    <main className="home admin">
      <header className="brand">
        <h1 className="logo"><span lang="ne">ढोंगी</span><span className="logo-latin">Owner page</span></h1>
      </header>

      <form className="panel" onSubmit={create}>
        <h2>New host code</h2>
        <label className="field">
          <span>Who is it for?</span>
          <input value={label} maxLength={40} placeholder="e.g. Asha" onChange={e => setLabel(e.target.value)} />
        </label>
        <label className="check">
          <input type="checkbox" checked={makeAdmin} onChange={e => setMakeAdmin(e.target.checked)} />
          <span>Admin code (can open this page and make more codes)</span>
        </label>
        <button className="btn btn-main" disabled={busy}>{busy ? 'Making…' : 'Make code'}</button>
        {fresh && (
          <div className="fresh">
            <p>{fresh.isAdmin ? 'Admin' : 'Host'} code for <strong>{fresh.label}</strong></p>
            <p className="fresh-code">{fresh.code}</p>
            {!fresh.isAdmin && (
              <a className="btn btn-second small" target="_blank" rel="noreferrer"
                href={`https://wa.me/?text=${encodeURIComponent(shareText(fresh.code))}`}>Send on WhatsApp</a>
            )}
          </div>
        )}
        {err && <p className="err" role="alert">{err}</p>}
      </form>

      <section className="block">
        <h2>Host codes <span className="count">{hosts.filter(c => c.active).length} on</span></h2>
        {hosts.length === 0 && <p className="note">No host codes yet. Make one above.</p>}
        <ul className="codes">
          {hosts.map(c => <CodeRow key={c.code} c={c} onToggle={toggle} />)}
        </ul>
      </section>

      <section className="block">
        <h2>Admin codes</h2>
        <p className="note">Admin codes can also start rooms. Keep them to yourself.</p>
        <ul className="codes">
          {admins.map(c => <CodeRow key={c.code} c={c} onToggle={toggle} current={c.code === admin.toUpperCase().replace(/[^A-Z0-9]/g, '')} />)}
        </ul>
      </section>

      <button className="btn btn-quiet" onClick={signOut}>Close owner page</button>
      <a className="btn btn-quiet" href={location.pathname}>Back to the game</a>
    </main>
  )
}

function CodeRow({ c, onToggle, current }) {
  return (
    <li className={c.active ? '' : 'off'}>
      <div className="code-main">
        <strong>{c.label || 'No name'}</strong>{current && <em> (this one)</em>}
        <span className="code-text">{c.code}</span>
        <span className="note small-note">Used {c.uses} time{c.uses === 1 ? '' : 's'} · last {fmt(c.last_used_at)}</span>
      </div>
      <button className={`btn small ${c.active ? 'btn-second' : 'btn-main'}`} onClick={() => onToggle(c)} disabled={current}>
        {c.active ? 'Switch off' : 'Switch on'}
      </button>
    </li>
  )
}
