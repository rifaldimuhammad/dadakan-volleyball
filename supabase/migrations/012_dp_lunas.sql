-- ============================================================
-- 012_dp_lunas.sql
-- Tambah status LUNAS (paid_full) sebagai tingkat SETELAH "Sudah DP".
--
-- Alur status pembayaran jadi: unpaid -> paid (Sudah DP) -> paid_full (Lunas),
-- plus cancelled & expired seperti sebelumnya.
--   - paid       = DP dikonfirmasi, slot aman (bayar sebagian / uang muka)
--   - paid_full  = HTM dibayar penuh (pelunasan)
--
-- Kompat kolom lama `paid boolean`: tetap TRUE untuk 'paid' DAN 'paid_full'
-- (dua-duanya berarti slot sudah diamankan dengan pembayaran).
--
-- IDEMPOTEN. Jalankan di Supabase SQL Editor -> Run.
-- Prasyarat: 011_dp_system.sql sudah di-run.
-- ============================================================

-- ---------- 1. Perluas CHECK constraint dp_status ----------
do $$ begin
  if exists (select 1 from pg_constraint where conname = 'players_dp_status_chk') then
    alter table public.players drop constraint players_dp_status_chk;
  end if;
  alter table public.players
    add constraint players_dp_status_chk
    check (dp_status in ('unpaid','paid','paid_full','cancelled','expired'));
end $$;

-- ---------- 2. Sinkronisasi paid <-> dp_status (sertakan paid_full) ----------
create or replace function public.sync_paid_dp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Jika kode lama mengubah paid, cerminkan ke dp_status.
  if tg_op = 'UPDATE' and new.paid is distinct from old.paid then
    if new.paid = true and new.dp_status not in ('paid','paid_full') then
      new.dp_status := 'paid';
    elsif new.paid = false and old.dp_status in ('paid','paid_full') then
      new.dp_status := 'unpaid';
    end if;
  end if;
  -- paid TRUE untuk paid maupun paid_full (slot sudah diamankan dengan bayar).
  new.paid := (new.dp_status in ('paid','paid_full'));
  -- dp_confirmed_at diisi saat pertama kali bayar (paid/paid_full), dikosongkan bila kembali belum bayar.
  if new.dp_status in ('paid','paid_full') and new.dp_confirmed_at is null then
    new.dp_confirmed_at := now();
  elsif new.dp_status not in ('paid','paid_full') then
    new.dp_confirmed_at := null;
  end if;
  return new;
end $$;

-- ---------- 3. Audit log: label paid_full ----------
create or replace function public.log_player_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_actor text;
begin
  v_actor := case when is_admin() then 'admin' else 'public' end;

  if tg_op = 'INSERT' then
    insert into public.player_events (player_id, schedule_id, player_name, kind, detail, actor)
    values (new.id, new.schedule_id, new.name, 'register',
            format('Daftar ke %s (%s)', new.team, new.roster), v_actor);
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.dp_status is distinct from old.dp_status then
      insert into public.player_events (player_id, schedule_id, player_name, kind, detail, actor)
      values (new.id, new.schedule_id, new.name,
              case new.dp_status
                when 'paid'      then 'dp_confirm'
                when 'paid_full' then 'lunas'
                when 'cancelled' then 'cancel'
                when 'expired'   then 'expire'
                else 'dp_unpaid' end,
              format('Status: %s -> %s', old.dp_status, new.dp_status), v_actor);
    end if;
    if new.team is distinct from old.team then
      insert into public.player_events (player_id, schedule_id, player_name, kind, detail, actor)
      values (new.id, new.schedule_id, new.name, 'move_team',
              format('Pindah tim: %s -> %s', old.team, new.team), v_actor);
    end if;
    if new.roster is distinct from old.roster then
      insert into public.player_events (player_id, schedule_id, player_name, kind, detail, actor)
      values (new.id, new.schedule_id, new.name, 'move_roster',
              format('Roster: %s -> %s', old.roster, new.roster), v_actor);
    end if;
    return new;
  end if;

  return null;
end $$;

-- ---------- 4. RPC set_dp_status menerima paid_full ----------
create or replace function public.set_dp_status(p_player_id uuid, p_status text)
returns text language plpgsql security definer set search_path = public as $$
declare v_cur text;
begin
  if not is_admin() then return 'forbidden'; end if;
  if p_status not in ('unpaid','paid','paid_full','cancelled','expired') then return 'error'; end if;

  select dp_status into v_cur from players where id = p_player_id for update;
  if not found then return 'error'; end if;

  update players set dp_status = p_status where id = p_player_id;  -- trigger menyelaraskan paid + log
  return 'ok';
end $$;

revoke all on function public.set_dp_status(uuid,text) from public;
grant execute on function public.set_dp_status(uuid,text) to authenticated;

-- Shortcut: tandai LUNAS (pelunasan penuh).
create or replace function public.confirm_lunas(p_player_id uuid)
returns text language sql security definer set search_path = public as $$
  select public.set_dp_status(p_player_id, 'paid_full');
$$;
revoke all on function public.confirm_lunas(uuid) from public;
grant execute on function public.confirm_lunas(uuid) to authenticated;
