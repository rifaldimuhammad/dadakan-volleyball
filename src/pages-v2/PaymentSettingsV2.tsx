import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { DEFAULT_QRIS_IMAGE, fetchPaymentInfo } from '../lib/payment'

const BUCKET = 'gallery' // pakai bucket galeri (policy admin sudah ada), folder qris/
const MAX_MB = 5

export default function PaymentSettingsV2() {
  const nav = useNavigate()
  const [loaded, setLoaded] = useState(false)
  const [htm, setHtm] = useState('')
  const [qrisName, setQrisName] = useState('')
  const [note, setNote] = useState('')
  const [qrisImage, setQrisImage] = useState('') // URL tersimpan; '' = gambar bawaan
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchPaymentInfo().then(p => {
      setHtm(p.htm); setQrisName(p.qrisName); setNote(p.note)
      setQrisImage(p.qrisImage === DEFAULT_QRIS_IMAGE ? '' : p.qrisImage)
      setLoaded(true)
    })
  }, [])

  async function logout() { await supabase.auth.signOut(); nav('/admin/login') }

  function pick(f: File | null) {
    setMsg(null)
    if (!f) return
    if (!f.type.startsWith('image/')) return setMsg({ ok: false, text: 'File harus berupa gambar.' })
    if (f.size > MAX_MB * 1024 * 1024) return setMsg({ ok: false, text: `Ukuran maksimal ${MAX_MB} MB.` })
    setFile(f); setPreview(URL.createObjectURL(f))
  }

  function useDefaultImage() {
    setFile(null); setPreview(''); setQrisImage('')
  }

  async function save() {
    setMsg(null)
    if (!htm.trim() || !qrisName.trim()) return setMsg({ ok: false, text: 'HTM dan nama penerima wajib diisi.' })
    setBusy(true)
    try {
      let imageUrl: string | null = qrisImage || null
      if (file) {
        const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
        const path = `qris/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
          cacheControl: '3600', upsert: false, contentType: file.type,
        })
        if (upErr) throw upErr
        imageUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
      }
      const { data, error } = await supabase.from('payment_settings').upsert({
        id: 1, htm: htm.trim(), qris_name: qrisName.trim(), note: note.trim(),
        qris_image: imageUrl, updated_at: new Date().toISOString(),
      }).select('id')
      if (error) throw error
      if (!data || data.length === 0) throw new Error('row-level security')
      setQrisImage(imageUrl ?? ''); setFile(null); setPreview('')
      setMsg({ ok: true, text: 'Info pembayaran tersimpan. Halaman utama sudah memakai data baru.' })
    } catch (e: unknown) {
      console.error(e)
      const m = e instanceof Error ? e.message : ''
      setMsg({
        ok: false,
        text: m.includes('payment_settings') || m.includes('schema cache')
          ? 'Tabel belum ada: jalankan migrasi 015_payment_settings.sql di Supabase dulu.'
          : m.includes('row-level security') || m.toLowerCase().includes('policy')
            ? 'Gagal: pastikan kamu login sebagai admin.'
            : 'Terjadi kesalahan. Silakan coba lagi.',
      })
    } finally {
      setBusy(false)
    }
  }

  const shownImage = preview || qrisImage || DEFAULT_QRIS_IMAGE

  return (
    <div className="v2-root min-h-screen bg-canvas pb-28">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-2">
            <Link to="/admin" className="grid h-8 w-8 place-items-center rounded-xl text-ink-muted transition hover:bg-slate-100">←</Link>
            <h1 className="text-[15px] font-extrabold tracking-tight text-ink">Info Pembayaran</h1>
          </div>
          <button onClick={logout} className="rounded-xl px-3 py-1.5 text-[13px] font-semibold text-ink-muted transition hover:bg-slate-100">Keluar</button>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-4 px-4 pt-5">
        {!loaded ? <div className="v2-skeleton h-96" /> : (
          <div className="v2-card space-y-4 p-5">
            <div>
              <label className="v2-label">Gambar QRIS</label>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => pick(e.target.files?.[0] ?? null)} />
              <div className="flex items-center gap-4">
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="shrink-0 rounded-2xl border border-slate-200 bg-white p-2 shadow-soft transition hover:bg-slate-50">
                  <img src={shownImage} alt="Pratinjau QRIS" className="h-32 w-32 rounded-lg object-contain" />
                </button>
                <div className="space-y-2 text-sm">
                  <button type="button" onClick={() => fileRef.current?.click()} className="v2-btn v2-btn-ghost v2-btn-sm">📤 Ganti gambar</button>
                  {(preview || qrisImage) && (
                    <button type="button" onClick={useDefaultImage} className="block text-[13px] font-semibold text-ink-muted hover:text-ink">
                      Pakai gambar bawaan
                    </button>
                  )}
                  <p className="text-[12px] text-ink-muted">
                    {preview ? `Baru: ${file?.name} (belum disimpan)` : qrisImage ? 'Gambar unggahan admin' : 'Gambar bawaan aplikasi'}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="v2-label">Nama penerima (a/n)</label>
              <input className="v2-input" placeholder="mis. DADAKAN VOLLEYBALL SPORT" value={qrisName} onChange={e => setQrisName(e.target.value)} />
            </div>

            <div>
              <label className="v2-label">HTM per slot</label>
              <input className="v2-input" placeholder="mis. Rp 19.000" value={htm} onChange={e => setHtm(e.target.value)} />
              <p className="mt-1 text-[12px] text-ink-muted">Tampil di hero & section pembayaran halaman utama.</p>
            </div>

            <div>
              <label className="v2-label">Catatan pembayaran <span className="font-normal text-ink-muted">(opsional)</span></label>
              <textarea className="v2-input min-h-[88px]" value={note} onChange={e => setNote(e.target.value)} />
            </div>

            {msg && (
              <p className={`rounded-xl px-3 py-2 text-sm font-medium ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>{msg.text}</p>
            )}
          </div>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/70 bg-white/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-xl">
          <button className="v2-btn" onClick={save} disabled={busy || !loaded}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
        </div>
      </div>
    </div>
  )
}
