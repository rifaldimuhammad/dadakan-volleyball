-- ============================================================
-- 014_fix_delete_schedule_log.sql
-- FIX: menghapus jadwal GAGAL dengan
--   "insert or update on table player_events violates foreign key
--    constraint player_events_schedule_id_fkey".
--
-- Sebab: saat schedule dihapus, Postgres cascade-delete players-nya.
-- Tiap player memicu trigger before-delete log_player_delete() yang
-- meng-INSERT baris 'delete' ke player_events dengan schedule_id jadwal
-- tsb. Karena jadwalnya sedang dihapus, INSERT itu melanggar FK -> seluruh
-- transaksi di-rollback -> jadwal tidak pernah terhapus.
--
-- Perbaikan: log_player_delete() hanya menulis event bila jadwalnya MASIH
-- ada. Kalau jadwalnya sendiri yang sedang dihapus (cascade), lewati log --
-- toh baris player_events-nya juga akan ikut cascade terhapus.
--
-- IDEMPOTEN & aman di-run berulang. Jalankan di Supabase SQL Editor -> Run.
-- Prasyarat: migrasi 011 (tabel player_events + trigger) sudah di-run.
-- ============================================================

create or replace function public.log_player_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Lewati pencatatan bila jadwal induknya sedang/sudah dihapus (cascade),
  -- supaya INSERT ke player_events tidak melanggar FK schedule_id.
  if not exists (select 1 from public.schedules where id = old.schedule_id) then
    return old;
  end if;

  insert into public.player_events (player_id, schedule_id, player_name, kind, detail, actor)
  values (null, old.schedule_id, old.name, 'delete',
          format('Hapus pemain dari %s', old.team),
          case when is_admin() then 'admin' else 'public' end);
  return old;
end $$;
