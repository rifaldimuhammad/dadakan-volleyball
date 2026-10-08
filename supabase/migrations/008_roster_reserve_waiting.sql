-- ============================================================
-- 008_roster_reserve_waiting.sql
-- Fitur:
--  1) Kolom `roster` di players: 'core' | 'reserve' | 'waiting'
--       - core    = pemain inti (slot 1-6)
--       - reserve = cadangan (slot 7-9, otomatis saat tim sudah 6 inti)
--       - waiting = waiting list (tidak terikat tim sampai admin assign; max 5/jadwal)
--  2) Kapasitas tim: min 6, maks 9 (core 6 + reserve 3). register_player()
--     otomatis menempatkan ke core/reserve, dan menolak 'full' saat tim >= 9.
--  3) Waiting list max 5 per jadwal. register_player() dengan p_waiting=true
--     memasukkan ke waiting (p_team disimpan sebagai preferensi awal).
--  4) assign_from_waiting(player_id, team) -- admin: pindahkan waiting -> tim (core/reserve).
--  5) swap_players(a, b) -- admin: tukar tim 2 pemain dalam satu transaksi.
--
-- IDEMPOTEN & aman di-run berulang. Jalankan seluruh isi di Supabase SQL Editor -> Run.
-- Data lama otomatis roster='core' (tetap valid).
-- ============================================================

-- ---------- 1. Kolom roster ----------
alter table public.players
  add column if not exists roster text not null default 'core';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'players_roster_chk') then
    alter table public.players
      add constraint players_roster_chk check (roster in ('core','reserve','waiting'));
  end if;
end $$;

-- ---------- 2. register_player() versi 7-argumen (dengan p_waiting) ----------
-- Kapasitas: core<=6, reserve mengisi 7-9, total tim<=9. waiting<=5/jadwal.
drop function if exists public.register_player(uuid, text, text, text, text, boolean);

create or replace function public.register_player(
  p_schedule_id uuid, p_team text, p_name text, p_phone text,
  p_position text, p_is_newbie boolean, p_waiting boolean default false
)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_name text; v_norm text; v_phone text; v_pos text; v_newbie boolean;
  v_status text; v_team_count int; v_core int; v_setters int;
  v_waiting int; v_roster text;
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

  -- Jalur waiting list (max 5 per jadwal).
  if coalesce(p_waiting, false) then
    select count(*) into v_waiting from players where schedule_id = p_schedule_id and roster = 'waiting';
    if v_waiting >= 5 then return 'waiting_full'; end if;
    insert into players (schedule_id, team, name, name_normalized, phone, position, is_newbie, roster)
    values (p_schedule_id, p_team, v_name, v_norm, v_phone, v_pos, v_newbie, 'waiting');
    return 'ok_waiting';
  end if;

  -- Jalur tim (core/reserve). Hitung anggota aktif tim (bukan waiting).
  select
    count(*) filter (where roster in ('core','reserve')),
    count(*) filter (where roster = 'core'),
    count(*) filter (where roster = 'core' and position = 'setter')
    into v_team_count, v_core, v_setters
    from players where schedule_id = p_schedule_id and team = p_team;

  if v_team_count >= 9 then return 'full'; end if;  -- maks 9 (6 inti + 3 cadangan)

  -- Jaminan minimal 1 setter di inti: slot inti ke-6 harus setter bila belum ada.
  if v_core = 5 and v_setters = 0 and v_pos <> 'setter' then
    return 'need_setter';
  end if;

  -- Penempatan otomatis: isi inti dulu (sampai 6), sisanya cadangan.
  v_roster := case when v_core < 6 then 'core' else 'reserve' end;

  insert into players (schedule_id, team, name, name_normalized, phone, position, is_newbie, roster)
  values (p_schedule_id, p_team, v_name, v_norm, v_phone, v_pos, v_newbie, v_roster);
  return case when v_roster = 'reserve' then 'ok_reserve' else 'ok' end;
exception when unique_violation then return 'duplicate';
end $$;

revoke all on function public.register_player(uuid,text,text,text,text,boolean,boolean) from public;
grant execute on function public.register_player(uuid,text,text,text,text,boolean,boolean) to anon, authenticated;

-- ---------- 3. assign_from_waiting(player_id, team) -- admin ----------
-- Memindahkan pemain waiting ke sebuah tim; otomatis core (jika < 6) atau reserve.
create or replace function public.assign_from_waiting(p_player_id uuid, p_team text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_sched uuid; v_cur text; v_core int; v_team_count int; v_roster text;
begin
  if not is_admin() then return 'forbidden'; end if;
  if p_team not in ('red','blue','yellow','green') then return 'error'; end if;

  select schedule_id, roster into v_sched, v_cur from players where id = p_player_id for update;
  if not found then return 'error'; end if;
  if v_cur <> 'waiting' then return 'not_waiting'; end if;

  select
    count(*) filter (where roster in ('core','reserve')),
    count(*) filter (where roster = 'core')
    into v_team_count, v_core
    from players where schedule_id = v_sched and team = p_team;

  if v_team_count >= 9 then return 'full'; end if;
  v_roster := case when v_core < 6 then 'core' else 'reserve' end;

  update players set team = p_team, roster = v_roster where id = p_player_id;
  return 'ok';
end $$;

revoke all on function public.assign_from_waiting(uuid,text) from public;
grant execute on function public.assign_from_waiting(uuid,text) to authenticated;

-- ---------- 4. swap_players(a, b) -- admin: tukar tim 2 pemain ----------
-- Menukar `team` (dan menyesuaikan roster core/reserve di tim barunya masing-masing).
-- Keduanya harus di jadwal yang sama dan tidak boleh waiting.
create or replace function public.swap_players(p_a uuid, p_b uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  a_sched uuid; a_team text; a_roster text;
  b_sched uuid; b_team text; b_roster text;
begin
  if not is_admin() then return 'forbidden'; end if;
  if p_a = p_b then return 'error'; end if;

  -- Kunci kedua baris dengan urutan id yang stabil (hindari deadlock).
  if p_a < p_b then
    select schedule_id, team, roster into a_sched, a_team, a_roster from players where id = p_a for update;
    select schedule_id, team, roster into b_sched, b_team, b_roster from players where id = p_b for update;
  else
    select schedule_id, team, roster into b_sched, b_team, b_roster from players where id = p_b for update;
    select schedule_id, team, roster into a_sched, a_team, a_roster from players where id = p_a for update;
  end if;

  if a_sched is null or b_sched is null then return 'error'; end if;
  if a_sched <> b_sched then return 'diff_schedule'; end if;
  if a_roster = 'waiting' or b_roster = 'waiting' then return 'waiting'; end if;
  if a_team = b_team then return 'same_team'; end if;

  -- Tukar tim; roster masing-masing ikut ke tim lawan (jumlah per tim tetap sama).
  update players set team = b_team, roster = b_roster where id = p_a;
  update players set team = a_team, roster = a_roster where id = p_b;
  return 'ok';
end $$;

revoke all on function public.swap_players(uuid,uuid) from public;
grant execute on function public.swap_players(uuid,uuid) to authenticated;
