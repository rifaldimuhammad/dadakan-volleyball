import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Schedule } from '../lib/types'

export default function ScheduleFormV2({
  initial, onDone, onCancel,
}: { initial?: Schedule; onDone: () => void; onCancel: () => void }) {
  const [f, setF] = useState({
    date: initial?.date ?? '',
    start_time: initial?.start_time?.slice(0, 5) ?? '20:00',
    end_time: initial?.end_time?.slice(0, 5) ?? '22:00',
    location: initial?.location ?? '',
    maps_url: initial?.maps_url ?? '',
    status: initial?.status ?? 'active',
    core_size: String(initial?.core_size ?? 6),
    max_per_team: String(initial?.max_per_team ?? 9),
    max_waiting: String(initial?.max_waiting ?? 5),
  })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k: string, v: string) => setF(s => ({ ...s, [k]: v }))

  async function save() {
    if (!f.date || !f.location.trim()) return setErr('Tanggal dan lokasi wajib diisi.')
    const core = parseInt(f.core_size, 10)
    const maxTeam = parseInt(f.max_per_team, 10)
    const maxWait = parseInt(f.max_waiting, 10)
    if (!Number.isFinite(core) || core < 1) return setErr('Jumlah pemain inti minimal 1.')
    if (!Number.isFinite(maxTeam) || maxTeam < core) return setErr('Maks pemain per tim tidak boleh kurang dari jumlah inti.')
    if (!Number.isFinite(maxWait) || maxWait < 0) return setErr('Maks waiting list tidak boleh negatif.')
    setBusy(true); setErr('')
    const payload = {
      date: f.date, start_time: f.start_time, end_time: f.end_time, status: f.status,
      location: f.location.trim(), maps_url: f.maps_url.trim() || null,
      core_size: core, max_per_team: maxTeam, max_waiting: maxWait,
      updated_at: new Date().toISOString(),
    }
    const { error } = initial
      ? await supabase.from('schedules').update(payload).eq('id', initial.id)
      : await supabase.from('schedules').insert(payload)
    setBusy(false)
    if (error) { console.error(error); return setErr('Terjadi kesalahan. Silakan coba lagi.') }
    onDone()
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="v2-label">Tanggal</label>
        <input type="date" className="v2-input" value={f.date} onChange={e => set('date', e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="v2-label">Mulai</label>
          <input type="time" className="v2-input" value={f.start_time} onChange={e => set('start_time', e.target.value)} />
        </div>
        <div>
          <label className="v2-label">Selesai</label>
          <input type="time" className="v2-input" value={f.end_time} onChange={e => set('end_time', e.target.value)} />
        </div>
      </div>
      <div>
        <label className="v2-label">Lokasi</label>
        <input className="v2-input" placeholder="mis. Unggul Sport Center" value={f.location} onChange={e => set('location', e.target.value)} />
      </div>
      <div>
        <label className="v2-label">Link Google Maps <span className="font-normal text-ink-muted">(opsional)</span></label>
        <input className="v2-input" placeholder="https://maps.google.com/?q=..." value={f.maps_url} onChange={e => set('maps_url', e.target.value)} />
      </div>

      {/* kapasitas per tim */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
        <p className="mb-2 text-[13px] font-bold text-ink">Kapasitas per Tim</p>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="v2-label">Inti</label>
            <input type="number" min={1} max={20} className="v2-input" value={f.core_size} onChange={e => set('core_size', e.target.value)} />
          </div>
          <div>
            <label className="v2-label">Maks Tim</label>
            <input type="number" min={1} max={30} className="v2-input" value={f.max_per_team} onChange={e => set('max_per_team', e.target.value)} />
          </div>
          <div>
            <label className="v2-label">Waiting</label>
            <input type="number" min={0} max={20} className="v2-input" value={f.max_waiting} onChange={e => set('max_waiting', e.target.value)} />
          </div>
        </div>
        <p className="mt-2 text-[11px] text-ink-muted">
          Inti = pemain utama · Maks Tim = total termasuk cadangan (mis. 6 inti + maks 9 = 3 cadangan) · Waiting = antrean per tim.
        </p>
      </div>

      <div>
        <label className="v2-label">Status</label>
        <div className="grid grid-cols-2 gap-2">
          {(['active', 'inactive'] as const).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => set('status', s)}
              className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition
                ${f.status === s
                  ? 'border-court-500 bg-court-50 text-court-700 ring-2 ring-court-500/20'
                  : 'border-slate-200 bg-white text-ink-muted hover:bg-slate-50'}`}
            >
              {s === 'active' ? 'Aktif' : 'Tidak Aktif'}
            </button>
          ))}
        </div>
      </div>
      {err && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">{err}</p>}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <button className="v2-btn v2-btn-ghost" onClick={onCancel}>Batal</button>
        <button className="v2-btn" disabled={busy} onClick={save}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
      </div>
    </div>
  )
}
