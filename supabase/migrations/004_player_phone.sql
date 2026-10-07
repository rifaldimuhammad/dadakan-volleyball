-- ============================================================
-- 004_player_phone.sql
-- - Tambah kolom `phone` (nomor telepon pemain, WAJIB untuk pendaftaran baru)
-- - Update register_player() -> terima & validasi p_phone
-- IDEMPOTEN: aman dijalankan berulang.
-- Jalankan seluruh isi file ini di Supabase SQL Editor -> Run.
-- ============================================================

-- ---------- 1. Kolom nomor telepon ----------
-- Nullable supaya data lama (seed tanpa telepon) tetap valid.
-- Pendaftaran BARU divalidasi wajib di dalam register_player().
alter table public.players
  add column if not exists phone text;

-- ---------- 2. register_player() versi baru (dengan phone) ----------
-- Fungsi lama (3 argumen) di-drop dan diganti versi 4 argumen.
drop function if exists public.register_player(uuid, text, text);

create or replace function public.register_player(
  p_schedule_id uuid, p_team text, p_name text, p_phone text
)
returns text language plpgsql security definer set search_path = public as $$
declare v_name text; v_norm text; v_phone text; v_status text;
begin
  v_name  := btrim(regexp_replace(coalesce(p_name,''),  '\s+', ' ', 'g'));
  v_norm  := lower(v_name);
  -- normalisasi telepon: ambil hanya digit & tanda +
  v_phone := btrim(regexp_replace(coalesce(p_phone,''), '[^0-9+]', '', 'g'));

  if v_name = '' or length(v_name) > 40 then return 'invalid'; end if;
  -- telepon wajib, minimal 8 digit angka
  if length(regexp_replace(v_phone, '[^0-9]', '', 'g')) < 8 then return 'invalid_phone'; end if;
  if p_team not in ('red','blue','yellow','green') then return 'error'; end if;

  select status into v_status from schedules where id = p_schedule_id for update;
  if not found then return 'error'; end if;
  if v_status <> 'active' and not is_admin() then return 'error'; end if;

  if exists (select 1 from players where schedule_id = p_schedule_id and name_normalized = v_norm) then return 'duplicate'; end if;
  if (select count(*) from players where schedule_id = p_schedule_id and team = p_team) >= 6 then return 'full'; end if;

  insert into players (schedule_id, team, name, name_normalized, phone)
  values (p_schedule_id, p_team, v_name, v_norm, v_phone);
  return 'ok';
exception when unique_violation then return 'duplicate';
end $$;

revoke all on function public.register_player(uuid,text,text,text) from public;
grant execute on function public.register_player(uuid,text,text,text) to anon, authenticated;
