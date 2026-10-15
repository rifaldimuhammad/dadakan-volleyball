import { supabase } from './supabase'
import type { DpStatus, Position, Schedule, Team } from './types'
import { DEFAULT_CORE, DEFAULT_MAX_TEAM, DEFAULT_MAX_WAITING } from './types'

/** Kapasitas efektif sebuah jadwal, dengan fallback default untuk data lama. */
export function capacityOf(s: Pick<Schedule, 'core_size' | 'max_per_team' | 'max_waiting'> | null | undefined) {
  const core = s?.core_size ?? DEFAULT_CORE
  const maxTeam = Math.max(core, s?.max_per_team ?? DEFAULT_MAX_TEAM)
  const maxWaiting = s?.max_waiting ?? DEFAULT_MAX_WAITING
  return { core, maxTeam, reserve: maxTeam - core, maxWaiting }
}

export const fmtDate = (d: string) =>
  new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(d + 'T00:00:00'))
export const fmtTime = (s: string, e: string) => `${s.slice(0, 5).replace(':', '.')}–${e.slice(0, 5).replace(':', '.')}`
/** Format timestamp ISO (created_at, dp_confirmed_at) jadi "14 Okt 2026, 21.09". */
export const fmtDateTime = (ts: string | null | undefined): string | null =>
  ts ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    .format(new Date(ts)).replace(/\./g, '.').replace(',', ',') : null
/** Normalisasi nomor Indonesia ke format wa.me (62xxx, tanpa + / 0 / spasi). */
export function waLink(phone: string): string {
  let d = phone.replace(/[^\d]/g, '')
  if (d.startsWith('620')) d = '62' + d.slice(3)
  else if (d.startsWith('0')) d = '62' + d.slice(1)
  else if (!d.startsWith('62')) d = '62' + d
  return `https://wa.me/${d}`
}

/** true jika param URL berupa UUID (link lama), bukan slug tanggal. */
export const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)

/**
 * Slug halaman jadwal: tanggal murni (YYYY-MM-DD), atau `YYYY-MM-DD-game-N`
 * untuk jadwal ke-N di tanggal yang sama (N>=2). `all` adalah seluruh jadwal
 * (dipakai menentukan urutan game di tanggal yang sama).
 */
export function scheduleSlug(s: { id: string; date: string }, all: { id: string; date: string }[]): string {
  const sameDay = all
    .filter(x => x.date === s.date)
    .sort((a, b) => a.id.localeCompare(b.id))
  const idx = sameDay.findIndex(x => x.id === s.id)
  return idx <= 0 ? s.date : `${s.date}-game-${idx + 1}`
}

/** Parse slug -> { date, game } (game 1-based, default 1). Mengembalikan null jika bukan slug tanggal. */
export function parseScheduleSlug(slug: string): { date: string; game: number } | null {
  const m = slug.match(/^(\d{4}-\d{2}-\d{2})(?:-game-(\d+))?$/)
  if (!m) return null
  return { date: m[1], game: m[2] ? parseInt(m[2], 10) : 1 }
}
const ERR = 'Terjadi kesalahan. Silakan coba lagi.'
const NET = 'Tidak dapat terhubung. Periksa koneksi internet kamu dan coba lagi.'
/** Mengembalikan null jika berhasil, atau pesan error Bahasa Indonesia.
 *  outcome dikembalikan via callback opsional: 'core' | 'reserve' | 'waiting'. */
export async function registerPlayer(
  scheduleId: string, team: Team, name: string, phone: string,
  position: Position, isNewbie: boolean, waiting = false,
  onOutcome?: (o: 'core' | 'reserve' | 'waiting') => void,
): Promise<string | null> {
  if (!name.trim()) return 'Nama tidak boleh kosong.'
  if (phone.replace(/[^0-9]/g, '').length < 8) return 'Nomor telepon wajib diisi (minimal 8 digit).'
  if (position !== 'setter' && position !== 'spiker') return 'Pilih posisi (toser atau pemukul).'
  const { data, error } = await supabase.rpc('register_player', {
    p_schedule_id: scheduleId, p_team: team, p_name: name, p_phone: phone,
    p_position: position, p_is_newbie: isNewbie, p_waiting: waiting,
  })
  if (error) { console.error(error); return /fetch|network/i.test(error.message) ? NET : ERR }
  switch (data) {
    case 'ok': onOutcome?.('core'); return null
    case 'ok_reserve': onOutcome?.('reserve'); return null
    case 'ok_waiting': onOutcome?.('waiting'); return null
    case 'full': return 'Tim ini sudah penuh (maks 9 pemain). Kamu bisa masuk waiting list.'
    case 'waiting_full': return 'Waiting list sudah penuh (maks 5 orang).'
    case 'duplicate': return 'Nama ini sudah terdaftar pada jadwal ini.'
    case 'invalid': return 'Nama tidak boleh kosong.'
    case 'invalid_phone': return 'Nomor telepon wajib diisi (minimal 8 digit).'
    case 'invalid_position': return 'Pilih posisi (toser atau pemukul).'
    case 'need_setter': return 'Slot inti terakhir tim ini harus diisi Toser/Setter karena tim belum punya toser. Silakan pilih posisi Toser.'
    default: return ERR
  }
}

/** Admin: pindahkan pemain waiting ke sebuah tim (otomatis core/reserve). */
export async function assignFromWaiting(playerId: string, team: Team): Promise<string | null> {
  const { data, error } = await supabase.rpc('assign_from_waiting', { p_player_id: playerId, p_team: team })
  if (error) { console.error(error); return /fetch|network/i.test(error.message) ? NET : ERR }
  switch (data) {
    case 'ok': return null
    case 'full': return 'Tim tujuan sudah penuh (maks 9 pemain).'
    case 'not_waiting': return 'Pemain ini bukan dari waiting list.'
    case 'forbidden': return 'Hanya admin yang bisa melakukan ini.'
    default: return ERR
  }
}

/** Admin: tukar tim dua pemain dalam satu transaksi. */
export async function swapPlayers(aId: string, bId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('swap_players', { p_a: aId, p_b: bId })
  if (error) { console.error(error); return /fetch|network/i.test(error.message) ? NET : ERR }
  switch (data) {
    case 'ok': return null
    case 'same_team': return 'Kedua pemain ada di tim yang sama.'
    case 'waiting': return 'Pemain waiting list tidak bisa ditukar — assign ke tim dulu.'
    case 'diff_schedule': return 'Pemain berasal dari jadwal berbeda.'
    case 'forbidden': return 'Hanya admin yang bisa melakukan ini.'
    default: return ERR
  }
}

// ---------- DP (Down Payment) ----------

const DP_ERR: Record<string, string> = {
  forbidden: 'Hanya admin yang bisa melakukan ini.',
  error: ERR,
}

/** Admin: set status DP eksplisit (unpaid|paid|cancelled|expired). */
export async function setDpStatus(playerId: string, status: DpStatus): Promise<string | null> {
  const { data, error } = await supabase.rpc('set_dp_status', { p_player_id: playerId, p_status: status })
  if (error) { console.error(error); return /fetch|network/i.test(error.message) ? NET : ERR }
  return data === 'ok' ? null : (DP_ERR[data as string] ?? ERR)
}

/** Admin: konfirmasi DP (shortcut set_dp_status 'paid'). */
export async function confirmDp(playerId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('confirm_dp', { p_player_id: playerId })
  if (error) { console.error(error); return /fetch|network/i.test(error.message) ? NET : ERR }
  return data === 'ok' ? null : (DP_ERR[data as string] ?? ERR)
}

/** Admin: batalkan pemain (status 'cancelled', data dipertahankan). */
export async function cancelPlayer(playerId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('cancel_player', { p_player_id: playerId })
  if (error) { console.error(error); return /fetch|network/i.test(error.message) ? NET : ERR }
  return data === 'ok' ? null : (DP_ERR[data as string] ?? ERR)
}

/** true jika jadwal mengaktifkan DP (ada nominal > 0). */
export const dpEnabled = (s: Pick<Schedule, 'dp_amount'> | null | undefined) => (s?.dp_amount ?? 0) > 0

/**
 * Status DP efektif untuk ditampilkan — pendekatan "soft":
 * pemain `unpaid` yang sudah melewati `dp_deadline` ditampilkan sebagai `expired`
 * secara visual, tanpa mengubah DB. Admin yang memutuskan tindakan lanjut.
 * `cancelled`/`paid`/`expired` yang tersimpan tetap apa adanya.
 */
export function effectiveDpStatus(
  p: { dp_status: DpStatus },
  s: Pick<Schedule, 'dp_amount' | 'dp_deadline'> | null | undefined,
  now: number = Date.now(),
): DpStatus {
  if (!dpEnabled(s)) return p.dp_status === 'cancelled' ? 'cancelled' : p.dp_status
  if (p.dp_status === 'unpaid' && s?.dp_deadline && new Date(s.dp_deadline).getTime() < now) return 'expired'
  return p.dp_status
}

/** Format rupiah ringkas: 50000 -> "Rp50.000". */
export const fmtRupiah = (n: number) => 'Rp' + Math.round(n).toLocaleString('id-ID')

/** Sisa waktu menuju deadline dalam teks pendek ("2 hari lagi", "3 jam lagi", "Lewat tenggat"). */
export function dpCountdown(deadline: string | null | undefined, now: number = Date.now()): { text: string; passed: boolean } | null {
  if (!deadline) return null
  const diff = new Date(deadline).getTime() - now
  if (diff <= 0) return { text: 'Lewat tenggat', passed: true }
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  if (days >= 1) return { text: `${days} hari lagi`, passed: false }
  if (hours >= 1) return { text: `${hours} jam lagi`, passed: false }
  return { text: `${Math.max(1, mins)} menit lagi`, passed: false }
}

/** Format datetime-local <input> value (YYYY-MM-DDTHH:mm) dari ISO string. */
export function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
