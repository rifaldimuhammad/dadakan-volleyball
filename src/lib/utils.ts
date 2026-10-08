import { supabase } from './supabase'
import type { Position, Team } from './types'
export const fmtDate = (d: string) =>
  new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(d + 'T00:00:00'))
export const fmtTime = (s: string, e: string) => `${s.slice(0, 5).replace(':', '.')}–${e.slice(0, 5).replace(':', '.')}`
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
/** Mengembalikan null jika berhasil, atau pesan error Bahasa Indonesia. */
export async function registerPlayer(scheduleId: string, team: Team, name: string, phone: string, position: Position, isNewbie: boolean): Promise<string | null> {
  if (!name.trim()) return 'Nama tidak boleh kosong.'
  if (phone.replace(/[^0-9]/g, '').length < 8) return 'Nomor telepon wajib diisi (minimal 8 digit).'
  if (position !== 'setter' && position !== 'spiker') return 'Pilih posisi (toser atau pemukul).'
  const { data, error } = await supabase.rpc('register_player', { p_schedule_id: scheduleId, p_team: team, p_name: name, p_phone: phone, p_position: position, p_is_newbie: isNewbie })
  if (error) { console.error(error); return /fetch|network/i.test(error.message) ? NET : ERR }
  switch (data) {
    case 'ok': return null
    case 'full': return 'Tim ini sudah penuh.'
    case 'duplicate': return 'Nama ini sudah terdaftar pada jadwal ini.'
    case 'invalid': return 'Nama tidak boleh kosong.'
    case 'invalid_phone': return 'Nomor telepon wajib diisi (minimal 8 digit).'
    case 'invalid_position': return 'Pilih posisi (toser atau pemukul).'
    case 'need_setter': return 'Slot terakhir tim ini harus diisi Toser/Setter karena tim belum punya toser. Silakan pilih posisi Toser.'
    default: return ERR
  }
}
