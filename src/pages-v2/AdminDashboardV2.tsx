import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Schedule } from '../lib/types'
import { fmtDate, fmtTime, scheduleSlug, capacityOf } from '../lib/utils'
import ScheduleFormV2 from '../components-v2/ScheduleFormV2'
import Sheet from '../components-v2/Sheet'

export default function AdminDashboardV2() {
  const nav = useNavigate()
  const [list, setList] = useState<Schedule[] | null>(null)
  const [counts, setCounts] = useState<Record<string, { active: number; waiting: number }>>({})
  const [form, setForm] = useState<Schedule | 'new' | null>(null)
  const [del, setDel] = useState<Schedule | null>(null)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const [s, p] = await Promise.all([
      supabase.from('schedules').select('*').order('date', { ascending: false }),
      supabase.from('players').select('schedule_id, roster'),
    ])
    if (s.error || p.error) { console.error(s.error ?? p.error); return setErr('Terjadi kesalahan. Silakan coba lagi.') }
    const c: Record<string, { active: number; waiting: number }> = {}
    p.data.forEach((r: { schedule_id: string; roster?: string }) => {
      const e = c[r.schedule_id] ?? (c[r.schedule_id] = { active: 0, waiting: 0 })
      if (r.roster === 'waiting') e.waiting++
      else e.active++
    })
    setCounts(c); setList(s.data as Schedule[])
  }, [])

  useEffect(() => { load() }, [load])
  const done = () => { setForm(null); load() }
  async function remove() {
    const { error } = await supabase.from('schedules').delete().eq('id', del!.id)
    if (error) console.error(error)
    setDel(null); load()
  }
  async function logout() { await supabase.auth.signOut(); nav('/admin/login') }

  return (
    <div className="v2-root min-h-screen bg-canvas pb-24">
      {/* top bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-court-600 text-white">🏐</span>
            <h1 className="text-[15px] font-extrabold tracking-tight text-ink">Dashboard Admin</h1>
          </div>
          <div className="flex items-center gap-1.5">
            <Link to="/admin/galeri" className="rounded-xl px-3 py-1.5 text-[13px] font-semibold text-court-700 transition hover:bg-court-50">
              🖼️ Galeri
            </Link>
            <button onClick={logout} className="rounded-xl px-3 py-1.5 text-[13px] font-semibold text-ink-muted transition hover:bg-slate-100">
              Keluar
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-4 px-4 pt-5">
        {err && <div className="v2-card p-4 text-center text-rose-600">{err}</div>}

        {!list && !err && (
          <div className="space-y-4">{[0, 1].map(i => <div key={i} className="v2-skeleton h-40" />)}</div>
        )}

        {list?.length === 0 && (
          <div className="v2-card flex flex-col items-center gap-2 p-10 text-center">
            <span className="text-4xl">🗓️</span>
            <p className="font-bold text-ink">Belum ada jadwal</p>
            <p className="text-sm text-ink-muted">Tambahkan jadwal pertamamu lewat tombol di bawah.</p>
          </div>
        )}

        {list?.map((s, i) => {
          const cnt = counts[s.id] ?? { active: 0, waiting: 0 }
          const cap = 4 * capacityOf(s).maxTeam
          const active = s.status === 'active'
          return (
            <div key={s.id} style={{ animationDelay: `${i * 50}ms` }} className="v2-card animate-fade-up overflow-hidden p-0">
              <div className="flex items-start justify-between gap-3 p-4">
                <div className="space-y-0.5">
                  <p className="text-[15px] font-extrabold tracking-tight text-ink">{fmtDate(s.date)}</p>
                  <p className="text-sm text-ink-soft">🕒 {fmtTime(s.start_time, s.end_time)}</p>
                  <p className="text-sm text-ink-muted">📍 {s.location}</p>
                </div>
                <span className={`v2-chip ${active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-ink-muted'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                  {active ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-2.5">
                <span className="text-sm font-semibold text-ink">👥 {cnt.active}/{cap}</span>
                <span className="text-xs text-ink-muted">pemain (inti + cadangan)</span>
                {cnt.waiting > 0 && (
                  <span className="v2-chip bg-slate-100 text-ink-muted">⏳ {cnt.waiting} waiting</span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 border-t border-slate-100 p-3">
                <Link to={`/admin/jadwal/${scheduleSlug(s, list!)}`} className="v2-btn v2-btn-sm">Lihat</Link>
                <button className="v2-btn v2-btn-ghost v2-btn-sm" onClick={() => setForm(s)}>Edit</button>
                <button className="v2-btn v2-btn-ghost v2-btn-sm !text-rose-500 hover:!bg-rose-50" onClick={() => setDel(s)}>Hapus</button>
              </div>
            </div>
          )
        })}
      </main>

      {/* floating add button */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/70 bg-white/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-md">
          <button className="v2-btn" onClick={() => setForm('new')}>+ Tambah Jadwal</button>
        </div>
      </div>

      {form && (
        <Sheet title={form === 'new' ? 'Tambah Jadwal' : 'Edit Jadwal'} onClose={() => setForm(null)}>
          <ScheduleFormV2 initial={form === 'new' ? undefined : form} onDone={done} onCancel={() => setForm(null)} />
        </Sheet>
      )}
      {del && (
        <Sheet title="Hapus jadwal?" onClose={() => setDel(null)}>
          <p className="text-ink-soft">
            Semua data pemain pada jadwal ini juga akan dihapus dan <b className="text-ink">tidak dapat dibatalkan</b>.
            Untuk menyembunyikan saja, ubah status menjadi Nonaktif lewat Edit.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button className="v2-btn v2-btn-ghost" onClick={() => setDel(null)}>Batal</button>
            <button className="v2-btn v2-btn-danger" onClick={remove}>Hapus</button>
          </div>
        </Sheet>
      )}
    </div>
  )
}
