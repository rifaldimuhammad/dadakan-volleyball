-- ============================================================
-- 002_seed_rosters.sql
-- - Tambah kolom `paid` (status "sudah bayar", tanda ✅ di poster)
-- - Isi/sinkron roster Jadwal 1 (13 Okt), Jadwal 2 (20 Okt),
--   dan Jadwal 3 (27 Okt — jadwal baru).
--
-- IDEMPOTEN: aman dijalankan berulang.
--   * kolom paid dibuat dengan IF NOT EXISTS
--   * schedule di-upsert berdasarkan (date)
--   * player di-insert via register_player() yang menolak duplikat,
--     lalu status paid di-set terpisah.
-- Jalankan seluruh isi file ini di Supabase SQL Editor -> Run.
-- ============================================================

-- ---------- 1. Kolom status pembayaran ----------
alter table public.players
  add column if not exists paid boolean not null default false;

-- `date` dipakai sebagai kunci upsert, jadi harus unik.
create unique index if not exists schedules_date_key on public.schedules (date);

-- Admin boleh update kolom paid lewat policy "admin ubah pemain" yang sudah ada.

-- ---------- 2. Helper: isi roster satu jadwal ----------
-- Memakai register_player() (menghormati batas 6/ tim & anti-duplikat),
-- lalu menandai paid. is_admin() tidak berlaku di SQL Editor (service role
-- bypass RLS), dan status 'active' tetap lolos.
do $$
declare
  sid uuid;
  rec record;
  roster jsonb;
begin
  -- ===== JADWAL 1: 13 Oktober 2026 =====
  insert into public.schedules (date, start_time, end_time, location, status)
  values ('2026-10-13','20:00','22:00','Unggul Sport Center','active')
  on conflict (date) do update set status = 'active';
  select id into sid from public.schedules where date = '2026-10-13';

  roster := '[
    {"team":"red",   "name":"Satrio","paid":true},
    {"team":"red",   "name":"Virna", "paid":true},
    {"team":"red",   "name":"Andre", "paid":false},
    {"team":"red",   "name":"Ryan",  "paid":false},
    {"team":"red",   "name":"Fatir", "paid":true},
    {"team":"red",   "name":"Ocid",  "paid":false},
    {"team":"blue",  "name":"Rifal", "paid":false},
    {"team":"blue",  "name":"Anisa", "paid":false},
    {"team":"blue",  "name":"Adit",  "paid":false},
    {"team":"blue",  "name":"Yudi",  "paid":false},
    {"team":"blue",  "name":"Miko",  "paid":false},
    {"team":"blue",  "name":"Chamdan","paid":false},
    {"team":"yellow","name":"Niko",  "paid":false},
    {"team":"yellow","name":"Jason", "paid":false},
    {"team":"yellow","name":"Jimmy", "paid":false},
    {"team":"yellow","name":"Rafli", "paid":false},
    {"team":"yellow","name":"Poku",  "paid":false},
    {"team":"yellow","name":"Gilang","paid":false},
    {"team":"green", "name":"Gavin", "paid":false},
    {"team":"green", "name":"Candra","paid":false},
    {"team":"green", "name":"Bimo",  "paid":false},
    {"team":"green", "name":"Udin",  "paid":false},
    {"team":"green", "name":"Bagas", "paid":false},
    {"team":"green", "name":"Sagab", "paid":true}
  ]'::jsonb;
  for rec in select * from jsonb_to_recordset(roster) as x(team text, name text, paid boolean) loop
    perform public.register_player(sid, rec.team, rec.name);
    update public.players set paid = rec.paid
      where schedule_id = sid and name_normalized = lower(btrim(regexp_replace(rec.name,'\s+',' ','g')));
  end loop;

  -- ===== JADWAL 2: 20 Oktober 2026 =====
  insert into public.schedules (date, start_time, end_time, location, status)
  values ('2026-10-20','20:00','22:00','Unggul Sport Center','active')
  on conflict (date) do update set status = 'active';
  select id into sid from public.schedules where date = '2026-10-20';

  roster := '[
    {"team":"red",   "name":"Satrio","paid":true},
    {"team":"red",   "name":"Andre", "paid":false},
    {"team":"red",   "name":"Ryan",  "paid":false},
    {"team":"red",   "name":"Fatir", "paid":false},
    {"team":"red",   "name":"Ocid",  "paid":false},
    {"team":"red",   "name":"Candra","paid":false},
    {"team":"blue",  "name":"Rifal", "paid":false},
    {"team":"blue",  "name":"Anisa", "paid":false},
    {"team":"blue",  "name":"Adit",  "paid":false},
    {"team":"blue",  "name":"Yudi",  "paid":false},
    {"team":"blue",  "name":"Arif",  "paid":false},
    {"team":"blue",  "name":"Miko",  "paid":false},
    {"team":"yellow","name":"Niko",  "paid":false},
    {"team":"yellow","name":"Jason", "paid":false},
    {"team":"yellow","name":"Jimmy", "paid":false},
    {"team":"yellow","name":"Rafli", "paid":false},
    {"team":"yellow","name":"Gilang","paid":false},
    {"team":"yellow","name":"Sagab", "paid":true},
    {"team":"green", "name":"Wijay", "paid":false},
    {"team":"green", "name":"Lambe", "paid":false},
    {"team":"green", "name":"Pak Sulis","paid":false},
    {"team":"green", "name":"Pak Anton","paid":false},
    {"team":"green", "name":"Bondet","paid":false},
    {"team":"green", "name":"Kacong","paid":false}
  ]'::jsonb;
  for rec in select * from jsonb_to_recordset(roster) as x(team text, name text, paid boolean) loop
    perform public.register_player(sid, rec.team, rec.name);
    update public.players set paid = rec.paid
      where schedule_id = sid and name_normalized = lower(btrim(regexp_replace(rec.name,'\s+',' ','g')));
  end loop;

  -- ===== JADWAL 3: 27 Oktober 2026 (BARU) =====
  insert into public.schedules (date, start_time, end_time, location, status)
  values ('2026-10-27','20:00','22:00','Unggul Sport Center','active')
  on conflict (date) do update set status = 'active';
  select id into sid from public.schedules where date = '2026-10-27';

  roster := '[
    {"team":"red",   "name":"Satrio","paid":true},
    {"team":"red",   "name":"Gigih", "paid":true},
    {"team":"red",   "name":"Andis", "paid":false},
    {"team":"red",   "name":"Sagab", "paid":true},
    {"team":"red",   "name":"Jordan","paid":false},
    {"team":"red",   "name":"Pucil", "paid":true},
    {"team":"blue",  "name":"Gale",  "paid":true},
    {"team":"blue",  "name":"Bimo",  "paid":false},
    {"team":"blue",  "name":"Kemon", "paid":false},
    {"team":"blue",  "name":"Imron", "paid":false},
    {"team":"blue",  "name":"Dendy", "paid":false},
    {"team":"blue",  "name":"Nia",   "paid":false},
    {"team":"yellow","name":"Niko",  "paid":false},
    {"team":"yellow","name":"Mb. Anggi","paid":false},
    {"team":"yellow","name":"Jason", "paid":false},
    {"team":"yellow","name":"Awio",  "paid":false},
    {"team":"yellow","name":"Indra Hasan","paid":false},
    {"team":"yellow","name":"Ari",   "paid":true},
    {"team":"green", "name":"Anisa", "paid":false},
    {"team":"green", "name":"Rifal", "paid":false},
    {"team":"green", "name":"Safi i","paid":false},
    {"team":"green", "name":"Adit",  "paid":false},
    {"team":"green", "name":"Ocid",  "paid":false},
    {"team":"green", "name":"Fatir", "paid":false}
  ]'::jsonb;
  for rec in select * from jsonb_to_recordset(roster) as x(team text, name text, paid boolean) loop
    perform public.register_player(sid, rec.team, rec.name);
    update public.players set paid = rec.paid
      where schedule_id = sid and name_normalized = lower(btrim(regexp_replace(rec.name,'\s+',' ','g')));
  end loop;
end $$;
