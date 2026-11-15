-- ============================================================
-- 015_payment_settings.sql
-- Info pembayaran (HTM, QRIS, catatan) yang bisa diubah admin dari dashboard.
-- - Tabel singleton `payment_settings` (selalu 1 baris, id = 1).
-- - Publik boleh lihat, hanya admin yang boleh ubah.
-- - Gambar QRIS yang diunggah admin disimpan di bucket `gallery` (folder qris/),
--   jadi tidak perlu policy storage baru (lihat 005_gallery_storage.sql).
-- IDEMPOTEN: aman dijalankan berulang.
-- Jalankan seluruh isi file ini di Supabase SQL Editor -> Run.
-- ============================================================

create table if not exists public.payment_settings (
  id int primary key default 1 check (id = 1),
  htm text not null default 'Rp 19.000',
  qris_name text not null default 'DADAKAN VOLLEYBALL SPORT',
  qris_image text,  -- null = pakai gambar bawaan aplikasi (/qris-dadakan-volleyball.jpg)
  note text not null default 'Bayar HTM saat datang atau transfer QRIS sebelum main. Simpan bukti untuk konfirmasi admin.',
  updated_at timestamptz not null default now()
);

insert into public.payment_settings (id) values (1) on conflict (id) do nothing;

alter table public.payment_settings enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='payment_settings' and policyname='publik lihat pembayaran') then
    create policy "publik lihat pembayaran" on public.payment_settings
      for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='payment_settings' and policyname='admin kelola pembayaran') then
    create policy "admin kelola pembayaran" on public.payment_settings
      for all to authenticated using (is_admin()) with check (is_admin());
  end if;
end $$;
