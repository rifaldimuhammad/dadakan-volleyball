import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { type Player, type Position, type Schedule, type Team } from '../lib/types'
import { fmtDate, fmtTime, registerPlayer, waLink } from '../lib/utils'
import { POSITIONS, MAX_PER_TEAM } from '../lib/types'
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
  const [edit, setEdit] = useState<Player | null>(null)
  const [eTeam, setETeam] = useState<Team>('red')
  const [ePos, setEPos] = useState<Position>('spiker')
  const [ePaid, setEPaid] = useState(false)
  const [eBusy, setEBusy] = useState(false)
  const [eErr, setEErr] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [position, setPosition] = useState<Position>('spiker')
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

  const open = (t: Team) => { setJoin(t); setTeam(t); setName(''); setPhone(''); setPosition('spiker'); setErr(''); setDone(null) }
  async function submit() {
    setBusy(true); setErr('')
    const e = await registerPlayer(id!, team, name, phone, position)
    setBusy(false)
    if (e) return setErr(e)
    setDone(team); load()
  }
  async function remove() {
    const { error } = await supabase.from('players').delete().eq('id', del!.id)
    if (error) console.error(error)
    setDel(null); load()
  }
  function openEdit(p: Player) {
    setEdit(p); setETeam(p.team); setEPos(p.position); setEPaid(p.paid); setEErr('')
  }
  async function saveEdit() {
    if (!edit) return
    setEBusy(true); setEErr('')
    // Guard sisi klien (RLS admin yang menegakkan izin tulis di DB):
    // 1) tim tujuan tidak boleh melebihi kapasitas.
    if (eTeam !== edit.team) {
      const destCount = players.filter(p => p.team === eTeam).length
      if (destCount >= MAX_PER_TEAM) { setEBusy(false); return setEErr(`Tim ${th(eTeam).label} sudah penuh.`) }
    }
    // 2) jaga aturan "minimal 1 toser" di tim yang kehilangan toser ini.
    const losesSetter = edit.position === 'setter' && (ePos !== 'setter' || eTeam !== edit.team)
    if (losesSetter) {
      const srcSettersLeft = players.filter(p => p.team === edit.team && p.position === 'setter' && p.id !== edit.id).length
      if (srcSettersLeft === 0) {
        setEBusy(false)
        return setEErr(`Tidak bisa — ${th(edit.team).label} akan kehilangan satu-satunya toser. Tunjuk toser pengganti dulu.`)
      }
    }
    const { error } = await supabase.from('players')
      .update({ team: eTeam, position: ePos, paid: ePaid })
      .eq('id', edit.id)
    setEBusy(false)
    if (error) { console.error(error); return setEErr('Gagal menyimpan perubahan. Coba lagi.') }
    setEdit(null); load()
  }
  const th = (t: Team) => TEAM_THEME[t]
  const back = admin ? '/admin' : '/'

  // Kondisi tim yang sedang dipilih di form, untuk aturan minimal 1 toser.
  const teamPlayers = players.filter(p => p.team === team)
  const teamSetters = teamPlayers.filter(p => p.position === 'setter').length
  const mustBeSetter = teamPlayers.length === 5 && teamSetters === 0
  // Paksa posisi ke setter saat slot terakhir wajib toser.
  useEffect(() => { if (mustBeSetter && position !== 'setter') setPosition('setter') }, [mustBeSetter, position])

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
            <TeamCardV2 team={key} admin={admin} players={players.filter(p => p.team === key)} onJoin={open} onRemove={setDel} onEdit={openEdit} />
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

              <div>
                <label className="v2-label">Posisi</label>
                <div className="grid grid-cols-2 gap-2">
                  {POSITIONS.map(pos => {
                    const disabled = mustBeSetter && pos.key !== 'setter'
                    const activeSel = position === pos.key
                    return (
                      <button
                        key={pos.key} type="button" disabled={disabled}
                        onClick={() => setPosition(pos.key)}
                        className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-sm font-semibold transition
                          ${activeSel ? 'border-transparent bg-court-50 text-court-700 ring-2 ring-court-500/30' : 'border-slate-200 text-ink-muted hover:bg-slate-50'}
                          ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
                      >
                        <span>{pos.emoji}</span> {pos.label}
                      </button>
                    )
                  })}
                </div>
                {mustBeSetter && (
                  <p className="mt-1.5 rounded-xl bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-700">
                    🙌 Slot terakhir tim ini wajib Toser/Setter — tim belum punya toser.
                  </p>
                )}
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

      {/* edit sheet (admin) */}
      {edit && (
        <Sheet
          title="Edit Pemain"
          subtitle={edit.name}
          onClose={() => setEdit(null)}
        >
          {/* kontak WhatsApp */}
          {edit.phone ? (
            <a
              href={waLink(edit.phone)} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 transition active:scale-[0.99]"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 018.413 3.488 11.82 11.82 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.511 5.26l-.999 3.648 3.736-.979zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
              </svg>
              Chat {edit.phone} di WhatsApp
            </a>
          ) : (
            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-ink-muted">Tidak ada nomor telepon.</p>
          )}

          {/* status bayar */}
          <div>
            <label className="v2-label">Status Pembayaran</label>
            <button
              type="button" onClick={() => setEPaid(v => !v)}
              className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm font-bold transition
                ${ePaid ? 'border-transparent bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500/30' : 'border-slate-200 text-ink-muted hover:bg-slate-50'}`}
            >
              <span className="inline-flex items-center gap-2">
                {ePaid ? '✅ Sudah bayar' : '⬜ Belum bayar'}
              </span>
              <span className={`text-[11px] font-semibold ${ePaid ? 'text-emerald-600' : 'text-slate-400'}`}>ketuk untuk ubah</span>
            </button>
          </div>

          {/* pindah tim */}
          <div>
            <label className="v2-label">Tim</label>
            <div className="grid grid-cols-2 gap-2">
              {ORDER.map(k => {
                const destCount = players.filter(p => p.team === k && p.id !== edit.id).length
                const destFull = k !== edit.team && destCount >= MAX_PER_TEAM
                return (
                  <button
                    key={k} type="button" disabled={destFull} onClick={() => setETeam(k)}
                    className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-sm font-semibold transition
                      ${eTeam === k ? `border-transparent ring-2 ring-court-500/30 ${th(k).soft} ${th(k).text}` : 'border-slate-200 text-ink-muted hover:bg-slate-50'}
                      ${destFull ? 'cursor-not-allowed opacity-40' : ''}`}
                  >
                    <span className={`h-3 w-3 rounded-full ${th(k).dot}`} /> {th(k).short}
                    {destFull && <span className="text-[10px]">penuh</span>}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ubah posisi */}
          <div>
            <label className="v2-label">Posisi</label>
            <div className="grid grid-cols-2 gap-2">
              {POSITIONS.map(pos => {
                const activeSel = ePos === pos.key
                return (
                  <button
                    key={pos.key} type="button" onClick={() => setEPos(pos.key)}
                    className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-sm font-semibold transition
                      ${activeSel ? 'border-transparent bg-court-50 text-court-700 ring-2 ring-court-500/30' : 'border-slate-200 text-ink-muted hover:bg-slate-50'}`}
                  >
                    <span>{pos.emoji}</span> {pos.label}
                  </button>
                )
              })}
            </div>
          </div>

          {eErr && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">{eErr}</p>}

          <div className="grid grid-cols-2 gap-3">
            <button className="v2-btn v2-btn-ghost" onClick={() => setEdit(null)}>Batal</button>
            <button className="v2-btn" disabled={eBusy} onClick={saveEdit}>
              {eBusy ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
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
