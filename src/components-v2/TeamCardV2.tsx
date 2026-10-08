import { MAX_PER_TEAM, type Player, type Team } from '../lib/types'
import { TEAM_THEME } from './theme'

interface Props {
  team: Team
  players: Player[]
  admin?: boolean
  onJoin: (t: Team) => void
  onRemove: (p: Player) => void
  onEdit?: (p: Player) => void
}

export default function TeamCardV2({ team, players, admin, onJoin, onRemove, onEdit }: Props) {
  const t = TEAM_THEME[team]
  const full = players.length >= MAX_PER_TEAM
  const pct = Math.round((players.length / MAX_PER_TEAM) * 100)

  return (
    <section className={`v2-card overflow-hidden`}>
      {/* header */}
      <div className={`flex items-center gap-3 px-4 pt-4`}>
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${t.dot} text-white text-sm font-black shadow-soft`}>
          {t.short[0]}
        </span>
        <div className="flex-1">
          <h2 className="text-[15px] font-extrabold tracking-tight text-ink">{t.label}</h2>
          <p className="text-[12px] text-ink-muted">{players.length} dari {MAX_PER_TEAM} pemain</p>
        </div>
        {!full && players.filter(p => p.position === 'setter').length === 0 && (
          <span className="v2-chip bg-amber-100 text-amber-700" title="Tim ini belum punya toser/setter">Butuh toser</span>
        )}
        {full && <span className={`v2-chip bg-slate-100 text-ink-muted`}>Penuh</span>}
      </div>

      {/* progress */}
      <div className="px-4 pt-3">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full ${t.bar} transition-all duration-500`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* slots */}
      <ol className="grid grid-cols-1 gap-1.5 px-4 py-4">
        {Array.from({ length: MAX_PER_TEAM }, (_, i) => {
          const p = players[i]
          return (
            <li
              key={i}
              className={`flex min-h-[2.75rem] items-center gap-3 rounded-xl px-3 py-2 transition
                ${p ? t.soft : 'bg-slate-50/70 border border-dashed border-slate-200'}`}
            >
              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg text-[11px] font-bold
                ${p ? `${t.dot} text-white` : 'bg-slate-200 text-slate-400'}`}>
                {i + 1}
              </span>
              <span className={`flex-1 truncate text-[14px] ${p ? 'font-semibold text-ink' : 'text-slate-300'}`}>
                <span className="inline-flex items-center gap-1.5">
                  {p ? p.name : 'Slot kosong'}
                  {p && p.position === 'setter' && (
                    <span
                      title="Toser / Setter"
                      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-court-100 px-1.5 py-0.5 text-[10px] font-bold text-court-700"
                    >
                      🙌 Toser
                    </span>
                  )}
                </span>
              </span>
              {p && p.paid && (
                <span
                  title="Sudah bayar"
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[11px] font-bold text-white"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3" aria-hidden="true">
                    <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 111.42-1.42l2.79 2.79 6.79-6.79a1 1 0 011.42 0z" clipRule="evenodd" />
                  </svg>
                  Sudah bayar
                </span>
              )}
              {admin && p && (
                <>
                  <button
                    onClick={() => onEdit?.(p)}
                    className="rounded-lg px-2 py-1 text-[12px] font-bold text-court-600 transition hover:bg-court-50 active:scale-95"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onRemove(p)}
                    className="rounded-lg px-2 py-1 text-[12px] font-bold text-rose-500 transition hover:bg-rose-50 active:scale-95"
                  >
                    Hapus
                  </button>
                </>
              )}
            </li>
          )
        })}
      </ol>

      {/* action */}
      <div className="px-4 pb-4">
        <button
          disabled={full}
          onClick={() => onJoin(team)}
          className={`v2-btn ${full ? '' : t.grad} shadow-soft disabled:bg-slate-100 disabled:text-slate-400`}
        >
          {full ? 'Tim sudah penuh' : admin ? '+ Tambah pemain' : `Gabung ${t.short}`}
        </button>
      </div>
    </section>
  )
}
