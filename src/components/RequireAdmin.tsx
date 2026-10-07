import { useEffect, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
/** Hanya UX. Keamanan sebenarnya ada di RLS database. */
export default function RequireAdmin({ children, loginPath = '/admin/login' }: { children: ReactNode; loginPath?: string }) {
  const [ok, setOk] = useState<boolean | null>(null)
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return setOk(false)
      const { data } = await supabase.from('profiles').select('role').eq('user_id', session.user.id).maybeSingle()
      if (data?.role !== 'admin') await supabase.auth.signOut()
      setOk(data?.role === 'admin')
    })()
  }, [])
  if (ok === null) return <p className="p-8 text-center text-slate-500">Memuat...</p>
  return ok ? <>{children}</> : <Navigate to={loginPath} replace />
}
