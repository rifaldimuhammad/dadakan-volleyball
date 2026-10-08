import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { TEAMS, POSITIONS, type Player, type Position, type Schedule, type Team } from '../lib/types'
import { fmtDate, fmtTime, registerPlayer } from '../lib/utils'
import TeamCard from '../components/TeamCard'
import Modal from '../components/Modal'

export default function SchedulePage({ admin = false }: { admin?: boolean }) {
  const { id } = useParams()
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [state, setState] = useState<'loading' | 'ok' | 'missing' | 'error'>('loading')
  const [join, setJoin] = useState<Team | null>(null)
  const [del, setDel] = useState<Player | null>(null)
  const [name, setName] = useState(''); const [phone, setPhone] = useState(''); const [position, setPosition] = useState<Position>('spiker'); const [team, setTeam] = useState<Team>('red')
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [done, setDone] = useState<Team | null>(null)

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
    // Refetch pada setiap perubahan (event DELETE tidak membawa schedule_id, jadi tidak difilter)
    const ch = supabase.channel(`players-${id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => load()).subscribe()
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
  const label = (t: Team) => TEAMS.find(x => x.key === t)!
  const back = admin ? '/v1/admin' : '/v1'

  if (state === 'loading') return <p className="p-8 text-center text-slate-500">Memuat...</p>
  if (state !== 'ok' || !schedule) return <div className="p-8 text-center space-y-3"><p>{state === 'missing' ? 'Jadwal tidak ditemukan.' : 'Terjadi kesalahan. Silakan coba lagi.'}</p><Link to={back} className="underline">Kembali</Link></div>

  return (
    <main className="mx-auto max-w-md p-4 space-y-4 pb-10">
      <Link to={back} className="text-sm text-slate-500">← Kembali</Link>
      <header className="card"><p className="font-bold text-lg">{fmtDate(schedule.date)}</p><p>{fmtTime(schedule.start_time, schedule.end_time)}</p><p className="text-slate-600">📍 {schedule.location}</p>
        {admin && <p className="mt-2 font-semibold">Total: {players.length}/24 pemain</p>}</header>
      {TEAMS.map(t => <TeamCard key={t.key} team={t.key} admin={admin} players={players.filter(p => p.team === t.key)} onJoin={open} onRemove={setDel} />)}

      {join && (
        <Modal title={admin ? 'Tambah Pemain' : done ? '🎉 Berhasil mendaftar!' : 'Gabung Tim'} onClose={() => setJoin(null)}>
          {done ? (<>
            <p>Nama kamu sudah masuk ke {label(done).label}.</p><button className="btn" onClick={() => setJoin(null)}>TUTUP</button></>
          ) : (<>
            <div><label className="block text-sm font-semibold mb-1">Nama Pemain</label>
              <input className="input" autoFocus placeholder="Masukkan nama kamu" maxLength={40} value={name} onChange={e => setName(e.target.value)} /></div>
            <div><label className="block text-sm font-semibold mb-1">Nomor Telepon</label>
              <input className="input" type="tel" inputMode="tel" placeholder="08xxxxxxxxxx" maxLength={20} value={phone} onChange={e => setPhone(e.target.value)} /></div>
            <div><label className="block text-sm font-semibold mb-1">Posisi</label>
              <select className="input" value={position} onChange={e => setPosition(e.target.value as Position)}>{POSITIONS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}</select></div>
            {admin
              ? <div><label className="block text-sm font-semibold mb-1">Pilih Tim</label><select className="input" value={team} onChange={e => setTeam(e.target.value as Team)}>{TEAMS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}</select></div>
              : <p>Tim yang dipilih: <b>{label(team).emoji} {label(team).label}</b></p>}
            {err && <p className="text-red-600 text-sm">{err}</p>}
            <div className="grid grid-cols-2 gap-3"><button className="btn btn-ghost" onClick={() => setJoin(null)}>BATAL</button>
              <button className="btn" disabled={busy} onClick={submit}>{busy ? 'Memuat...' : admin ? 'TAMBAH PEMAIN' : 'GABUNG TIM'}</button></div></>)}
        </Modal>
      )}
      {del && (
        <Modal title="Hapus pemain?" onClose={() => setDel(null)}>
          <p>Apakah kamu yakin ingin menghapus {del.name} dari {label(del.team).label}?</p>
          <div className="grid grid-cols-2 gap-3"><button className="btn btn-ghost" onClick={() => setDel(null)}>BATAL</button><button className="btn !bg-red-600" onClick={remove}>HAPUS</button></div>
        </Modal>
      )}
    </main>
  )
}
