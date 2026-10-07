import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AdminLoginV2() {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) {
      console.error(error)
      return setErr(/fetch|network/i.test(error.message)
        ? 'Tidak dapat terhubung. Periksa koneksi internet kamu dan coba lagi.'
        : 'Email atau kata sandi salah.')
    }
    nav('/admin')
  }

  return (
    <div className="v2-root grid min-h-screen place-items-center bg-gradient-to-br from-court-600 via-court-600 to-indigo-700 px-5">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-6 text-center text-white">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-white/15 text-2xl backdrop-blur">🏐</div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Admin Panel</h1>
          <p className="mt-1 text-sm text-white/75">Masuk untuk mengelola jadwal & pemain</p>
        </div>

        <form onSubmit={submit} className="v2-card space-y-4 p-6">
          <div>
            <label className="v2-label">Email</label>
            <input type="email" required className="v2-input" placeholder="admin@contoh.com"
              value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="v2-label">Kata Sandi</label>
            <input type="password" required className="v2-input" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          {err && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">{err}</p>}
          <button className="v2-btn" disabled={busy}>{busy ? 'Memuat…' : 'Masuk'}</button>
        </form>
      </div>
    </div>
  )
}
