-- ============================================================
-- 013_swap_waiting_team.sql
-- Fitur: admin menukar pemain WAITING LIST dengan pemain TIM (inti/cadangan),
--        KHUSUS pemain waiting yang sudah membayar (dp_status 'paid' atau 'paid_full').
--
-- Alasan: pemain yang sudah DP / Lunas tapi kedapetan di waiting berhak naik
-- ke slot tim. Admin memilih siapa yang turun (pemain tim mana yang digeser
-- ke waiting). Pemain tim yang digeser TIDAK dihapus -- datanya tetap, hanya
-- pindah ke roster 'waiting' di tim yang sama.
--
--   swap_waiting_with_team(p_waiting uuid, p_team_player uuid) -> text
--     - p_waiting      = pemain di waiting list (harus paid / paid_full)
--     - p_team_player  = pemain inti/cadangan yang akan ditukar (turun ke waiting)
--     - Pemain waiting NAIK ke tim + roster milik pemain tim tadi.
--     - Pemain tim TURUN ke waiting (team = tim pemain waiting sebelumnya).
--
-- security definer + is_admin()-gated + row-lock stabil (hindari deadlock).
-- Trigger log_player_event (dari 011) otomatis mencatat move_team / move_roster;
-- RPC ini menambah satu event 'swap_waiting' sebagai penanda jelas.
--
-- IDEMPOTEN & aman di-run berulang. Jalankan di Supabase SQL Editor -> Run.
-- Prasyarat: migrasi 008-012 sudah di-run.
-- ============================================================

create or replace function public.swap_waiting_with_team(p_waiting uuid, p_team_player uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  w_sched uuid; w_team text; w_roster text; w_dp text; w_name text;
  t_sched uuid; t_team text; t_roster text; t_name text;
begin
  if not is_admin() then return 'forbidden'; end if;
  if p_waiting = p_team_player then return 'error'; end if;

  -- Kunci kedua baris dengan urutan id stabil (hindari deadlock).
  if p_waiting < p_team_player then
    select schedule_id, team, roster, dp_status, name into w_sched, w_team, w_roster, w_dp, w_name
      from players where id = p_waiting for update;
    select schedule_id, team, roster, name into t_sched, t_team, t_roster, t_name
      from players where id = p_team_player for update;
  else
    select schedule_id, team, roster, name into t_sched, t_team, t_roster, t_name
      from players where id = p_team_player for update;
    select schedule_id, team, roster, dp_status, name into w_sched, w_team, w_roster, w_dp, w_name
      from players where id = p_waiting for update;
  end if;

  if w_sched is null or t_sched is null then return 'error'; end if;
  if w_sched <> t_sched then return 'diff_schedule'; end if;

  -- Pemain pertama HARUS waiting; lawannya HARUS pemain tim (inti/cadangan).
  if w_roster <> 'waiting' then return 'not_waiting'; end if;
  if t_roster not in ('core','reserve') then return 'not_team_player'; end if;

  -- Syarat: pemain waiting sudah membayar (DP atau Lunas).
  if w_dp not in ('paid','paid_full') then return 'not_paid'; end if;

  -- Tukar:
  --  - pemain waiting NAIK ke slot pemain tim (team + roster-nya).
  --  - pemain tim TURUN ke waiting, di tim asal pemain waiting (preferensi).
  update players set team = t_team, roster = t_roster where id = p_waiting;
  update players set team = w_team, roster = 'waiting'  where id = p_team_player;

  -- Penanda event swap yang jelas (selain move_team/move_roster dari trigger).
  insert into public.player_events (player_id, schedule_id, player_name, kind, detail, actor)
  values (p_waiting, w_sched, w_name, 'swap_waiting',
          format('Tukar waiting <-> tim: %s naik ke %s (%s), %s turun ke waiting',
                 w_name, t_team, t_roster, t_name),
          'admin');

  return 'ok';
end $$;

revoke all on function public.swap_waiting_with_team(uuid,uuid) from public;
grant execute on function public.swap_waiting_with_team(uuid,uuid) to authenticated;
