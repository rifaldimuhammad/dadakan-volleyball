import { type Player, type Team } from '../lib/types'
import { TEAM_THEME } from './theme'

interface Props {
  team: Team
  players: Player[]            // hanya core + reserve tim ini (bukan waiting)
  core: number                // jumlah slot inti (dari jadwal)
  maxTeam: number             // kapasitas total tim (dari jadwal)
  waitingFull?: boolean       // true jika waiting list tim ini juga penuh
  admin?: boolean
  onJoin: (t: Team) => void
  onRemove: (p: Player) => void
  onEdit?: (p: Player) => void
}

export default function TeamCardV2({ team, players, core: coreSize, maxTeam, waitingFull, admin, onJoin, onRemove, onEdit }: Props) {
  const t = TEAM_THEME[team]
  // Urutkan: core dulu, lalu reserve, masing-masing by created_at.
  const core = players.filter(p => p.roster === 'core')
  const reserve = players.filter(p => p.roster === 'reserve')
  const count = players.length                 // total aktif tim (core + reserve)
  const full = count >= maxTeam
  const pct = Math.round((count / maxTeam) * 100)
  const newbieCount = players.filter(p => p.is_newbie).length
  const noSetter = core.filter(p => p.position === 'setter').length === 0 && core.length > 0
  const reserveSlots = Math.max(0, maxTeam - coreSize)

  const slot = (p: Player | undefined, index: number, kind: 'core' | 'reserve') => (
    <li
      key={`${kind}-${index}`}
      className={`flex min-h-[2.75rem] items-center gap-3 rounded-xl px-3 py-2 transition
        ${p ? t.soft : 'bg-slate-50/70 border border-dashed border-slate-200'}`}
    >
      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg text-[11px] font-bold
        ${p ? `${t.dot} text-white` : 'bg-slate-200 text-slate-400'}`}>
        {kind === 'core' ? index + 1 : index + 1 + coreSize}
      </span>
      <span className={`flex-1 truncate text-[14px] ${p ? 'font-semibold text-ink' : 'text-slate-300'}`}>
        <span className="inline-flex items-center gap-1.5">
          {p ? p.name : 'Slot kosong'}
          {p && p.position === 'setter' && (
            <span title="Toser / Setter" className="inline-flex shrink-0 items-center gap-1 rounded-full bg-court-100 px-1.5 py-0.5 text-[10px] font-bold text-court-700">🙌 Toser</span>
          )}
          {p && p.is_newbie && (
            <span title="Pemain pemula" className="inline-flex shrink-0 items-center gap-1 rounded-full bg-lime-100 px-1.5 py-0.5 text-[10px] font-bold text-lime-700">🌱 Newbie</span>
          )}
        </span>
      </span>
      {p && p.paid && (
        <span title="Sudah bayar" className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[11px] font-bold text-white">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3" aria-hidden="true">
            <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 111.42-1.42l2.79 2.79 6.79-6.79a1 1 0 011.42 0z" clipRule="evenodd" />
          </svg>
          Sudah bayar
        </span>
      )}
      {admin && p && (
        <>
          <button onClick={() => onEdit?.(p)} className="rounded-lg px-2 py-1 text-[12px] font-bold text-court-600 transition hover:bg-court-50 active:scale-95">Edit</button>
          <button onClick={() => onRemove(p)} className="rounded-lg px-2 py-1 text-[12px] font-bold text-rose-500 transition hover:bg-rose-50 active:scale-95">Hapus</button>
        </>
      )}
    </li>
  )

  // Cadangan: tampilkan slot HANYA jika inti sudah penuh atau sudah ada cadangan.
  const showReserve = core.length >= coreSize || reserve.length > 0

  return (
    <section className="v2-card overflow-hidden">
      {/* header */}
      <div className="px-4 pt-4">
        <div className="flex items-center gap-3">
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${t.dot} text-white text-sm font-black shadow-soft`}>{t.short[0]}</span>
          <div className="flex-1 min-w-0">
            <h2 className="text-[15px] font-extrabold tracking-tight text-ink">{t.label}</h2>
            <p className="text-[12px] text-ink-muted">{count} dari {maxTeam} pemain{reserve.length > 0 ? ` · ${reserve.length} cadangan` : ''}</p>
          </div>
        </div>
        {(noSetter || newbieCount > 0 || full) && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {noSetter && <span className="v2-chip bg-amber-100 text-amber-700" title="Tim ini belum punya toser/setter">Butuh toser</span>}
            {newbieCount > 0 && <span className="v2-chip bg-court-100 text-court-700" title="Jumlah pemain pemula di tim ini">🌱 {newbieCount} newbie</span>}
            {full && <span className="v2-chip bg-slate-100 text-ink-muted">Penuh</span>}
          </div>
        )}
      </div>

      {/* progress */}
      <div className="px-4 pt-3">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full ${t.bar} transition-all duration-500`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* inti */}
      <div className="px-4 pt-4">
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-muted">Pemain Inti</p>
        <ol className="grid grid-cols-1 gap-1.5">
          {Array.from({ length: coreSize }, (_, i) => slot(core[i], i, 'core'))}
        </ol>
      </div>

      {/* cadangan */}
      {showReserve && reserveSlots > 0 && (
        <div className="px-4 pt-4">
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-muted">
            🔁 Cadangan <span className="font-medium normal-case tracking-normal text-slate-400">(main set 2 / sesuai kondisi)</span>
          </p>
          <ol className="grid grid-cols-1 gap-1.5">
            {Array.from({ length: reserveSlots }, (_, i) => slot(reserve[i], i, 'reserve'))}
          </ol>
        </div>
      )}

      {/* action */}
      <div className="px-4 pb-4 pt-4">
        {(() => {
          // Admin tidak bisa menambah ke tim penuh (pakai waiting/assign).
          // Publik: tim penuh -> arahkan ke waiting list, kecuali waiting juga penuh.
          const blocked = full && (admin || !!waitingFull)
          const label = full
            ? admin
              ? 'Tim penuh'
              : waitingFull
                ? 'Tim & waiting penuh'
                : 'Tim penuh — gabung waiting list'
            : admin
              ? '+ Tambah pemain'
              : `Gabung ${t.short}`
          return (
            <button
              disabled={blocked}
              onClick={() => onJoin(team)}
              className={`v2-btn ${full ? '' : t.grad} shadow-soft disabled:bg-slate-100 disabled:text-slate-400`}
            >
              {label}
            </button>
          )
        })()}
      </div>
    </section>
  )
}
