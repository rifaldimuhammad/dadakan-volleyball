export type Team = 'red' | 'blue' | 'yellow' | 'green'
export interface Schedule { id: string; date: string; start_time: string; end_time: string; location: string; status: 'active' | 'inactive'; maps_url?: string | null }
export type Position = 'setter' | 'spiker'
export interface Player { id: string; schedule_id: string; team: Team; name: string; phone: string | null; paid: boolean; position: Position; is_newbie: boolean; created_at: string }
export const POSITIONS: { key: Position; label: string; short: string; emoji: string }[] = [
  { key: 'spiker', label: 'Pemukul', short: 'Pemukul', emoji: '💥' },
  { key: 'setter', label: 'Toser / Setter', short: 'Toser', emoji: '🙌' },
]
export interface GalleryItem { id: string; type: 'image' | 'video'; url: string; caption: string | null; sort_order: number; created_at: string }
export const MAX_PER_TEAM = 6
export const TEAMS: { key: Team; label: string; emoji: string; border: string; bg: string; btn: string }[] = [
  { key: 'red', label: 'Tim Merah', emoji: '🔴', border: 'border-red-500', bg: 'bg-red-50', btn: 'bg-red-600' },
  { key: 'blue', label: 'Tim Biru', emoji: '🔵', border: 'border-blue-500', bg: 'bg-blue-50', btn: 'bg-blue-600' },
  { key: 'yellow', label: 'Tim Kuning', emoji: '🟡', border: 'border-yellow-400', bg: 'bg-yellow-50', btn: 'bg-yellow-500' },
  { key: 'green', label: 'Tim Hijau', emoji: '🟢', border: 'border-green-500', bg: 'bg-green-50', btn: 'bg-green-600' },
]
