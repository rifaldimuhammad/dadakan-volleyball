import { useEffect, type ReactNode } from 'react'

/** Bottom-sheet di mobile, dialog ter-center di desktop. */
export default function Sheet({
  title, subtitle, children, onClose,
}: { title: string; subtitle?: string; children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onEsc)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onEsc); document.body.style.overflow = '' }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-sm p-0 sm:items-center sm:p-4 animate-scale-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-7 shadow-lift animate-sheet-up sm:rounded-3xl sm:animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-200 sm:hidden" />
        <div className="mb-4">
          <h2 className="text-xl font-extrabold tracking-tight text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
        </div>
        <div className="space-y-4">{children}</div>
      </div>
    </div>
  )
}
