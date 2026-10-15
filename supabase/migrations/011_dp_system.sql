-- ============================================================
-- 011_dp_system.sql
-- Fitur: Sistem Down Payment (DP) + status pemain + audit log.
--
--  1) players.dp_status  : 'unpaid' | 'paid' | 'cancelled' | 'expired'
--       - unpaid    = sudah daftar, belum bayar DP (default)
--       - paid      = DP dikonfirmasi admin -> slot aman
--       - cancelled = batal ikut (admin)
--       - expired   = lewat tenggat DP tanpa konfirmasi (ditandai, bukan dihapus)
--     players.dp_confirmed_at : waktu admin konfirmasi DP
--     Kompat: kolom lama `paid boolean` DISINKRON otomatis via trigger
--     (paid=true <=> dp_status='paid'), supaya kode lama tetap jalan.
--
--  2) schedules.dp_amount   : nominal DP (rupiah), 0 = DP dinonaktifkan
--     schedules.dp_deadline : batas waktu DP (timestamptz, opsional)
--     Pendekatan "soft": expired dihitung di sisi UI dari dp_deadline;
--     DB tidak meng-expire otomatis (tanpa pg_cron). Admin yang memutuskan.
--
--  3) player_events : audit log perubahan status/slot (append-only).
--     Dicatat otomatis oleh trigger pada INSERT/UPDATE players
--     (daftar, pindah tim, pindah roster, perubahan dp_status) +
--     bisa diisi manual oleh RPC admin.
--
--  4) RPC admin: confirm_dp(), set_dp_status(), cancel_player(),
--     uncancel_player(). Semua security definer + is_admin()-gated,
--     mencatat ke player_events.
--
-- IDEMPOTEN & aman di-run berulang. Jalankan di Supabase SQL Editor -> Run.
-- Prasyarat: migrasi 008-010 sudah di-run (kolom roster + kapasitas + RPC).
-- ============================================================

-- ---------- 1. Kolom DP di players ----------
alter table public.players
  add column if not exists dp_status      text        not null default 'unpaid',
  add column if not exists dp_confirmed_at timestamptz;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'players_dp_status_chk') then
    alter table public.players
      add constraint players_dp_status_chk check (dp_status in ('unpaid','paid','cancelled','expired'));
  end if;
end $$;

-- Backfill: data lama yang paid=true -> dp_status='paid'.
update public.players set dp_status = 'paid'
  where coalesce(paid, false) = true and dp_status = 'unpaid';

-- ---------- 2. Kolom DP di schedules ----------
alter table public.schedules
  add column if not exists dp_amount   int not null default 0,  -- rupiah; 0 = DP off
  add column if not exists dp_deadline timestamptz;

-- ---------- 3. Tabel audit log ----------
create table if not exists public.player_events (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid references public.players(id) on delete set null,
  schedule_id uuid references public.schedules(id) on delete cascade,
  player_name text,
  kind        text not null,          -- register|dp_confirm|dp_unpaid|expire|cancel|uncancel|move_team|move_roster|delete
  detail      text,                   -- deskripsi human-readable
  actor       text not null default 'system',  -- 'admin' | 'public' | 'system'
  created_at  timestamptz not null default now()
);
create index if not exists player_events_schedule_idx on public.player_events (schedule_id, created_at desc);

alter table public.player_events enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='player_events' and policyname='admin lihat log') then
    create policy "admin lihat log" on public.player_events for select to authenticated using (is_admin());
  end if;
end $$;
-- INSERT hanya lewat trigger/RPC (security definer); tidak ada policy insert publik.

-- ---------- 4. Sinkronisasi paid <-> dp_status (kompat kode lama) ----------
create or replace function public.sync_paid_dp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Jika kode lama mengubah paid, cerminkan ke dp_status (hanya naik/turun ke paid/unpaid).
  if tg_op = 'UPDATE' and new.paid is distinct from old.paid then
    if new.paid = true and new.dp_status not in ('paid') then new.dp_status := 'paid';
    elsif new.paid = false and old.dp_status = 'paid' then new.dp_status := 'unpaid';
    end if;
  end if;
  -- Selalu jaga paid konsisten dengan dp_status.
  new.paid := (new.dp_status = 'paid');
  if new.dp_status = 'paid' and new.dp_confirmed_at is null then
    new.dp_confirmed_at := now();
  elsif new.dp_status <> 'paid' then
    new.dp_confirmed_at := null;
  end if;
  return new;
end $$;

drop trigger if exists trg_sync_paid_dp on public.players;
create trigger trg_sync_paid_dp before insert or update on public.players
  for each row execute function public.sync_paid_dp();

-- ---------- 5. Audit log otomatis (trigger) ----------
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
                when 'paid' then 'dp_confirm' when 'cancelled' then 'cancel'
                when 'expired' then 'expire' else 'dp_unpaid' end,
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

drop trigger if exists trg_log_player_event on public.players;
create trigger trg_log_player_event after insert or update on public.players
  for each row execute function public.log_player_event();

-- Catat juga penghapusan.
create or replace function public.log_player_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.player_events (player_id, schedule_id, player_name, kind, detail, actor)
  values (null, old.schedule_id, old.name, 'delete',
          format('Hapus pemain dari %s', old.team),
          case when is_admin() then 'admin' else 'public' end);
  return old;
end $$;

drop trigger if exists trg_log_player_delete on public.players;
create trigger trg_log_player_delete before delete on public.players
  for each row execute function public.log_player_delete();

-- ---------- 6. RPC admin: konfirmasi / ubah status / batal ----------
create or replace function public.set_dp_status(p_player_id uuid, p_status text)
returns text language plpgsql security definer set search_path = public as $$
declare v_cur text;
begin
  if not is_admin() then return 'forbidden'; end if;
  if p_status not in ('unpaid','paid','cancelled','expired') then return 'error'; end if;

  select dp_status into v_cur from players where id = p_player_id for update;
  if not found then return 'error'; end if;

  update players set dp_status = p_status where id = p_player_id;  -- trigger menyelaraskan paid + log
  return 'ok';
end $$;

revoke all on function public.set_dp_status(uuid,text) from public;
grant execute on function public.set_dp_status(uuid,text) to authenticated;

create or replace function public.confirm_dp(p_player_id uuid)
returns text language sql security definer set search_path = public as $$
  select public.set_dp_status(p_player_id, 'paid');
$$;
revoke all on function public.confirm_dp(uuid) from public;
grant execute on function public.confirm_dp(uuid) to authenticated;

create or replace function public.cancel_player(p_player_id uuid)
returns text language sql security definer set search_path = public as $$
  select public.set_dp_status(p_player_id, 'cancelled');
$$;
revoke all on function public.cancel_player(uuid) from public;
grant execute on function public.cancel_player(uuid) to authenticated;

-- ---------- 7. Realtime untuk player_events ----------
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'player_events'
  ) then
    alter publication supabase_realtime add table public.player_events;
  end if;
end $$;
