import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { type Player, type Position, type Schedule, type Team } from '../lib/types'
import { fmtDate, fmtTime, registerPlayer, waLink, isUuid, parseScheduleSlug, assignFromWaiting, swapPlayers, capacityOf } from '../lib/utils'
import { POSITIONS } from '../lib/types'
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

  // edit popup
  const [edit, setEdit] = useState<Player | null>(null)
  const [eTeam, setETeam] = useState<Team>('red')
  const [ePos, setEPos] = useState<Position>('spiker')
  const [ePaid, setEPaid] = useState(false)
  const [eNewbie, setENewbie] = useState(false)
  const [eBusy, setEBusy] = useState(false)
  const [eErr, setEErr] = useState('')
  const [swapWith, setSwapWith] = useState<string>('')  // id pemain lawan untuk ditukar

  // assign-from-waiting popup
  const [assign, setAssign] = useState<Player | null>(null)
  const [aTeam, setATeam] = useState<Team>('red')
  const [aBusy, setABusy] = useState(false)
  const [aErr, setAErr] = useState('')

  // join form
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [position, setPosition] = useState<Position>('spiker')
  const [newbie, setNewbie] = useState(false)
  const [team, setTeam] = useState<Team>('red')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<null | { team: Team; outcome: 'core' | 'reserve' | 'waiting' }>(null)

  const load = useCallback(async () => {
    let sched: Schedule | null = null
    if (isUuid(id!)) {
      const s = await supabase.from('schedules').select('*').eq('id', id!).maybeSingle()
      if (s.error) { console.error(s.error); return setState('error') }
      sched = (s.data as Schedule) ?? null
    } else {
      const parsed = parseScheduleSlug(id!)
      if (!parsed) return setState('missing')
      const s = await supabase.from('schedules').select('*').eq('date', parsed.date).order('id')
      if (s.error) { console.error(s.error); return setState('error') }
      const rows = (s.data as Schedule[]) ?? []
      sched = rows[parsed.game - 1] ?? null
    }
    if (!sched) return setState('missing')
    const p = await supabase.from('players').select('*').eq('schedule_id', sched.id).order('created_at')
    if (p.error) { console.error(p.error); return setState('error') }
    setSchedule(sched); setPlayers(p.data as Player[]); setState('ok')
  }, [id])

  useEffect(() => {
    load()
    const ch = supabase.channel(`players-v2-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [id, load])

  const th = (t: Team) => TEAM_THEME[t]
  const back = admin ? '/admin' : '/'
  const cap = capacityOf(schedule)   // { core, maxTeam, reserve, maxWaiting }

  // ---- join ----
  const open = (t: Team) => { setJoin(t); setTeam(t); setName(''); setPhone(''); setPosition('spiker'); setNewbie(false); setErr(''); setDone(null) }
  const teamActive = (t: Team) => players.filter(p => p.team === t && p.roster !== 'waiting')
  const teamFull = (t: Team) => teamActive(t).length >= cap.maxTeam
  const teamWaiting = (t: Team) => players.filter(p => p.team === t && p.roster === 'waiting')
  const waitingList = players.filter(p => p.roster === 'waiting')
  const waitingFullFor = (t: Team) => teamWaiting(t).length >= cap.maxWaiting

  async function submit() {
    if (!schedule) return
    const toWaiting = teamFull(team)
    if (toWaiting && waitingFullFor(team)) return setErr(`Tim penuh dan waiting list tim ini juga penuh (maks ${cap.maxWaiting}).`)
    setBusy(true); setErr('')
    let outcome: 'core' | 'reserve' | 'waiting' = 'core'
    const e = await registerPlayer(schedule.id, team, name, phone, position, newbie, toWaiting, o => { outcome = o })
    setBusy(false)
    if (e) return setErr(e)
    setDone({ team, outcome }); load()
  }

  async function remove() {
    const { error } = await supabase.from('players').delete().eq('id', del!.id)
    if (error) console.error(error)
    setDel(null); load()
  }

  // ---- edit ----
  function openEdit(p: Player) {
    setEdit(p); setETeam(p.team); setEPos(p.position); setEPaid(p.paid); setENewbie(p.is_newbie); setSwapWith(''); setEErr('')
  }
  async function saveEdit() {
    if (!edit) return
    setEBusy(true); setEErr('')

    // Mode SWAP: tukar tim dengan pemain lawan terpilih (dipakai saat tim tujuan penuh).
    if (swapWith) {
      const e = await swapPlayers(edit.id, swapWith)
      setEBusy(false)
      if (e) return setEErr(e)
      setEdit(null); load(); return
    }

    // Guard pindah tim biasa.
    if (eTeam !== edit.team) {
      const destCount = players.filter(p => p.team === eTeam && p.roster !== 'waiting').length
      if (destCount >= cap.maxTeam) { setEBusy(false); return setEErr(`Tim ${th(eTeam).label} sudah penuh (maks ${cap.maxTeam}). Pakai "Tukar pemain" di bawah.`) }
    }
    // Jaga aturan minimal 1 toser di INTI tim asal.
    const losesSetter = edit.position === 'setter' && edit.roster === 'core' && (ePos !== 'setter' || eTeam !== edit.team)
    if (losesSetter) {
      const srcCoreSettersLeft = players.filter(p => p.team === edit.team && p.roster === 'core' && p.position === 'setter' && p.id !== edit.id).length
      if (srcCoreSettersLeft === 0) {
        setEBusy(false)
        return setEErr(`Tidak bisa — ${th(edit.team).label} akan kehilangan satu-satunya toser inti. Tunjuk toser pengganti dulu.`)
      }
    }

    // Hitung roster baru bila pindah tim (core jika inti tujuan < core_size, else reserve).
    let newRoster = edit.roster
    if (eTeam !== edit.team) {
      const destCore = players.filter(p => p.team === eTeam && p.roster === 'core').length
      newRoster = destCore < cap.core ? 'core' : 'reserve'
    }

    const { error } = await supabase.from('players')
      .update({ team: eTeam, position: ePos, paid: ePaid, is_newbie: eNewbie, roster: newRoster })
      .eq('id', edit.id)
    setEBusy(false)
    if (error) { console.error(error); return setEErr('Gagal menyimpan perubahan. Coba lagi.') }
    setEdit(null); load()
  }

  // ---- assign from waiting ----
  function openAssign(p: Player) {
    setAssign(p)
    // default ke tim yang masih ada slot, kalau ada
    const firstOpen = ORDER.find(t => teamActive(t).length < cap.maxTeam) ?? p.team
    setATeam(firstOpen); setAErr('')
  }
  async function saveAssign() {
    if (!assign) return
    setABusy(true); setAErr('')
    const e = await assignFromWaiting(assign.id, aTeam)
    setABusy(false)
    if (e) return setAErr(e)
    setAssign(null); load()
  }

  // kondisi tim yang dipilih di form, untuk aturan minimal 1 toser (hanya inti).
  const teamCore = players.filter(p => p.team === team && p.roster === 'core')
  const teamCoreSetters = teamCore.filter(p => p.position === 'setter').length
  const mustBeSetter = teamCore.length === cap.core - 1 && teamCoreSetters === 0 && !teamFull(team)
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

  const activeTotal = players.filter(p => p.roster !== 'waiting').length
  const joinToWaiting = teamFull(team)

  return (
    <div className="v2-root min-h-screen bg-canvas pb-16">
      {/* header */}
      <div className="bg-gradient-to-br from-court-600 to-indigo-700 px-4 pb-10 pt-6 text-white">
        <div className="mx-auto max-w-md">
          <Link to={back} className="inline-flex items-center gap-1 text-sm font-medium text-white/80 transition hover:text-white"><span>←</span> Kembali</Link>
          <div className="mt-4 space-y-1">
            <h1 className="font-display text-2xl font-extrabold tracking-tight">{fmtDate(schedule.date)}</h1>
            <p className="flex items-center gap-1.5 text-[15px] text-white/85"><span>🕒</span> {fmtTime(schedule.start_time, schedule.end_time)}</p>
            <p className="flex items-center gap-1.5 text-[15px] text-white/85"><span>📍</span> {schedule.location}</p>
          </div>
          {schedule.maps_url && (
            <a href={schedule.maps_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-court-700 shadow-soft transition active:scale-95">
              <span>🗺️</span> Buka di Google Maps
            </a>
          )}
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold backdrop-blur">
            <span>👥</span> {activeTotal} pemain{waitingList.length > 0 ? ` · ${waitingList.length} waiting` : ''}
          </div>
        </div>
      </div>

      {/* teams */}
      <main className="mx-auto -mt-5 max-w-md space-y-4 px-4">
        {ORDER.map((key, i) => (
          <div key={key} style={{ animationDelay: `${i * 50}ms` }} className="animate-fade-up">
            <TeamCardV2 team={key} admin={admin} players={players.filter(p => p.team === key && p.roster !== 'waiting')} core={cap.core} maxTeam={cap.maxTeam} waitingFull={waitingFullFor(key)} onJoin={open} onEdit={openEdit} />
          </div>
        ))}

        {/* waiting list — per tim (maks {cap.maxWaiting}/tim) */}
        {(waitingList.length > 0 || admin) && (
          <section className="v2-card overflow-hidden animate-fade-up">
            <div className="flex items-center gap-3 px-4 pt-4">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-500 text-white text-sm font-black shadow-soft">⏳</span>
              <div className="flex-1">
                <h2 className="text-[15px] font-extrabold tracking-tight text-ink">Waiting List</h2>
                <p className="text-[12px] text-ink-muted">Maks {cap.maxWaiting}/tim · cadangan darurat kalau ada yang batal</p>
              </div>
            </div>
            <div className="space-y-3 px-4 py-4">
              {waitingList.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-3 py-3 text-center text-[13px] text-slate-400">Belum ada yang menunggu</div>
              )}
              {ORDER.map(tk => {
                const q = teamWaiting(tk)
                if (q.length === 0) return null
                return (
                  <div key={tk}>
                    <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-muted">
                      <span className={`h-2.5 w-2.5 rounded-full ${th(tk).dot}`} /> {th(tk).label}
                      <span className="font-medium normal-case tracking-normal text-slate-400">{q.length}/{cap.maxWaiting}</span>
                    </p>
                    <ol className="grid grid-cols-1 gap-1.5">
                      {q.map((p, i) => (
                        <li key={p.id} className="flex min-h-[2.75rem] items-center gap-3 rounded-xl bg-slate-50 px-3 py-2">
                          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-slate-300 text-[11px] font-bold text-white">{i + 1}</span>
                          <span className="flex-1 truncate text-[14px] font-semibold text-ink">
                            <span className="inline-flex items-center gap-1.5">
                              {p.name}
                              {p.position === 'setter' && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-court-100 px-1.5 py-0.5 text-[10px] font-bold text-court-700">🙌 Toser</span>}
                              {p.is_newbie && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-lime-100 px-1.5 py-0.5 text-[10px] font-bold text-lime-700">🌱 Newbie</span>}
                            </span>
                          </span>
                          {admin && (
                            <>
                              <button onClick={() => openAssign(p)} className="rounded-lg px-2 py-1 text-[12px] font-bold text-court-600 transition hover:bg-court-50 active:scale-95">Masukkan</button>
                              <button onClick={() => setDel(p)} className="rounded-lg px-2 py-1 text-[12px] font-bold text-rose-500 transition hover:bg-rose-50 active:scale-95">Hapus</button>
                            </>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </main>

      {/* join / success sheet */}
      {join && (
        <Sheet
          title={admin ? 'Tambah Pemain' : done ? 'Berhasil! 🎉' : joinToWaiting ? `${th(team).label} penuh — Waiting List` : `Gabung ${th(team).label}`}
          subtitle={done ? undefined : admin ? 'Masukkan nama dan pilih tim' : joinToWaiting ? `Tim sudah ${cap.maxTeam} pemain. Kamu masuk antrean cadangan.` : 'Masukkan namamu untuk mengamankan slot'}
          onClose={() => setJoin(null)}
        >
          {done ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto grid h-16 w-16 animate-pop place-items-center rounded-full bg-emerald-50 text-3xl">{done.outcome === 'waiting' ? '⏳' : '✅'}</div>
              <p className="text-ink">
                {done.outcome === 'waiting'
                  ? <>Kamu masuk <b>Waiting List</b> (preferensi <b className={th(done.team).text}>{th(done.team).label}</b>). Kamu akan ikut main di jadwal ini <b>kalau ada pemain inti yang batal</b> — panitia menghubungimu lewat WhatsApp bila slotnya terbuka.</>
                  : done.outcome === 'reserve'
                    ? <>Nama kamu masuk <b>Cadangan</b> <b className={th(done.team).text}>{th(done.team).label}</b> — main di set 2 / sesuai kondisi.</>
                    : <>Nama kamu sudah masuk inti <b className={th(done.team).text}>{th(done.team).label}</b>.</>}
              </p>
              <button className="v2-btn" onClick={() => setJoin(null)}>Selesai</button>
            </div>
          ) : (
            <>
              {joinToWaiting && !admin && (
                <div className="space-y-1.5 rounded-xl bg-amber-50 px-3 py-2.5 text-[12px] font-medium text-amber-700">
                  <p>⏳ {th(team).label} sudah penuh ({cap.maxTeam}). Kamu akan masuk <b>waiting list</b> ({teamWaiting(team).length}/{cap.maxWaiting}).</p>
                  <p className="font-normal text-amber-600">Catatan: pendaftar waiting list <b>baru ikut main di jadwal ini kalau ada pemain inti yang batal</b> — panitia akan menghubungimu lewat WhatsApp bila slotnya terbuka.</p>
                </div>
              )}
              <div>
                <label className="v2-label">Nama Pemain</label>
                <input className="v2-input" autoFocus placeholder="Masukkan nama kamu" maxLength={40} value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div>
                <label className="v2-label">Nomor Telepon</label>
                <input className="v2-input" type="tel" inputMode="tel" placeholder="08xxxxxxxxxx" maxLength={20} value={phone} onChange={e => setPhone(e.target.value)} onKeyDown={e => e.key === 'Enter' && !busy && submit()} />
                <p className="mt-1 text-[12px] text-ink-muted">Dipakai panitia untuk menghubungi kalau ada perubahan jadwal.</p>
              </div>
              <div>
                <label className="v2-label">Posisi</label>
                <div className="grid grid-cols-2 gap-2">
                  {POSITIONS.map(pos => {
                    const disabled = mustBeSetter && pos.key !== 'setter'
                    const activeSel = position === pos.key
                    return (
                      <button key={pos.key} type="button" disabled={disabled} onClick={() => setPosition(pos.key)}
                        className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-sm font-semibold transition
                          ${activeSel ? 'border-transparent bg-court-50 text-court-700 ring-2 ring-court-500/30' : 'border-slate-200 text-ink-muted hover:bg-slate-50'}
                          ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}>
                        <span>{pos.emoji}</span> {pos.label}
                      </button>
                    )
                  })}
                </div>
                {mustBeSetter && <p className="mt-1.5 rounded-xl bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-700">🙌 Slot inti terakhir tim ini wajib Toser/Setter — tim belum punya toser.</p>}
              </div>
              <div>
                <label className="v2-label">Level Main</label>
                <button type="button" onClick={() => setNewbie(v => !v)}
                  className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm font-semibold transition
                    ${newbie ? 'border-transparent bg-court-50 text-court-700 ring-2 ring-court-500/30' : 'border-slate-200 text-ink-muted hover:bg-slate-50'}`}>
                  <span className="inline-flex items-center gap-2">{newbie ? '🌱' : '🏐'} Saya masih newbie / baru belajar</span>
                  <span className={`grid h-5 w-5 place-items-center rounded-md border text-[11px] ${newbie ? 'border-court-500 bg-court-500 text-white' : 'border-slate-300 text-transparent'}`}>✓</span>
                </button>
                <p className="mt-1 text-[12px] text-ink-muted">Opsional — bantu panitia menyebar pemain pemula merata ke tiap tim.</p>
              </div>
              {admin ? (
                <div>
                  <label className="v2-label">Pilih Tim</label>
                  <div className="grid grid-cols-2 gap-2">
                    {ORDER.map(k => (
                      <button key={k} type="button" onClick={() => setTeam(k)}
                        className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-sm font-semibold transition
                          ${team === k ? `border-transparent ring-2 ring-court-500/30 ${th(k).soft} ${th(k).text}` : 'border-slate-200 text-ink-muted hover:bg-slate-50'}`}>
                        <span className={`h-3 w-3 rounded-full ${th(k).dot}`} /> {th(k).short}
                        {teamFull(k) && <span className="text-[10px]">penuh</span>}
                      </button>
                    ))}
                  </div>
                  {joinToWaiting && <p className="mt-1.5 text-[12px] text-amber-700">Tim ini penuh — pemain akan masuk waiting list.</p>}
                </div>
              ) : (
                <div className={`flex items-center gap-2 rounded-2xl ${th(team).soft} px-4 py-3 text-sm font-semibold ${th(team).text}`}>
                  <span className={`h-3 w-3 rounded-full ${th(team).dot}`} /> {th(team).label}
                </div>
              )}
              {err && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">{err}</p>}
              <div className="grid grid-cols-2 gap-3">
                <button className="v2-btn v2-btn-ghost" onClick={() => setJoin(null)}>Batal</button>
                <button className="v2-btn" disabled={busy} onClick={submit}>{busy ? 'Menyimpan…' : admin ? 'Tambah' : joinToWaiting ? 'Masuk waiting list' : 'Gabung Tim'}</button>
              </div>
            </>
          )}
        </Sheet>
      )}

      {/* edit sheet (admin) */}
      {edit && (
        <Sheet title="Edit Pemain" subtitle={`${edit.name}${edit.roster === 'reserve' ? ' · cadangan' : edit.roster === 'waiting' ? ' · waiting' : ''}`} onClose={() => setEdit(null)}>
          {edit.phone ? (
            <a href={waLink(edit.phone)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 transition active:scale-[0.99]">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true"><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 018.413 3.488 11.82 11.82 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.511 5.26l-.999 3.648 3.736-.979zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
              Chat {edit.phone} di WhatsApp
            </a>
          ) : <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-ink-muted">Tidak ada nomor telepon.</p>}

          <div>
            <label className="v2-label">Status Pembayaran</label>
            <button type="button" onClick={() => setEPaid(v => !v)}
              className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm font-bold transition
                ${ePaid ? 'border-transparent bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500/30' : 'border-slate-200 text-ink-muted hover:bg-slate-50'}`}>
              <span className="inline-flex items-center gap-2">{ePaid ? '✅ Sudah bayar' : '⬜ Belum bayar'}</span>
              <span className={`text-[11px] font-semibold ${ePaid ? 'text-emerald-600' : 'text-slate-400'}`}>ketuk untuk ubah</span>
            </button>
          </div>

          <div>
            <label className="v2-label">Level Main</label>
            <button type="button" onClick={() => setENewbie(v => !v)}
              className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm font-bold transition
                ${eNewbie ? 'border-transparent bg-court-50 text-court-700 ring-2 ring-court-500/30' : 'border-slate-200 text-ink-muted hover:bg-slate-50'}`}>
              <span className="inline-flex items-center gap-2">{eNewbie ? '🌱 Newbie / baru belajar' : '🏐 Sudah bisa main'}</span>
              <span className="text-[11px] font-semibold text-slate-400">ketuk untuk ubah</span>
            </button>
          </div>

          {/* pindah tim */}
          <div>
            <label className="v2-label">Tim</label>
            <div className="grid grid-cols-2 gap-2">
              {ORDER.map(k => {
                const destCount = players.filter(p => p.team === k && p.roster !== 'waiting' && p.id !== edit.id).length
                const destFull = k !== edit.team && destCount >= cap.maxTeam
                const selected = eTeam === k && !swapWith
                return (
                  <button key={k} type="button" disabled={destFull} onClick={() => { setETeam(k); setSwapWith('') }}
                    className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-sm font-semibold transition
                      ${selected ? `border-transparent ring-2 ring-court-500/30 ${th(k).soft} ${th(k).text}` : 'border-slate-200 text-ink-muted hover:bg-slate-50'}
                      ${destFull ? 'cursor-not-allowed opacity-40' : ''}`}>
                    <span className={`h-3 w-3 rounded-full ${th(k).dot}`} /> {th(k).short}
                    {destFull && <span className="text-[10px]">penuh</span>}
                  </button>
                )
              })}
            </div>
          </div>

          {/* TUKAR pemain — untuk kasus tim tujuan penuh (ratakan newbie dsb) */}
          <div>
            <label className="v2-label">🔁 Tukar dengan pemain tim lain</label>
            <p className="mb-1.5 text-[12px] text-ink-muted">Pakai ini kalau tim tujuan penuh — tukar posisi {edit.name} dengan salah satu pemain di tim lain.</p>
            <select
              className="v2-input" value={swapWith}
              onChange={e => setSwapWith(e.target.value)}
            >
              <option value="">— tidak menukar —</option>
              {ORDER.filter(t => t !== edit.team).map(t => {
                const members = players.filter(p => p.team === t && p.roster !== 'waiting')
                if (members.length === 0) return null
                return (
                  <optgroup key={t} label={th(t).label}>
                    {members.map(p => (
                      <option key={p.id} value={p.id}>{p.name}{p.roster === 'reserve' ? ' (cadangan)' : ''}{p.position === 'setter' ? ' · toser' : ''}{p.is_newbie ? ' · newbie' : ''}</option>
                    ))}
                  </optgroup>
                )
              })}
            </select>
            {swapWith && <p className="mt-1.5 rounded-xl bg-court-50 px-3 py-2 text-[12px] font-medium text-court-700">Mode tukar aktif — pilihan tim/posisi di atas diabaikan; keduanya hanya bertukar tim.</p>}
          </div>

          {/* ubah posisi */}
          <div>
            <label className="v2-label">Posisi</label>
            <div className="grid grid-cols-2 gap-2">
              {POSITIONS.map(pos => {
                const activeSel = ePos === pos.key
                return (
                  <button key={pos.key} type="button" disabled={!!swapWith} onClick={() => setEPos(pos.key)}
                    className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-sm font-semibold transition
                      ${activeSel ? 'border-transparent bg-court-50 text-court-700 ring-2 ring-court-500/30' : 'border-slate-200 text-ink-muted hover:bg-slate-50'}
                      ${swapWith ? 'cursor-not-allowed opacity-40' : ''}`}>
                    <span>{pos.emoji}</span> {pos.label}
                  </button>
                )
              })}
            </div>
          </div>

          {eErr && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">{eErr}</p>}
          <div className="grid grid-cols-2 gap-3">
            <button className="v2-btn v2-btn-ghost" onClick={() => setEdit(null)}>Batal</button>
            <button className="v2-btn" disabled={eBusy} onClick={saveEdit}>{eBusy ? 'Menyimpan…' : swapWith ? 'Tukar sekarang' : 'Simpan'}</button>
          </div>
          <button
            disabled={eBusy}
            onClick={() => { const p = edit; setEdit(null); setDel(p) }}
            className="mt-1 w-full rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[13px] font-bold text-rose-600 transition hover:bg-rose-100 active:scale-[0.99] disabled:opacity-50"
          >
            Hapus pemain ini
          </button>
        </Sheet>
      )}

      {/* assign-from-waiting sheet (admin) */}
      {assign && (
        <Sheet title="Masukkan ke Tim" subtitle={assign.name} onClose={() => setAssign(null)}>
          <p className="text-[13px] text-ink-soft">Pindahkan <b className="text-ink">{assign.name}</b> dari waiting list ke sebuah tim. Otomatis jadi inti kalau masih ada slot inti, atau cadangan.</p>
          <div>
            <label className="v2-label">Pilih Tim</label>
            <div className="grid grid-cols-2 gap-2">
              {ORDER.map(k => {
                const full = teamActive(k).length >= cap.maxTeam
                return (
                  <button key={k} type="button" disabled={full} onClick={() => setATeam(k)}
                    className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-sm font-semibold transition
                      ${aTeam === k ? `border-transparent ring-2 ring-court-500/30 ${th(k).soft} ${th(k).text}` : 'border-slate-200 text-ink-muted hover:bg-slate-50'}
                      ${full ? 'cursor-not-allowed opacity-40' : ''}`}>
                    <span className={`h-3 w-3 rounded-full ${th(k).dot}`} /> {th(k).short} <span className="text-[10px] text-slate-400">{teamActive(k).length}/{cap.maxTeam}</span>
                    {full && <span className="text-[10px]">penuh</span>}
                  </button>
                )
              })}
            </div>
          </div>
          {aErr && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">{aErr}</p>}
          <div className="grid grid-cols-2 gap-3">
            <button className="v2-btn v2-btn-ghost" onClick={() => setAssign(null)}>Batal</button>
            <button className="v2-btn" disabled={aBusy} onClick={saveAssign}>{aBusy ? 'Memproses…' : 'Masukkan'}</button>
          </div>
        </Sheet>
      )}

      {/* delete sheet */}
      {del && (
        <Sheet title="Hapus pemain?" onClose={() => setDel(null)}>
          <p className="text-ink-soft">Yakin ingin menghapus <b className="text-ink">{del.name}</b>{del.roster === 'waiting' ? ' dari waiting list' : ` dari ${th(del.team).label}`}?</p>
          <div className="grid grid-cols-2 gap-3">
            <button className="v2-btn v2-btn-ghost" onClick={() => setDel(null)}>Batal</button>
            <button className="v2-btn v2-btn-danger" onClick={remove}>Hapus</button>
          </div>
        </Sheet>
      )}
    </div>
  )
}
