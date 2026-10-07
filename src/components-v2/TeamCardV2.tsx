import { MAX_PER_TEAM, type Player, type Team } from '../lib/types'
import { TEAM_THEME } from './theme'

// Normalisasi nomor Indonesia ke format wa.me (62xxx, tanpa + / 0 / spasi).
function waLink(phone: string): string {
  let d = phone.replace(/[^\d]/g, '')
  if (d.startsWith('0')) d = '62' + d.slice(1)
  else if (d.startsWith('620')) d = '62' + d.slice(3)
  else if (!d.startsWith('62')) d = '62' + d
  return `https://wa.me/${d}`
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 018.413 3.488 11.82 11.82 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.511 5.26l-.999 3.648 3.736-.979zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
    </svg>
  )
}

interface Props {
  team: Team
  players: Player[]
  admin?: boolean
  onJoin: (t: Team) => void
  onRemove: (p: Player) => void
  onTogglePaid?: (p: Player) => void
}

export default function TeamCardV2({ team, players, admin, onJoin, onRemove, onTogglePaid }: Props) {
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
                {p ? p.name : 'Slot kosong'}
                {admin && p?.phone && (
                  <a
                    href={waLink(p.phone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 hover:text-emerald-700"
                  >
                    <WhatsAppIcon className="h-3 w-3" />
                    {p.phone}
                  </a>
                )}
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
                    onClick={() => onTogglePaid?.(p)}
                    className={`rounded-lg px-2 py-1 text-[12px] font-bold transition active:scale-95
                      ${p.paid ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'}`}
                  >
                    {p.paid ? 'Lunas' : 'Tandai bayar'}
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
