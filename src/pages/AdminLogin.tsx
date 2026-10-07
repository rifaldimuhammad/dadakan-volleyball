import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
export default function AdminLogin() {
  const nav = useNavigate()
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('')
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) { console.error(error); return setErr(/fetch|network/i.test(error.message) ? 'Tidak dapat terhubung. Periksa koneksi internet kamu dan coba lagi.' : 'Email atau kata sandi salah.') }
    nav('/v1/admin')
  }
  return (
    <main className="mx-auto max-w-md p-4 pt-12">
      <form onSubmit={submit} className="card space-y-4">
        <h1 className="text-xl font-bold">Masuk sebagai Admin</h1>
        <div><label className="block text-sm font-semibold mb-1">Email</label><input type="email" required className="input" value={email} onChange={e => setEmail(e.target.value)} /></div>
        <div><label className="block text-sm font-semibold mb-1">Kata Sandi</label><input type="password" required className="input" value={password} onChange={e => setPassword(e.target.value)} /></div>
        {err && <p className="text-red-600 text-sm">{err}</p>}
        <button className="btn" disabled={busy}>{busy ? 'Memuat...' : 'MASUK'}</button>
      </form>
    </main>
  )
}
