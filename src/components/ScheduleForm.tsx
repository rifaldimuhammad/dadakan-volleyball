import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Schedule } from '../lib/types'
export default function ScheduleForm({ initial, onDone, onCancel }: { initial?: Schedule; onDone: () => void; onCancel: () => void }) {
  const [f, setF] = useState({ date: initial?.date ?? '', start_time: initial?.start_time?.slice(0, 5) ?? '20:00', end_time: initial?.end_time?.slice(0, 5) ?? '22:00', location: initial?.location ?? '', status: initial?.status ?? 'active' })
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const set = (k: string, v: string) => setF(s => ({ ...s, [k]: v }))
  async function save() {
    if (!f.date || !f.location.trim()) return setErr('Tanggal dan lokasi wajib diisi.')
    setBusy(true); setErr('')
    const payload = { ...f, location: f.location.trim(), updated_at: new Date().toISOString() }
    const { error } = initial ? await supabase.from('schedules').update(payload).eq('id', initial.id) : await supabase.from('schedules').insert(payload)
    setBusy(false)
    if (error) { console.error(error); return setErr('Terjadi kesalahan. Silakan coba lagi.') }
    onDone()
  }
  const L = ({ t }: { t: string }) => <label className="block text-sm font-semibold mb-1">{t}</label>
  return (
    <div className="space-y-3">
      <div><L t="Tanggal" /><input type="date" className="input" value={f.date} onChange={e => set('date', e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><L t="Waktu mulai" /><input type="time" className="input" value={f.start_time} onChange={e => set('start_time', e.target.value)} /></div>
        <div><L t="Waktu selesai" /><input type="time" className="input" value={f.end_time} onChange={e => set('end_time', e.target.value)} /></div>
      </div>
      <div><L t="Lokasi" /><input className="input" value={f.location} onChange={e => set('location', e.target.value)} /></div>
      <div><L t="Status" /><select className="input" value={f.status} onChange={e => set('status', e.target.value)}><option value="active">Aktif</option><option value="inactive">Tidak Aktif</option></select></div>
      {err && <p className="text-red-600 text-sm">{err}</p>}
      <div className="grid grid-cols-2 gap-3"><button className="btn btn-ghost" onClick={onCancel}>BATAL</button><button className="btn" disabled={busy} onClick={save}>{busy ? 'Memuat...' : 'SIMPAN'}</button></div>
    </div>
  )
}
