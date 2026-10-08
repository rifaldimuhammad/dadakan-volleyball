-- ============================================================
-- 007_player_newbie.sql
-- - Tambah kolom `is_newbie` (penanda pemain pemula, untuk soft balancing)
-- - Update register_player() -> terima p_is_newbie (jadi 6 argumen)
-- Tidak ada enforcement keras: penanda ini hanya untuk tampilan
-- (badge + hitungan per tim) agar panitia bisa meratakan via Edit/pindah tim.
-- IDEMPOTEN: aman dijalankan berulang.
-- Jalankan seluruh isi file ini di Supabase SQL Editor -> Run.
-- ============================================================

-- ---------- 1. Kolom newbie ----------
-- Default false supaya data lama tetap valid.
alter table public.players
  add column if not exists is_newbie boolean not null default false;

-- ---------- 2. register_player() versi baru (dengan is_newbie) ----------
-- Drop versi 5-argumen sebelumnya, ganti versi 6-argumen.
drop function if exists public.register_player(uuid, text, text, text, text);

create or replace function public.register_player(
  p_schedule_id uuid, p_team text, p_name text, p_phone text, p_position text, p_is_newbie boolean
)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_name text; v_norm text; v_phone text; v_pos text; v_newbie boolean; v_status text;
  v_count int; v_setters int;
begin
  v_name   := btrim(regexp_replace(coalesce(p_name,''),  '\s+', ' ', 'g'));
  v_norm   := lower(v_name);
  v_phone  := btrim(regexp_replace(coalesce(p_phone,''), '[^0-9+]', '', 'g'));
  v_pos    := lower(btrim(coalesce(p_position,'')));
  v_newbie := coalesce(p_is_newbie, false);

  if v_name = '' or length(v_name) > 40 then return 'invalid'; end if;
  if length(regexp_replace(v_phone, '[^0-9]', '', 'g')) < 8 then return 'invalid_phone'; end if;
  if v_pos not in ('setter','spiker') then return 'invalid_position'; end if;
  if p_team not in ('red','blue','yellow','green') then return 'error'; end if;

  select status into v_status from schedules where id = p_schedule_id for update;
  if not found then return 'error'; end if;
  if v_status <> 'active' and not is_admin() then return 'error'; end if;

  if exists (select 1 from players where schedule_id = p_schedule_id and name_normalized = v_norm) then return 'duplicate'; end if;

  select count(*), count(*) filter (where position = 'setter')
    into v_count, v_setters
    from players where schedule_id = p_schedule_id and team = p_team;

  if v_count >= 6 then return 'full'; end if;

  -- Jaminan minimal 1 setter per tim: slot terakhir (ke-6) harus setter
  -- bila tim belum punya setter sama sekali.
  if v_count = 5 and v_setters = 0 and v_pos <> 'setter' then
    return 'need_setter';
  end if;

  insert into players (schedule_id, team, name, name_normalized, phone, position, is_newbie)
  values (p_schedule_id, p_team, v_name, v_norm, v_phone, v_pos, v_newbie);
  return 'ok';
exception when unique_violation then return 'duplicate';
end $$;

revoke all on function public.register_player(uuid,text,text,text,text,boolean) from public;
grant execute on function public.register_player(uuid,text,text,text,text,boolean) to anon, authenticated;
