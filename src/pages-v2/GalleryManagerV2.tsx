import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { GalleryItem } from '../lib/types'
import Sheet from '../components-v2/Sheet'

const BUCKET = 'gallery'
const MAX_MB = 10

export default function GalleryManagerV2() {
  const nav = useNavigate()
  const [items, setItems] = useState<GalleryItem[] | null>(null)
  const [err, setErr] = useState('')
  const [add, setAdd] = useState(false)
  const [del, setDel] = useState<GalleryItem | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('gallery').select('*').order('sort_order').order('created_at')
    if (error) { console.error(error); return setErr('Terjadi kesalahan memuat galeri.') }
    setItems(data as GalleryItem[]); setErr('')
  }, [])
  useEffect(() => { load() }, [load])

  async function logout() { await supabase.auth.signOut(); nav('/admin/login') }

  async function remove() {
    if (!del) return
    // Jika file berasal dari Storage kita, hapus juga file-nya.
    const marker = `/storage/v1/object/public/${BUCKET}/`
    if (del.url.includes(marker)) {
      const path = decodeURIComponent(del.url.split(marker)[1] ?? '')
      if (path) await supabase.storage.from(BUCKET).remove([path])
    }
    const { error } = await supabase.from('gallery').delete().eq('id', del.id)
    if (error) console.error(error)
    setDel(null); load()
  }

  async function move(item: GalleryItem, dir: -1 | 1) {
    if (!items) return
    const idx = items.findIndex(i => i.id === item.id)
    const swap = items[idx + dir]
    if (!swap) return
    // Tukar sort_order kedua item.
    await Promise.all([
      supabase.from('gallery').update({ sort_order: swap.sort_order }).eq('id', item.id),
      supabase.from('gallery').update({ sort_order: item.sort_order }).eq('id', swap.id),
    ])
    load()
  }

  return (
    <div className="v2-root min-h-screen bg-canvas pb-28">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-2">
            <Link to="/admin" className="grid h-8 w-8 place-items-center rounded-xl text-ink-muted transition hover:bg-slate-100">←</Link>
            <h1 className="text-[15px] font-extrabold tracking-tight text-ink">Kelola Galeri</h1>
          </div>
          <button onClick={logout} className="rounded-xl px-3 py-1.5 text-[13px] font-semibold text-ink-muted transition hover:bg-slate-100">Keluar</button>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-4 px-4 pt-5">
        {err && <div className="v2-card p-4 text-center text-rose-600">{err}</div>}

        {!items && !err && <div className="grid grid-cols-2 gap-3">{[0, 1, 2, 3].map(i => <div key={i} className="v2-skeleton h-32" />)}</div>}

        {items?.length === 0 && (
          <div className="v2-card flex flex-col items-center gap-2 p-10 text-center">
            <span className="text-4xl">🖼️</span>
            <p className="font-bold text-ink">Galeri masih kosong</p>
            <p className="text-sm text-ink-muted">Tambahkan foto/video kegiatan lewat tombol di bawah.</p>
          </div>
        )}

        {items && items.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {items.map((it, i) => (
              <div key={it.id} className="v2-card overflow-hidden p-0">
                <div className="relative aspect-square bg-slate-100">
                  {it.type === 'video'
                    ? <video src={it.url} className="h-full w-full object-cover" muted />
                    : <img src={it.url} alt={it.caption ?? ''} className="h-full w-full object-cover" loading="lazy" />}
                  <span className="absolute left-1.5 top-1.5 rounded-md bg-ink/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {it.type === 'video' ? '🎬 Video' : '📷 Foto'}
                  </span>
                </div>
                {it.caption && <p className="truncate px-2.5 pt-2 text-[12px] font-medium text-ink">{it.caption}</p>}
                <div className="flex items-center justify-between gap-1 p-2">
                  <div className="flex gap-1">
                    <button disabled={i === 0} onClick={() => move(it, -1)} className="rounded-lg px-2 py-1 text-[13px] font-bold text-ink-muted transition enabled:hover:bg-slate-100 disabled:opacity-30">↑</button>
                    <button disabled={i === items.length - 1} onClick={() => move(it, 1)} className="rounded-lg px-2 py-1 text-[13px] font-bold text-ink-muted transition enabled:hover:bg-slate-100 disabled:opacity-30">↓</button>
                  </div>
                  <button onClick={() => setDel(it)} className="rounded-lg px-2 py-1 text-[12px] font-bold text-rose-500 transition hover:bg-rose-50">Hapus</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/70 bg-white/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-md">
          <button className="v2-btn" onClick={() => setAdd(true)}>+ Tambah ke Galeri</button>
        </div>
      </div>

      {add && <AddSheet nextOrder={((items && items.length ? items[items.length - 1].sort_order : 0)) + 1} onDone={() => { setAdd(false); load() }} onCancel={() => setAdd(false)} />}

      {del && (
        <Sheet title="Hapus dari galeri?" onClose={() => setDel(null)}>
          <p className="text-ink-soft">Item ini akan dihapus permanen{del.url.includes('/storage/v1/object/public/') ? ' beserta file-nya' : ''}. Tindakan ini tidak dapat dibatalkan.</p>
          <div className="grid grid-cols-2 gap-3">
            <button className="v2-btn v2-btn-ghost" onClick={() => setDel(null)}>Batal</button>
            <button className="v2-btn v2-btn-danger" onClick={remove}>Hapus</button>
          </div>
        </Sheet>
      )}
    </div>
  )
}

/* ---------- Tambah item: upload file ATAU tempel URL ---------- */
function AddSheet({ nextOrder, onDone, onCancel }: { nextOrder: number; onDone: () => void; onCancel: () => void }) {
  const [mode, setMode] = useState<'upload' | 'url'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [url, setUrl] = useState('')
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [err, setErr] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function pick(f: File | null) {
    setErr('')
    if (!f) return
    if (f.size > MAX_MB * 1024 * 1024) { setErr(`Ukuran maksimal ${MAX_MB} MB.`); return }
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  async function save() {
    setErr(''); setBusy(true)
    try {
      let finalUrl = ''
      let type: 'image' | 'video' = 'image'

      if (mode === 'upload') {
        if (!file) { setBusy(false); return setErr('Pilih file dulu.') }
        type = file.type.startsWith('video') ? 'video' : 'image'
        const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
        const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
        setProgress('Mengunggah…')
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
          cacheControl: '3600', upsert: false, contentType: file.type,
        })
        if (upErr) throw upErr
        finalUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
      } else {
        if (!url.trim()) { setBusy(false); return setErr('Masukkan URL.') }
        finalUrl = url.trim()
        type = /\.(mp4|webm|mov|ogg)(\?|$)/i.test(finalUrl) ? 'video' : 'image'
      }

      setProgress('Menyimpan…')
      const { error } = await supabase.from('gallery').insert({
        type, url: finalUrl, caption: caption.trim() || null, sort_order: nextOrder,
      })
      if (error) throw error
      onDone()
    } catch (e: unknown) {
      console.error(e)
      const msg = e instanceof Error ? e.message : ''
      setErr(msg.includes('row-level security') || msg.toLowerCase().includes('policy')
        ? 'Gagal: pastikan kamu login sebagai admin dan migrasi 005 sudah dijalankan.'
        : 'Terjadi kesalahan. Silakan coba lagi.')
    } finally {
      setBusy(false); setProgress('')
    }
  }

  return (
    <Sheet title="Tambah ke Galeri" subtitle="Unggah foto/video kegiatan atau tempel link." onClose={onCancel}>
      <div className="grid grid-cols-2 gap-2">
        {(['upload', 'url'] as const).map(m => (
          <button key={m} type="button" onClick={() => { setMode(m); setErr('') }}
            className={`rounded-2xl border px-4 py-2.5 text-sm font-semibold transition
              ${mode === m ? 'border-court-500 bg-court-50 text-court-700 ring-2 ring-court-500/20' : 'border-slate-200 bg-white text-ink-muted hover:bg-slate-50'}`}>
            {m === 'upload' ? '📤 Upload File' : '🔗 Dari URL'}
          </button>
        ))}
      </div>

      {mode === 'upload' ? (
        <div>
          <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={e => pick(e.target.files?.[0] ?? null)} />
          <button type="button" onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/70 px-4 py-8 text-center transition hover:bg-slate-100">
            {preview ? (
              file?.type.startsWith('video')
                ? <video src={preview} className="h-32 rounded-xl object-cover" muted />
                : <img src={preview} alt="" className="h-32 rounded-xl object-cover" />
            ) : (
              <>
                <span className="text-3xl">📷</span>
                <span className="text-sm font-semibold text-ink">Klik untuk pilih foto / video</span>
                <span className="text-[12px] text-ink-muted">JPG, PNG, MP4 — maks {MAX_MB} MB</span>
              </>
            )}
          </button>
          {file && <p className="mt-2 truncate text-[12px] text-ink-muted">{file.name}</p>}
        </div>
      ) : (
        <div>
          <label className="v2-label">URL gambar / video</label>
          <input className="v2-input" placeholder="https://…" value={url} onChange={e => setUrl(e.target.value)} />
          <p className="mt-1 text-[12px] text-ink-muted">Link Instagram/Drive publik atau URL gambar langsung.</p>
        </div>
      )}

      <div>
        <label className="v2-label">Caption <span className="font-normal text-ink-muted">(opsional)</span></label>
        <input className="v2-input" placeholder="mis. Serve pembuka 🔥" value={caption} onChange={e => setCaption(e.target.value)} />
      </div>

      {err && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">{err}</p>}

      <div className="grid grid-cols-2 gap-3 pt-1">
        <button className="v2-btn v2-btn-ghost" onClick={onCancel} disabled={busy}>Batal</button>
        <button className="v2-btn" onClick={save} disabled={busy}>{busy ? (progress || 'Menyimpan…') : 'Simpan'}</button>
      </div>
    </Sheet>
  )
}
