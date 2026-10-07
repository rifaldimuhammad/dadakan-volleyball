import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { type Player, type Schedule, type Team } from '../lib/types'
import { fmtDate, fmtTime, registerPlayer } from '../lib/utils'
import { TEAM_THEME } from '../components-v2/theme'
import TeamCardV2 from '../components-v2/TeamCardV2'
import Sheet from '../components-v2/Sheet'

const ORDER: Team[] = ['red', 'blue', 'yellow', 'green']

export default function SchedulePageV2({ admin = false }: { admin?: boolean }) {
  const { id } = useParams()
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [state, setState] = useState<'loading' | 'ok' | 'missing' | 'error'>('loading')
  const [join, setJoin] = useState<Team | null>(null)
  const [del, setDel] = useState<Player | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [team, setTeam] = useState<Team>('red')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<Team | null>(null)

  const load = useCallback(async () => {
    const [s, p] = await Promise.all([
      supabase.from('schedules').select('*').eq('id', id!).maybeSingle(),
      supabase.from('players').select('*').eq('schedule_id', id!).order('created_at'),
    ])
    if (s.error || p.error) { console.error(s.error ?? p.error); return setState('error') }
    if (!s.data) return setState('missing')
    setSchedule(s.data as Schedule); setPlayers(p.data as Player[]); setState('ok')
  }, [id])

  useEffect(() => {
    load()
    const ch = supabase.channel(`players-v2-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [id, load])

  const open = (t: Team) => { setJoin(t); setTeam(t); setName(''); setPhone(''); setErr(''); setDone(null) }
  async function submit() {
    setBusy(true); setErr('')
    const e = await registerPlayer(id!, team, name, phone)
    setBusy(false)
    if (e) return setErr(e)
    setDone(team); load()
  }
  async function remove() {
    const { error } = await supabase.from('players').delete().eq('id', del!.id)
    if (error) console.error(error)
    setDel(null); load()
  }
  async function togglePaid(p: Player) {
    const { error } = await supabase.from('players').update({ paid: !p.paid }).eq('id', p.id)
    if (error) console.error(error)
    load()
  }
  const th = (t: Team) => TEAM_THEME[t]
  const back = admin ? '/admin' : '/'

  if (state === 'loading')
    return (
      <div className="v2-root min-h-screen bg-canvas px-4 pt-6">
        <div className="mx-auto max-w-md space-y-4">
          <div className="v2-skeleton h-24" />
          {[0, 1, 2].map(i => <div key={i} className="v2-skeleton h-56" />)}
        </div>
      </div>
    )

  if (state !== 'ok' || !schedule)
    return (
      <div className="v2-root grid min-h-screen place-items-center bg-canvas px-6 text-center">
        <div className="v2-card max-w-sm space-y-3 p-8">
          <span className="text-4xl">{state === 'missing' ? '🔍' : '⚠️'}</span>
          <p className="font-bold text-ink">{state === 'missing' ? 'Jadwal tidak ditemukan' : 'Terjadi kesalahan'}</p>
          <Link to={back} className="v2-btn v2-btn-ghost">Kembali</Link>
        </div>
      </div>
    )

  const total = players.length

  return (
    <div className="v2-root min-h-screen bg-canvas pb-16">
      {/* header */}
      <div className="bg-gradient-to-br from-court-600 to-indigo-700 px-4 pb-10 pt-6 text-white">
        <div className="mx-auto max-w-md">
          <Link to={back} className="inline-flex items-center gap-1 text-sm font-medium text-white/80 transition hover:text-white">
            <span>←</span> Kembali
          </Link>
          <div className="mt-4 space-y-1">
            <h1 className="font-display text-2xl font-extrabold tracking-tight">{fmtDate(schedule.date)}</h1>
            <p className="flex items-center gap-1.5 text-[15px] text-white/85"><span>🕒</span> {fmtTime(schedule.start_time, schedule.end_time)}</p>
            <p className="flex items-center gap-1.5 text-[15px] text-white/85"><span>📍</span> {schedule.location}</p>
          </div>
          {schedule.maps_url && (
            <a
              href={schedule.maps_url} target="_blank" rel="noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-court-700 shadow-soft transition active:scale-95"
            >
              <span>🗺️</span> Buka di Google Maps
            </a>
          )}
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold backdrop-blur">
            <span>👥</span> {total}/24 pemain terdaftar
          </div>
        </div>
      </div>

      {/* teams */}
      <main className="mx-auto -mt-5 max-w-md space-y-4 px-4">
        {ORDER.map((key, i) => (
          <div key={key} style={{ animationDelay: `${i * 50}ms` }} className="animate-fade-up">
            <TeamCardV2 team={key} admin={admin} players={players.filter(p => p.team === key)} onJoin={open} onRemove={setDel} onTogglePaid={togglePaid} />
          </div>
        ))}
      </main>

      {/* join / success sheet */}
      {join && (
        <Sheet
          title={admin ? 'Tambah Pemain' : done ? 'Berhasil! 🎉' : `Gabung ${th(team).label}`}
          subtitle={done ? undefined : admin ? 'Masukkan nama dan pilih tim' : 'Masukkan namamu untuk mengamankan slot'}
          onClose={() => setJoin(null)}
        >
          {done ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto grid h-16 w-16 animate-pop place-items-center rounded-full bg-emerald-50 text-3xl">✅</div>
              <p className="text-ink">
                Nama kamu sudah masuk ke <b className={th(done).text}>{th(done).label}</b>.
              </p>
              <button className="v2-btn" onClick={() => setJoin(null)}>Selesai</button>
            </div>
          ) : (
            <>
              <div>
                <label className="v2-label">Nama Pemain</label>
                <input
                  className="v2-input" autoFocus placeholder="Masukkan nama kamu" maxLength={40}
                  value={name} onChange={e => setName(e.target.value)}
                />
              </div>

              <div>
                <label className="v2-label">Nomor Telepon</label>
                <input
                  className="v2-input" type="tel" inputMode="tel" placeholder="08xxxxxxxxxx" maxLength={20}
                  value={phone} onChange={e => setPhone(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !busy && submit()}
                />
                <p className="mt-1 text-[12px] text-ink-muted">Dipakai panitia untuk menghubungi kalau ada perubahan jadwal.</p>
              </div>

              {admin ? (
                <div>
                  <label className="v2-label">Pilih Tim</label>
                  <div className="grid grid-cols-2 gap-2">
                    {ORDER.map(k => (
                      <button
                        key={k} type="button" onClick={() => setTeam(k)}
                        className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-sm font-semibold transition
                          ${team === k ? `border-transparent ring-2 ring-court-500/30 ${th(k).soft} ${th(k).text}` : 'border-slate-200 text-ink-muted hover:bg-slate-50'}`}
                      >
                        <span className={`h-3 w-3 rounded-full ${th(k).dot}`} /> {th(k).short}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className={`flex items-center gap-2 rounded-2xl ${th(team).soft} px-4 py-3 text-sm font-semibold ${th(team).text}`}>
                  <span className={`h-3 w-3 rounded-full ${th(team).dot}`} /> {th(team).label}
                </div>
              )}

              {err && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">{err}</p>}

              <div className="grid grid-cols-2 gap-3">
                <button className="v2-btn v2-btn-ghost" onClick={() => setJoin(null)}>Batal</button>
                <button className="v2-btn" disabled={busy} onClick={submit}>
                  {busy ? 'Menyimpan…' : admin ? 'Tambah' : 'Gabung Tim'}
                </button>
              </div>
            </>
          )}
        </Sheet>
      )}

      {/* delete sheet */}
      {del && (
        <Sheet title="Hapus pemain?" onClose={() => setDel(null)}>
          <p className="text-ink-soft">
            Yakin ingin menghapus <b className="text-ink">{del.name}</b> dari {th(del.team).label}?
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
