-- ============================================================
-- 010_fix_waiting_per_team.sql
-- FIX: waiting list dihitung PER TIM (bukan total per jadwal), dan
--      kapasitas (core_size / max_per_team / max_waiting) SELALU dibaca
--      dari tabel schedules — tidak ada angka hardcode.
--
-- Latar belakang: definisi register_player dari migrasi 008 (hardcode
-- "waiting >= 5" per JADWAL, tanpa filter team) bisa menang bila 008
-- di-run setelah 009. Migrasi ini menulis ulang fungsinya secara tegas
-- supaya tidak bergantung urutan run. IDEMPOTEN — aman di-run berulang.
--
-- Jalankan seluruh isi di Supabase -> SQL Editor -> Run.
-- (Pastikan 008 & 009 sudah pernah di-run untuk kolom roster + kapasitas;
--  kalau sudah, cukup run 010 ini saja untuk memperbaiki.)
-- ============================================================

-- Jaga-jaga: pastikan kolom kapasitas ada (kalau 009 belum sempat).
alter table public.schedules
  add column if not exists core_size    int not null default 6,
  add column if not exists max_per_team int not null default 9,
  add column if not exists max_waiting  int not null default 5;

-- ---------- register_player: waiting PER TIM, kapasitas dari jadwal ----------
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

  -- Baca kapasitas dari jadwal (dengan fallback default kalau NULL).
  select status,
         coalesce(core_size, 6),
         coalesce(max_per_team, 9),
         coalesce(max_waiting, 5)
    into v_status, v_core_size, v_max_team, v_max_wait
    from schedules where id = p_schedule_id for update;
  if not found then return 'error'; end if;
  if v_status <> 'active' and not is_admin() then return 'error'; end if;

  if exists (select 1 from players where schedule_id = p_schedule_id and name_normalized = v_norm) then return 'duplicate'; end if;

  -- Jalur waiting list — dihitung PER TIM (team + roster='waiting').
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

-- ---------- assign_from_waiting: kapasitas dari jadwal ----------
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

  select coalesce(core_size, 6), coalesce(max_per_team, 9)
    into v_core_size, v_max_team from schedules where id = v_sched;

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
