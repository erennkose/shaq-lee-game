-- ============================================================
-- Kadromu Kur — Initial Schema
-- ============================================================

-- ----- PLAYERS -----
create table if not exists public.players (
  id           text primary key,                  -- BALLDONTLIE player id (string)
  full_name    text not null,
  positions    text[] not null,                   -- e.g. {'SG','SF'}
  team         text,                              -- 3-letter abbreviation
  power_rating numeric(5,2) not null default 0,   -- 0-100
  ppg          numeric(5,2),
  rpg          numeric(5,2),
  apg          numeric(5,2),
  updated_at   timestamptz default now()
);

-- ----- COACHES -----
create table if not exists public.coaches (
  id               text primary key,
  full_name        text not null,
  team             text,
  power_rating     numeric(5,2) not null default 0, -- 0-100
  career_win_pct   numeric(5,4),
  playoff_titles   int default 0,
  updated_at       timestamptz default now()
);

-- ----- DAILY ATTEMPTS -----
create table if not exists public.daily_attempts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references auth.users(id) on delete set null,
  nickname           text not null,
  play_date          date not null,
  chosen_player_ids  text[] not null,   -- 6 elements: PG,SG,SF,PF,C,6TH
  chosen_coach_id    text not null,
  team_power         numeric(5,2) not null,
  predicted_wins     int not null,
  created_at         timestamptz default now(),
  -- One official attempt per user per day
  unique (user_id, play_date)
);

-- ----- INDEXES -----
create index if not exists daily_attempts_leaderboard_idx
  on public.daily_attempts (play_date, predicted_wins desc);

create index if not exists alltime_leaderboard_idx
  on public.daily_attempts (predicted_wins desc);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.players enable row level security;
alter table public.coaches enable row level security;
alter table public.daily_attempts enable row level security;

-- Players & Coaches: everyone can read (needed for candidate cards)
create policy "players_select_all"
  on public.players for select using (true);

create policy "coaches_select_all"
  on public.coaches for select using (true);

-- Only service role can write players/coaches (seed scripts)
create policy "players_insert_service"
  on public.players for insert
  to service_role with check (true);

create policy "players_update_service"
  on public.players for update
  to service_role using (true);

create policy "coaches_insert_service"
  on public.coaches for insert
  to service_role with check (true);

create policy "coaches_update_service"
  on public.coaches for update
  to service_role using (true);

-- daily_attempts: users read their own rows; leaderboard reads all
create policy "attempts_select_own"
  on public.daily_attempts for select
  using (auth.uid() = user_id);

-- Allow leaderboard queries (anyone authenticated can see leaderboard rows)
create policy "attempts_select_leaderboard"
  on public.daily_attempts for select
  using (true);

-- Insert: authenticated users only, user_id must match their own
create policy "attempts_insert_own"
  on public.daily_attempts for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Service role can insert for edge functions
create policy "attempts_insert_service"
  on public.daily_attempts for insert
  to service_role with check (true);

-- ============================================================
-- HELPER VIEWS
-- ============================================================

-- Daily leaderboard view
create or replace view public.daily_leaderboard as
select
  da.id,
  da.nickname,
  da.play_date,
  da.predicted_wins,
  da.team_power,
  da.chosen_player_ids,
  da.chosen_coach_id
from public.daily_attempts da
order by da.play_date desc, da.predicted_wins desc;

-- All-time leaderboard view
create or replace view public.alltime_leaderboard as
select
  da.id,
  da.nickname,
  da.play_date,
  da.predicted_wins,
  da.team_power,
  da.chosen_player_ids,
  da.chosen_coach_id
from public.daily_attempts da
order by da.predicted_wins desc;
