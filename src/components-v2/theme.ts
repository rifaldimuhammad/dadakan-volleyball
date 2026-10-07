import type { Team } from '../lib/types'

/** Tema visual tim khusus desain v2 — tidak mengubah data/logic. */
export const TEAM_THEME: Record<Team, {
  label: string
  short: string
  emoji: string
  dot: string        // bg warna solid
  soft: string       // bg lembut kartu
  ring: string       // border aksen
  bar: string        // progress bar
  text: string       // teks aksen
  grad: string       // gradient tombol
}> = {
  red: {
    label: 'Tim Merah', short: 'Merah', emoji: '🔴',
    dot: 'bg-rose-500', soft: 'bg-rose-50/80', ring: 'ring-rose-200',
    bar: 'bg-rose-500', text: 'text-rose-600',
    grad: 'bg-gradient-to-br from-rose-500 to-red-600',
  },
  blue: {
    label: 'Tim Biru', short: 'Biru', emoji: '🔵',
    dot: 'bg-blue-500', soft: 'bg-blue-50/80', ring: 'ring-blue-200',
    bar: 'bg-blue-500', text: 'text-blue-600',
    grad: 'bg-gradient-to-br from-blue-500 to-indigo-600',
  },
  yellow: {
    label: 'Tim Kuning', short: 'Kuning', emoji: '🟡',
    dot: 'bg-amber-400', soft: 'bg-amber-50/80', ring: 'ring-amber-200',
    bar: 'bg-amber-400', text: 'text-amber-600',
    grad: 'bg-gradient-to-br from-amber-400 to-orange-500',
  },
  green: {
    label: 'Tim Hijau', short: 'Hijau', emoji: '🟢',
    dot: 'bg-emerald-500', soft: 'bg-emerald-50/80', ring: 'ring-emerald-200',
    bar: 'bg-emerald-500', text: 'text-emerald-600',
    grad: 'bg-gradient-to-br from-emerald-500 to-green-600',
  },
}
