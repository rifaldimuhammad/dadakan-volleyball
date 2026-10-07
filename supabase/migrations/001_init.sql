-- ========== TABEL ==========
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin')),
  created_at timestamptz not null default now()
);
create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  start_time time not null,
  end_time time not null,
  location text not null,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.players (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  team text not null check (team in ('red','blue','yellow','green')),
  name text not null check (length(btrim(name)) > 0),
  name_normalized text not null,
  created_at timestamptz not null default now(),
  unique (schedule_id, name_normalized)   -- satu nama hanya sekali per jadwal (satu tim saja)
);
create index on public.players (schedule_id, team);

-- ========== FUNGSI ==========
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where user_id = auth.uid() and role = 'admin');
$$;

-- Pendaftaran atomic. Baris jadwal dikunci (FOR UPDATE) sehingga pendaftar
-- bersamaan untuk slot terakhir diproses berurutan -> tim tidak pernah > 6.
create or replace function public.register_player(p_schedule_id uuid, p_team text, p_name text)
returns text language plpgsql security definer set search_path = public as $$
declare v_name text; v_norm text; v_status text;
begin
  v_name := btrim(regexp_replace(coalesce(p_name,''), '\s+', ' ', 'g'));
  v_norm := lower(v_name);
  if v_name = '' or length(v_name) > 40 then return 'invalid'; end if;
  if p_team not in ('red','blue','yellow','green') then return 'error'; end if;

  select status into v_status from schedules where id = p_schedule_id for update;
  if not found then return 'error'; end if;
  if v_status <> 'active' and not is_admin() then return 'error'; end if;

  if exists (select 1 from players where schedule_id = p_schedule_id and name_normalized = v_norm) then return 'duplicate'; end if;
  if (select count(*) from players where schedule_id = p_schedule_id and team = p_team) >= 6 then return 'full'; end if;

  insert into players (schedule_id, team, name, name_normalized) values (p_schedule_id, p_team, v_name, v_norm);
  return 'ok';
exception when unique_violation then return 'duplicate';
end $$;
revoke all on function public.register_player(uuid,text,text) from public;
grant execute on function public.register_player(uuid,text,text) to anon, authenticated;

-- ========== RLS ==========
alter table public.profiles  enable row level security;
alter table public.schedules enable row level security;
alter table public.players   enable row level security;

create policy "profil sendiri" on public.profiles for select to authenticated using (user_id = auth.uid());
-- (tidak ada policy tulis pada profiles: hanya bisa diubah lewat SQL Editor/service role)

create policy "publik lihat jadwal aktif" on public.schedules for select to anon, authenticated using (status = 'active');
create policy "admin kelola jadwal" on public.schedules for all to authenticated using (is_admin()) with check (is_admin());

create policy "publik lihat pemain jadwal aktif" on public.players for select to anon, authenticated
  using (exists (select 1 from public.schedules s where s.id = schedule_id and s.status = 'active'));
create policy "admin lihat pemain" on public.players for select to authenticated using (is_admin());
create policy "admin ubah pemain" on public.players for update to authenticated using (is_admin()) with check (is_admin());
create policy "admin hapus pemain" on public.players for delete to authenticated using (is_admin());
-- INSERT pemain hanya lewat register_player() -> publik tidak punya policy insert langsung.

-- ========== REALTIME ==========
alter publication supabase_realtime add table public.players;

-- ========== SEED (development) ==========
with s as (
  insert into public.schedules (date, start_time, end_time, location) values
    ('2026-10-13','20:00','22:00','Unggul Sport Center'),
    ('2026-10-20','20:00','22:00','Unggul Sport Center') returning id)
insert into public.players (schedule_id, team, name, name_normalized) select id, 'red', 'Satrio', 'satrio' from s;
