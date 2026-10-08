import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import Home from './pages-v2/HomeV2'
import SchedulePage from './pages-v2/SchedulePageV2'
import AdminLogin from './pages-v2/AdminLoginV2'
import AdminDashboard from './pages-v2/AdminDashboardV2'
import GalleryManager from './pages-v2/GalleryManagerV2'
import RequireAdmin from './components/RequireAdmin'

/** Redirect link lama /v2/jadwal/:id (dan /v1/*) -> path utama agar tidak putus. */
function RedirectWithId({ to }: { to: (id: string) => string }) {
  const { id } = useParams()
  return <Navigate to={to(id ?? '')} replace />
}

export default function App() {
  return (
    <Routes>
      {/* === Versi utama (final) === */}
      <Route path="/" element={<Home />} />
      <Route path="/jadwal/:id" element={<SchedulePage />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
      <Route path="/admin/galeri" element={<RequireAdmin><GalleryManager /></RequireAdmin>} />
      <Route path="/admin/jadwal/:id" element={<RequireAdmin><SchedulePage admin /></RequireAdmin>} />

      {/* === Redirect link lama (/v2/* dan /v1/*) -> path utama === */}
      <Route path="/v2" element={<Navigate to="/" replace />} />
      <Route path="/v1" element={<Navigate to="/" replace />} />
      <Route path="/v2/jadwal/:id" element={<RedirectWithId to={(id) => `/jadwal/${id}`} />} />
      <Route path="/v1/jadwal/:id" element={<RedirectWithId to={(id) => `/jadwal/${id}`} />} />
      <Route path="/v2/admin/login" element={<Navigate to="/admin/login" replace />} />
      <Route path="/v1/admin/login" element={<Navigate to="/admin/login" replace />} />
      <Route path="/v2/admin" element={<Navigate to="/admin" replace />} />
      <Route path="/v1/admin" element={<Navigate to="/admin" replace />} />
      <Route path="/v2/admin/jadwal/:id" element={<RedirectWithId to={(id) => `/admin/jadwal/${id}`} />} />
      <Route path="/v1/admin/jadwal/:id" element={<RedirectWithId to={(id) => `/admin/jadwal/${id}`} />} />

      <Route path="*" element={<p className="p-8 text-center">Halaman tidak ditemukan.</p>} />
    </Routes>
  )
}
