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
const ERR = 'Terjadi kesalahan. Silakan coba lagi.'
const NET = 'Tidak dapat terhubung. Periksa koneksi internet kamu dan coba lagi.'
/** Mengembalikan null jika berhasil, atau pesan error Bahasa Indonesia. */
export async function registerPlayer(scheduleId: string, team: Team, name: string, phone: string, position: Position): Promise<string | null> {
  if (!name.trim()) return 'Nama tidak boleh kosong.'
  if (phone.replace(/[^0-9]/g, '').length < 8) return 'Nomor telepon wajib diisi (minimal 8 digit).'
  if (position !== 'setter' && position !== 'spiker') return 'Pilih posisi (toser atau pemukul).'
  const { data, error } = await supabase.rpc('register_player', { p_schedule_id: scheduleId, p_team: team, p_name: name, p_phone: phone, p_position: position })
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
