import type { ReactNode } from 'react'
export default function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-3" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold">{title}</h2>{children}
      </div>
    </div>
  )
}
