-- ============================================================
-- 003_maps_and_gallery.sql
-- - Tambah kolom `maps_url` di schedules (link Google Maps lokasi lapangan)
-- - Tabel `gallery` untuk section dokumentasi/galeri di halaman utama
-- IDEMPOTEN: aman dijalankan berulang.
-- Jalankan seluruh isi file ini di Supabase SQL Editor -> Run.
-- ============================================================

-- ---------- 1. Google Maps link pada jadwal ----------
alter table public.schedules
  add column if not exists maps_url text;

-- Isi contoh maps_url untuk jadwal Unggul Sport Center (opsional; edit sendiri lewat admin)
update public.schedules
  set maps_url = 'https://maps.google.com/?q=Unggul+Sport+Center'
  where maps_url is null and location ilike '%Unggul Sport Center%';

-- ---------- 2. Tabel galeri (foto/video kegiatan) ----------
create table if not exists public.gallery (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'image' check (type in ('image','video')),
  url text not null,              -- URL gambar / video (atau thumbnail video)
  caption text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists gallery_sort_idx on public.gallery (sort_order, created_at);

-- RLS: publik boleh lihat, admin boleh kelola
alter table public.gallery enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='gallery' and policyname='publik lihat galeri') then
    create policy "publik lihat galeri" on public.gallery
      for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='gallery' and policyname='admin kelola galeri') then
    create policy "admin kelola galeri" on public.gallery
      for all to authenticated using (is_admin()) with check (is_admin());
  end if;
end $$;

-- Realtime (opsional, agar galeri ikut update langsung)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'gallery'
  ) then
    alter publication supabase_realtime add table public.gallery;
  end if;
end $$;

-- ---------- 3. Seed galeri contoh (hapus/ganti lewat admin nanti) ----------
-- Pakai foto placeholder bertema olahraga agar section tidak kosong saat demo.
insert into public.gallery (type, url, caption, sort_order)
select * from (values
  ('image','https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=800&q=60','Serve pembuka 🔥',1),
  ('image','https://images.unsplash.com/photo-1592656094267-764a45160876?w=800&q=60','Block maut di net',2),
  ('image','https://images.unsplash.com/photo-1627627256672-027a4613d028?w=800&q=60','Tim solid, main happy',3)
) as v(type,url,caption,sort_order)
where not exists (select 1 from public.gallery);
