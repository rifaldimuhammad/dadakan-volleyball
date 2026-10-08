import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { GalleryItem, Schedule } from '../lib/types'
import { fmtDate, fmtTime, scheduleSlug, capacityOf } from '../lib/utils'
import { CLUB_INFO } from '../components-v2/info'

const TEAMS = 4 // merah, biru, kuning, hijau

export default function HomeV2() {
  const [list, setList] = useState<Schedule[] | null>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [gallery, setGallery] = useState<GalleryItem[]>([])
  const [err, setErr] = useState('')
  const [qrisOpen, setQrisOpen] = useState(false)

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    Promise.all([
      supabase.from('schedules').select('*').eq('status', 'active').gte('date', today).order('date').order('start_time'),
      supabase.from('players').select('schedule_id, roster'),
      supabase.from('gallery').select('*').order('sort_order').order('created_at'),
    ]).then(([s, p, g]) => {
      if (s.error) { console.error(s.error); return setErr('Terjadi kesalahan. Silakan coba lagi.') }
      setList(s.data as Schedule[])
      if (!p.error && p.data) {
        const c: Record<string, number> = {}
        // Hitung hanya pemain aktif (core + reserve), waiting list tidak dihitung ke kapasitas.
        p.data.forEach((r: { schedule_id: string; roster?: string }) => {
          if (r.roster === 'waiting') return
          c[r.schedule_id] = (c[r.schedule_id] ?? 0) + 1
        })
        setCounts(c)
      }
      if (!g.error && g.data) setGallery(g.data as GalleryItem[])
    })
  }, [])

  return (
    <div className="v2-root min-h-screen bg-canvas">
      {/* hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-court-600 via-court-600 to-indigo-700 px-5 pb-16 pt-12 text-white">
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 h-56 w-56 rounded-full bg-sun-400/20 blur-3xl" />
        <div className="relative mx-auto max-w-md">
          <div className="flex items-center justify-between">
            <span className="v2-chip bg-white/15 text-white backdrop-blur">🏐 Open Session</span>
            <a
              href={CLUB_INFO.instagram} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[12px] font-semibold backdrop-blur transition hover:bg-white/25"
            >
              <span>📸</span> Instagram
            </a>
          </div>
          <h1 className="mt-3 font-display text-[32px] font-extrabold leading-[1.05] tracking-tight">
            Dadakan<br />Volleyball
          </h1>
          <p className="mt-2 max-w-[18rem] text-[15px] text-white/80">
            Pilih jadwal main, masuk ke timmu, dan amankan slot sebelum penuh.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-white/15 px-3.5 py-2 text-sm font-semibold backdrop-blur">
            <span>💰</span> HTM Slot <b>{CLUB_INFO.htm}</b>
          </div>
        </div>
      </div>

      {/* content */}
      <main className="relative z-10 mx-auto -mt-8 max-w-md space-y-4 px-4 pb-16">
        {err && <div className="v2-card p-4 text-center text-rose-600">{err}</div>}

        {!list && !err && (
          <div className="space-y-4">{[0, 1].map(i => <div key={i} className="v2-skeleton h-32" />)}</div>
        )}

        {list?.length === 0 && (
          <div className="v2-card animate-fade-up flex flex-col items-center gap-2 p-10 text-center">
            <span className="text-4xl">📭</span>
            <p className="font-bold text-ink">Belum ada jadwal</p>
            <p className="text-sm text-ink-muted">Jadwal baru akan muncul di sini. Cek lagi nanti ya.</p>
          </div>
        )}

        {list?.map((s, i) => {
          const n = counts[s.id] ?? 0
          const cap = TEAMS * capacityOf(s).maxTeam
          const full = n >= cap
          const pct = Math.min(100, Math.round((n / cap) * 100))
          return (
            <Link
              key={s.id}
              to={`/jadwal/${scheduleSlug(s, list)}`}
              style={{ animationDelay: `${i * 60}ms` }}
              className="v2-card group block animate-fade-up overflow-hidden p-0 transition hover:shadow-lift active:scale-[.99]"
            >
              <div className="flex items-stretch">
                {/* date rail */}
                <div className={`flex w-20 shrink-0 flex-col items-center justify-center py-5 ${full ? 'bg-slate-100 text-slate-500' : 'bg-court-50 text-court-700'}`}>
                  <span className="text-[11px] font-bold uppercase tracking-wide">
                    {new Date(s.date + 'T00:00:00').toLocaleDateString('id-ID', { month: 'short' })}
                  </span>
                  <span className="text-3xl font-extrabold leading-none">
                    {new Date(s.date + 'T00:00:00').getDate()}
                  </span>
                  <span className="text-[11px] opacity-70">
                    {new Date(s.date + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short' })}
                  </span>
                </div>
                {/* body */}
                <div className="flex flex-1 flex-col justify-center gap-1 px-4 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[15px] font-extrabold tracking-tight text-ink">{fmtDate(s.date)}</p>
                    {full
                      ? <span className="v2-chip shrink-0 bg-rose-50 text-rose-600">Penuh</span>
                      : <span className="v2-chip shrink-0 bg-emerald-50 text-emerald-600">Slot ada</span>}
                  </div>
                  <p className="flex items-center gap-1.5 text-sm text-ink-soft"><span>🕒</span> {fmtTime(s.start_time, s.end_time)}</p>
                  <p className="flex items-center gap-1.5 text-sm text-ink-muted"><span>📍</span> <span className="truncate">{s.location}</span></p>

                  {/* mini progress */}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full transition-all duration-500 ${full ? 'bg-rose-400' : 'bg-court-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className={`text-[12px] font-bold ${full ? 'text-rose-600' : 'text-ink-soft'}`}>{n}/{cap}</span>
                  </div>

                  <span className="mt-1.5 inline-flex items-center gap-1 text-[13px] font-bold text-court-600">
                    {full ? 'Lihat tim' : 'Gabung sekarang'}
                    <span className="transition group-hover:translate-x-0.5">→</span>
                  </span>
                </div>
              </div>
            </Link>
          )
        })}

        {/* ===== PEMBAYARAN ===== */}
        <section className="v2-card animate-fade-up space-y-3 p-5">
          <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">💳 Pembayaran</h2>
          <div className="flex items-center gap-4">
            <button onClick={() => setQrisOpen(true)} className="shrink-0 rounded-2xl border border-slate-200 bg-white p-2 shadow-soft transition active:scale-95">
              <img src={CLUB_INFO.qrisImage} alt="QRIS KEDAI ARIN" className="h-24 w-24 rounded-lg object-contain" />
            </button>
            <div className="space-y-1 text-sm">
              <p className="font-bold text-ink">Scan QRIS</p>
              <p className="text-ink-soft">a/n <b>{CLUB_INFO.qrisName}</b></p>
              <p className="text-ink-muted">HTM Slot <b className="text-ink">{CLUB_INFO.htm}</b></p>
              <button onClick={() => setQrisOpen(true)} className="mt-1 text-[13px] font-bold text-court-600">Perbesar QR →</button>
            </div>
          </div>
        </section>

        {/* ===== KONTAK ===== */}
        <section className="v2-card animate-fade-up space-y-3 p-5">
          <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">☎️ Hubungi Kami</h2>
          <div className="grid grid-cols-1 gap-2.5">
            <a href={CLUB_INFO.waLink} target="_blank" rel="noreferrer"
              className="flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3 transition active:scale-[.98]">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500 text-white">💬</span>
              <div className="flex-1"><p className="text-sm font-bold text-ink">{CLUB_INFO.contactName}</p><p className="text-[13px] text-ink-muted">{CLUB_INFO.contactPhone}</p></div>
              <span className="text-emerald-600">→</span>
            </a>
            <a href={CLUB_INFO.instagram} target="_blank" rel="noreferrer"
              className="flex items-center gap-3 rounded-2xl bg-pink-50 px-4 py-3 transition active:scale-[.98]">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-orange-400 text-white">📸</span>
              <div className="flex-1"><p className="text-sm font-bold text-ink">Instagram</p><p className="text-[13px] text-ink-muted">{CLUB_INFO.instagramHandle}</p></div>
              <span className="text-pink-500">→</span>
            </a>
            <a href={CLUB_INFO.docsLink} target="_blank" rel="noreferrer"
              className="flex items-center gap-3 rounded-2xl bg-court-50 px-4 py-3 transition active:scale-[.98]">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-court-600 text-white">🎬</span>
              <div className="flex-1"><p className="text-sm font-bold text-ink">Dokumentasi</p><p className="text-[13px] text-ink-muted">Foto & video lengkap di Drive</p></div>
              <span className="text-court-600">→</span>
            </a>
          </div>
        </section>

        {/* ===== GALLERY (paling bawah) ===== */}
        {gallery.length > 0 && (
          <section className="animate-fade-up pt-2">
            <div className="mb-3 flex items-center justify-between px-1">
              <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">🎬 Galeri Kegiatan</h2>
              <a href={CLUB_INFO.docsLink} target="_blank" rel="noreferrer" className="text-[13px] font-bold text-court-600">Lihat semua →</a>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {gallery.map(g => (
                <a
                  key={g.id} href={g.url} target="_blank" rel="noreferrer"
                  className="group relative aspect-square overflow-hidden rounded-2xl bg-slate-100 shadow-soft"
                >
                  <img src={g.url} alt={g.caption ?? 'Dokumentasi'} loading="lazy"
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                  {g.type === 'video' && (
                    <span className="absolute inset-0 grid place-items-center bg-black/25 text-3xl text-white">▶</span>
                  )}
                  {g.caption && (
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2.5 pb-2 pt-6 text-[11px] font-semibold text-white">
                      {g.caption}
                    </span>
                  )}
                </a>
              ))}
            </div>
          </section>
        )}

        <p className="pt-2 text-center text-[12px] text-ink-muted">Dadakan Volleyball · Unggul Sport Center</p>
      </main>

      {/* QRIS modal */}
      {qrisOpen && (
        <div onClick={() => setQrisOpen(false)} className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-6 backdrop-blur-sm animate-fade-up">
          <div onClick={e => e.stopPropagation()} className="w-full max-w-xs rounded-3xl bg-white p-4 text-center shadow-lift">
            <img src={CLUB_INFO.qrisImage} alt="QRIS KEDAI ARIN" className="w-full rounded-xl" />
            <p className="mt-3 text-sm font-bold text-ink">QRIS · {CLUB_INFO.qrisName}</p>
            <button onClick={() => setQrisOpen(false)} className="v2-btn mt-3">Tutup</button>
          </div>
        </div>
      )}
    </div>
  )
}
