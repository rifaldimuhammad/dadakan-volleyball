import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Schedule } from '../lib/types'
import { fmtDate, fmtTime } from '../lib/utils'
export default function Home() {
  const [list, setList] = useState<Schedule[] | null>(null); const [err, setErr] = useState('')
  useEffect(() => {
    supabase.from('schedules').select('*').eq('status', 'active').gte('date', new Date().toISOString().slice(0, 10)).order('date').order('start_time')
      .then(({ data, error }) => { if (error) { console.error(error); setErr('Terjadi kesalahan. Silakan coba lagi.') } else setList(data as Schedule[]) })
  }, [])
  return (
    <main className="mx-auto max-w-md p-4 space-y-4">
      <header className="text-center py-4"><h1 className="text-2xl font-extrabold">🏐 DADAKAN VOLLEYBALL CALLING</h1><p className="text-slate-500 mt-1">Pilih jadwal dan masuk ke tim favoritmu.</p></header>
      {err && <p className="text-center text-red-600">{err}</p>}
      {!list && !err && <p className="text-center text-slate-500">Memuat...</p>}
      {list?.length === 0 && <p className="text-center text-slate-500">Belum ada jadwal yang tersedia.</p>}
      {list?.map(s => (
        <div key={s.id} className="card space-y-1">
          <p className="font-bold">📅 {fmtDate(s.date)}</p><p>{fmtTime(s.start_time, s.end_time)}</p><p className="text-slate-600 pb-2">📍 {s.location}</p>
          <Link to={`/v1/jadwal/${s.id}`} className="btn">LIHAT JADWAL</Link>
        </div>
      ))}
    </main>
  )
}
