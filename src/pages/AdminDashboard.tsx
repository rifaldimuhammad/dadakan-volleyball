import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Schedule } from '../lib/types'
import { fmtDate, fmtTime } from '../lib/utils'
import ScheduleForm from '../components/ScheduleForm'
import Modal from '../components/Modal'
export default function AdminDashboard() {
  const nav = useNavigate()
  const [list, setList] = useState<Schedule[] | null>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [form, setForm] = useState<Schedule | 'new' | null>(null)
  const [del, setDel] = useState<Schedule | null>(null)
  const [err, setErr] = useState('')
  const load = useCallback(async () => {
    const [s, p] = await Promise.all([supabase.from('schedules').select('*').order('date', { ascending: false }), supabase.from('players').select('schedule_id')])
    if (s.error || p.error) { console.error(s.error ?? p.error); return setErr('Terjadi kesalahan. Silakan coba lagi.') }
    const c: Record<string, number> = {}; p.data.forEach(r => { c[r.schedule_id] = (c[r.schedule_id] ?? 0) + 1 })
    setCounts(c); setList(s.data as Schedule[])
  }, [])
  useEffect(() => { load() }, [load])
  const done = () => { setForm(null); load() }
  async function remove() {
    const { error } = await supabase.from('schedules').delete().eq('id', del!.id)
    if (error) console.error(error)
    setDel(null); load()
  }
  async function logout() { await supabase.auth.signOut(); nav('/v1/admin/login') }
  return (
    <main className="mx-auto max-w-md p-4 space-y-4 pb-10">
      <div className="flex items-center justify-between"><h1 className="text-xl font-extrabold">Dashboard Admin</h1><button onClick={logout} className="text-sm font-semibold underline">Keluar</button></div>
      <button className="btn" onClick={() => setForm('new')}>+ TAMBAH JADWAL</button>
      {err && <p className="text-red-600">{err}</p>}
      {!list && !err && <p className="text-center text-slate-500">Memuat...</p>}
      {list?.length === 0 && <p className="text-center text-slate-500">Belum ada jadwal.</p>}
      {list?.map(s => (
        <div key={s.id} className="card space-y-1">
          <p className="font-bold">{fmtDate(s.date)}</p><p>{fmtTime(s.start_time, s.end_time)}</p><p>{s.location}</p>
          <p>{counts[s.id] ?? 0}/24 pemain</p>
          <p className="text-sm">Status: <b className={s.status === 'active' ? 'text-green-600' : 'text-slate-500'}>{s.status === 'active' ? 'Aktif' : 'Tidak Aktif'}</b></p>
          <div className="grid grid-cols-3 gap-2 pt-2">
            <Link to={`/v1/admin/jadwal/${s.id}`} className="btn !py-2.5">LIHAT</Link>
            <button className="btn btn-ghost !py-2.5" onClick={() => setForm(s)}>EDIT</button>
            <button className="btn btn-ghost !py-2.5 !text-red-600" onClick={() => setDel(s)}>HAPUS</button>
          </div>
        </div>
      ))}
      {form && <Modal title={form === 'new' ? 'Tambah Jadwal' : 'Edit Jadwal'} onClose={() => setForm(null)}><ScheduleForm initial={form === 'new' ? undefined : form} onDone={done} onCancel={() => setForm(null)} /></Modal>}
      {del && <Modal title="Hapus jadwal?" onClose={() => setDel(null)}>
        <p>Semua data pemain pada jadwal ini juga akan dihapus. Tindakan ini tidak dapat dibatalkan. Untuk menyembunyikan saja, ubah status menjadi Tidak Aktif lewat EDIT.</p>
        <div className="grid grid-cols-2 gap-3"><button className="btn btn-ghost" onClick={() => setDel(null)}>BATAL</button><button className="btn !bg-red-600" onClick={remove}>HAPUS</button></div></Modal>}
    </main>
  )
}
