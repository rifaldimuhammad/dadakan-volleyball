import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import Home from './pages/Home'
import SchedulePage from './pages/SchedulePage'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'
import RequireAdmin from './components/RequireAdmin'
// --- desain baru (v2) -- sekarang jadi versi utama ---
import HomeV2 from './pages-v2/HomeV2'
import SchedulePageV2 from './pages-v2/SchedulePageV2'
import AdminLoginV2 from './pages-v2/AdminLoginV2'
import AdminDashboardV2 from './pages-v2/AdminDashboardV2'
import GalleryManagerV2 from './pages-v2/GalleryManagerV2'

/** Redirect /v2/jadwal/:id -> /jadwal/:id (dan padanannya) agar link lama tetap jalan. */
function RedirectWithId({ to }: { to: (id: string) => string }) {
  const { id } = useParams()
  return <Navigate to={to(id ?? '')} replace />
}

export default function App() {
  return (
    <Routes>
      {/* === VERSI UTAMA (desain v2) === */}
      <Route path="/" element={<HomeV2 />} />
      <Route path="/jadwal/:id" element={<SchedulePageV2 />} />
      <Route path="/admin/login" element={<AdminLoginV2 />} />
      <Route path="/admin" element={<RequireAdmin><AdminDashboardV2 /></RequireAdmin>} />
      <Route path="/admin/galeri" element={<RequireAdmin><GalleryManagerV2 /></RequireAdmin>} />
      <Route path="/admin/jadwal/:id" element={<RequireAdmin><SchedulePageV2 admin /></RequireAdmin>} />

      {/* === Redirect link lama /v2/* -> path utama === */}
      <Route path="/v2" element={<Navigate to="/" replace />} />
      <Route path="/v2/jadwal/:id" element={<RedirectWithId to={(id) => `/jadwal/${id}`} />} />
      <Route path="/v2/admin/login" element={<Navigate to="/admin/login" replace />} />
      <Route path="/v2/admin" element={<Navigate to="/admin" replace />} />
      <Route path="/v2/admin/jadwal/:id" element={<RedirectWithId to={(id) => `/admin/jadwal/${id}`} />} />

      {/* === Desain lama (v1) -- tetap tersedia sebagai cadangan di /v1/* === */}
      <Route path="/v1" element={<Home />} />
      <Route path="/v1/jadwal/:id" element={<SchedulePage />} />
      <Route path="/v1/admin/login" element={<AdminLogin />} />
      <Route path="/v1/admin" element={<RequireAdmin loginPath="/v1/admin/login"><AdminDashboard /></RequireAdmin>} />
      <Route path="/v1/admin/jadwal/:id" element={<RequireAdmin loginPath="/v1/admin/login"><SchedulePage admin /></RequireAdmin>} />

      <Route path="*" element={<p className="p-8 text-center">Halaman tidak ditemukan.</p>} />
    </Routes>
  )
}
