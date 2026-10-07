import { MAX_PER_TEAM, TEAMS, type Player, type Team } from '../lib/types'
interface Props { team: Team; players: Player[]; admin?: boolean; onJoin: (t: Team) => void; onRemove: (p: Player) => void }
export default function TeamCard({ team, players, admin, onJoin, onRemove }: Props) {
  const t = TEAMS.find(x => x.key === team)!
  const full = players.length >= MAX_PER_TEAM
  return (
    <section className={`rounded-2xl border-2 ${t.border} ${t.bg} p-4 space-y-3`}>
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-extrabold">{t.emoji} {t.label.toUpperCase()}</h2>
        <span className="text-sm font-semibold">{players.length}/{MAX_PER_TEAM} pemain</span>
      </div>
      <ol className="space-y-1.5">
        {Array.from({ length: MAX_PER_TEAM }, (_, i) => {
          const p = players[i]
          return (
            <li key={i} className="flex items-center justify-between rounded-lg bg-white/80 px-3 py-2 min-h-[2.75rem]">
              <span className={p ? 'font-medium' : 'text-slate-400'}>{i + 1}. {p ? p.name : '—'}</span>
              {admin && p && <button onClick={() => onRemove(p)} className="text-sm font-bold text-red-600 px-2 py-1">HAPUS</button>}
            </li>
          )
        })}
      </ol>
      <button disabled={full} onClick={() => onJoin(team)} className={`btn ${t.btn}`}>
        {full ? 'TIM SUDAH PENUH' : admin ? '+ TAMBAH PEMAIN' : `GABUNG ${t.label.toUpperCase()}`}
      </button>
    </section>
  )
}
