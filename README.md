# 🏐 Dadakan Volleyball

Aplikasi pendaftaran tim voli komunitas **Dadakan Volleyball** — pilih jadwal, masuk tim favoritmu (Red / Blue / Yellow / Green), dan amankan slot sebelum penuh. Realtime, dengan dashboard admin untuk kelola jadwal, pemain, dan status pembayaran.

**Live:** https://dadakan-volleyball.pages.dev

## Stack
- **Vite + React + TypeScript**
- **Tailwind CSS**
- **Supabase** (Postgres + Auth + Realtime + RLS)
- **Cloudflare Pages** (hosting)

## Setup lokal

```bash
npm install
cp .env.example .env   # lalu isi kredensial Supabase
npm run dev            # http://localhost:5173
```

`.env` yang dibutuhkan:
```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-public-key>
```

## Database
Jalankan migrasi di **Supabase → SQL Editor** sesuai urutan:
```
supabase/migrations/001_init.sql
supabase/migrations/002_seed_rosters.sql
supabase/migrations/003_maps_and_gallery.sql
supabase/migrations/004_player_phone.sql
```

### Buat akun admin
1. Supabase → Authentication → Users → **Add user** (centang Auto Confirm).
2. SQL Editor:
   ```sql
   insert into public.profiles (user_id, role)
   select id, 'admin' from auth.users where email = 'email-admin@contoh.com';
   ```

## Rute
| Path | Halaman |
|---|---|
| `/` | Home (daftar jadwal, info pembayaran, galeri) |
| `/jadwal/:id` | Detail jadwal + daftar pemain |
| `/admin/login` | Login admin |
| `/admin` | Dashboard admin |
| `/v1/*` | Desain lama (cadangan) |

## Deploy (Cloudflare Pages)
- Build command: `npm run build`
- Output directory: `dist`
- Environment variables (Build): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- SPA fallback sudah disiapkan (`public/_redirects`).

Setiap `git push` ke `main` memicu deploy otomatis.
