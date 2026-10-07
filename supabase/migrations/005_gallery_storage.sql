-- ============================================================
-- 005_gallery_storage.sql
-- Supabase Storage bucket `gallery` untuk UPLOAD foto/video dari admin dashboard.
-- - Bucket publik (read untuk semua), tulis/hapus hanya admin.
-- IDEMPOTEN: aman dijalankan berulang.
-- Jalankan seluruh isi file ini di Supabase SQL Editor -> Run.
-- ============================================================

-- 1. Buat bucket publik `gallery` (idempoten).
insert into storage.buckets (id, name, public)
values ('gallery', 'gallery', true)
on conflict (id) do update set public = true;

-- 2. Policies pada storage.objects untuk bucket ini.
--    Catatan: SELECT publik + bucket.public=true membuat file bisa diakses via URL publik.
do $$
begin
  -- Publik boleh melihat/mengunduh objek di bucket gallery
  if not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects' and policyname='galeri publik lihat'
  ) then
    create policy "galeri publik lihat" on storage.objects
      for select to anon, authenticated
      using (bucket_id = 'gallery');
  end if;

  -- Admin boleh upload
  if not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects' and policyname='galeri admin upload'
  ) then
    create policy "galeri admin upload" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'gallery' and is_admin());
  end if;

  -- Admin boleh update (mis. replace)
  if not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects' and policyname='galeri admin update'
  ) then
    create policy "galeri admin update" on storage.objects
      for update to authenticated
      using (bucket_id = 'gallery' and is_admin())
      with check (bucket_id = 'gallery' and is_admin());
  end if;

  -- Admin boleh hapus
  if not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects' and policyname='galeri admin hapus'
  ) then
    create policy "galeri admin hapus" on storage.objects
      for delete to authenticated
      using (bucket_id = 'gallery' and is_admin());
  end if;
end $$;
