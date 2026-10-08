-- ============================================================
-- 009_editable_capacity.sql
-- Perubahan:
--  1) Kapasitas jadi per-jadwal (editable admin): kolom di schedules
--       core_size      (jumlah pemain inti, default 6)
--       max_per_team   (maks total per tim = inti + cadangan, default 9)
--       max_waiting    (maks waiting list PER TIM, default 5)
--  2) Waiting list dihitung PER TIM (bukan per jadwal).
--  3) register_player / assign_from_waiting / swap_players membaca kapasitas
--     dari schedules, bukan angka hardcode.
--
-- IDEMPOTEN & aman di-run berulang. Jalankan di Supabase SQL Editor -> Run.
-- Data lama: core_size=6, max_per_team=9, max_waiting=5.
-- ============================================================

-- ---------- 1. Kolom kapasitas di schedules ----------
alter table public.schedules
  add column if not exists core_size    int not null default 6,
  add column if not exists max_per_team int not null default 9,
  add column if not exists max_waiting  int not null default 5;

-- Guard nilai masuk akal (dibungkus do-block supaya idempoten).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'schedules_cap_chk') then
    alter table public.schedules add constraint schedules_cap_chk
      check (core_size between 1 and 20 and max_per_team >= core_size and max_per_team <= 30 and max_waiting between 0 and 20);
  end if;
end $$;

-- ---------- 2. register_player() — kapasitas dari jadwal, waiting per tim ----------
create or replace function public.register_player(
  p_schedule_id uuid, p_team text, p_name text, p_phone text,
  p_position text, p_is_newbie boolean, p_waiting boolean default false
)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_name text; v_norm text; v_phone text; v_pos text; v_newbie boolean;
  v_status text; v_core_size int; v_max_team int; v_max_wait int;
  v_team_count int; v_core int; v_setters int; v_waiting int; v_roster text;
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

  select status, core_size, max_per_team, max_waiting
    into v_status, v_core_size, v_max_team, v_max_wait
    from schedules where id = p_schedule_id for update;
  if not found then return 'error'; end if;
  if v_status <> 'active' and not is_admin() then return 'error'; end if;

  if exists (select 1 from players where schedule_id = p_schedule_id and name_normalized = v_norm) then return 'duplicate'; end if;

  -- Jalur waiting list — dihitung PER TIM.
  if coalesce(p_waiting, false) then
    select count(*) into v_waiting from players
      where schedule_id = p_schedule_id and team = p_team and roster = 'waiting';
    if v_waiting >= v_max_wait then return 'waiting_full'; end if;
    insert into players (schedule_id, team, name, name_normalized, phone, position, is_newbie, roster)
    values (p_schedule_id, p_team, v_name, v_norm, v_phone, v_pos, v_newbie, 'waiting');
    return 'ok_waiting';
  end if;

  -- Jalur tim (core/reserve).
  select
    count(*) filter (where roster in ('core','reserve')),
    count(*) filter (where roster = 'core'),
    count(*) filter (where roster = 'core' and position = 'setter')
    into v_team_count, v_core, v_setters
    from players where schedule_id = p_schedule_id and team = p_team;

  if v_team_count >= v_max_team then return 'full'; end if;

  -- Jaminan min 1 setter di inti: slot inti terakhir harus setter bila belum ada.
  if v_core = v_core_size - 1 and v_setters = 0 and v_pos <> 'setter' then
    return 'need_setter';
  end if;

  v_roster := case when v_core < v_core_size then 'core' else 'reserve' end;

  insert into players (schedule_id, team, name, name_normalized, phone, position, is_newbie, roster)
  values (p_schedule_id, p_team, v_name, v_norm, v_phone, v_pos, v_newbie, v_roster);
  return case when v_roster = 'reserve' then 'ok_reserve' else 'ok' end;
exception when unique_violation then return 'duplicate';
end $$;

revoke all on function public.register_player(uuid,text,text,text,text,boolean,boolean) from public;
grant execute on function public.register_player(uuid,text,text,text,text,boolean,boolean) to anon, authenticated;

-- ---------- 3. assign_from_waiting — kapasitas dari jadwal ----------
create or replace function public.assign_from_waiting(p_player_id uuid, p_team text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_sched uuid; v_cur text; v_core_size int; v_max_team int;
  v_core int; v_team_count int; v_roster text;
begin
  if not is_admin() then return 'forbidden'; end if;
  if p_team not in ('red','blue','yellow','green') then return 'error'; end if;

  select schedule_id, roster into v_sched, v_cur from players where id = p_player_id for update;
  if not found then return 'error'; end if;
  if v_cur <> 'waiting' then return 'not_waiting'; end if;

  select core_size, max_per_team into v_core_size, v_max_team from schedules where id = v_sched;

  select
    count(*) filter (where roster in ('core','reserve')),
    count(*) filter (where roster = 'core')
    into v_team_count, v_core
    from players where schedule_id = v_sched and team = p_team;

  if v_team_count >= v_max_team then return 'full'; end if;
  v_roster := case when v_core < v_core_size then 'core' else 'reserve' end;

  update players set team = p_team, roster = v_roster where id = p_player_id;
  return 'ok';
end $$;

revoke all on function public.assign_from_waiting(uuid,text) from public;
grant execute on function public.assign_from_waiting(uuid,text) to authenticated;

-- swap_players tidak berubah (hanya menukar tim; jumlah per tim tetap).
-- Dibiarkan dari migrasi 008.
