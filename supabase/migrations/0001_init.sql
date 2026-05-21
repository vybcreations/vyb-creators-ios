-- VYB Creators — initial schema
-- Tables: profiles, tasks, habits, habit_checkins, books, reading_notes,
--         ideas, focus_sessions, friendships.
-- All tables have RLS enabled. Default policy: each user sees & mutates
-- only their own rows. Friendships and profile visibility relax this.

-- ─── Extensions ───────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── Helper: auto-update updated_at column ────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ─── profiles (1-to-1 with auth.users) ────────────────────
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text unique,                  -- vyb.app/<username>
  display_name text,
  bio          text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── tasks ────────────────────────────────────────────────
create table public.tasks (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  title        text not null,
  category     text,                          -- launch / work / writing / life / inbox
  priority     int  not null default 0,       -- 0 = normal, 1 = urgent
  bucket       text not null default 'inbox', -- today / soon / later / inbox / done
  done         boolean not null default false,
  done_at      timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index tasks_user_idx on public.tasks(user_id, done, created_at desc);
create trigger tasks_updated before update on public.tasks
  for each row execute function public.set_updated_at();

-- ─── habits ───────────────────────────────────────────────
create table public.habits (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  category     text,                          -- mind / body / focus
  time_of_day  text,                          -- "8:00am" / "all day"
  archived     boolean not null default false,
  created_at   timestamptz not null default now()
);
create index habits_user_idx on public.habits(user_id, archived);

-- daily check-ins
create table public.habit_checkins (
  id          uuid primary key default uuid_generate_v4(),
  habit_id    uuid not null references public.habits(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null,
  done        boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (habit_id, date)
);
create index habit_checkins_user_idx on public.habit_checkins(user_id, date desc);

-- ─── books / reading ──────────────────────────────────────
create table public.books (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  title         text not null,
  author        text,
  total_pages   int,
  current_page  int not null default 0,
  status        text not null default 'reading',  -- reading / next / done
  cover_tone    text not null default 'midnight', -- midnight / forest / gold / dusk / aurora
  started_at    timestamptz,
  finished_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index books_user_idx on public.books(user_id, status, updated_at desc);
create trigger books_updated before update on public.books
  for each row execute function public.set_updated_at();

create table public.reading_notes (
  id          uuid primary key default uuid_generate_v4(),
  book_id     uuid not null references public.books(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  body        text not null,
  page        int,
  created_at  timestamptz not null default now()
);
create index reading_notes_book_idx on public.reading_notes(book_id, created_at desc);

-- ─── ideas (capture) ──────────────────────────────────────
create table public.ideas (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  body        text not null,
  tag         text,                            -- product / writing / business / ...
  created_at  timestamptz not null default now()
);
create index ideas_user_idx on public.ideas(user_id, created_at desc);

-- ─── focus_sessions ───────────────────────────────────────
create table public.focus_sessions (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  task_id           uuid references public.tasks(id) on delete set null,
  duration_seconds  int not null,           -- planned duration
  elapsed_seconds   int not null default 0, -- actual elapsed when ended
  completed         boolean not null default false,
  started_at        timestamptz not null default now(),
  ended_at          timestamptz
);
create index focus_sessions_user_idx on public.focus_sessions(user_id, started_at desc);

-- ─── friendships ──────────────────────────────────────────
create table public.friendships (
  id          uuid primary key default uuid_generate_v4(),
  requester   uuid not null references auth.users(id) on delete cascade,
  addressee   uuid not null references auth.users(id) on delete cascade,
  status      text not null default 'pending',  -- pending / accepted / blocked
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (requester, addressee),
  check (requester <> addressee)
);
create index friendships_requester_idx on public.friendships(requester, status);
create index friendships_addressee_idx on public.friendships(addressee, status);
create trigger friendships_updated before update on public.friendships
  for each row execute function public.set_updated_at();

-- ╔════════════════════════════════════════════════════════╗
-- ║ Row-Level Security                                     ║
-- ╚════════════════════════════════════════════════════════╝

alter table public.profiles       enable row level security;
alter table public.tasks          enable row level security;
alter table public.habits         enable row level security;
alter table public.habit_checkins enable row level security;
alter table public.books          enable row level security;
alter table public.reading_notes  enable row level security;
alter table public.ideas          enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.friendships    enable row level security;

-- ─── profiles policies ────────────────────────────────────
-- Anyone authenticated can read any profile (needed for friend search).
create policy "profiles are readable by authenticated users"
  on public.profiles for select to authenticated using (true);
create policy "users can update own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);
-- Inserts handled by the trigger (security definer), no policy needed.

-- ─── owner-only policies (private tables) ─────────────────
-- A small macro: for each private table apply the same 4 policies.
do $$
declare t text;
begin
  for t in
    select unnest(array[
      'tasks','habits','habit_checkins','books','reading_notes','ideas','focus_sessions'
    ])
  loop
    execute format($f$
      create policy "%1$s owner select" on public.%1$I
        for select to authenticated using (auth.uid() = user_id);
      create policy "%1$s owner insert" on public.%1$I
        for insert to authenticated with check (auth.uid() = user_id);
      create policy "%1$s owner update" on public.%1$I
        for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
      create policy "%1$s owner delete" on public.%1$I
        for delete to authenticated using (auth.uid() = user_id);
    $f$, t);
  end loop;
end $$;

-- ─── friendships policies ────────────────────────────────
-- Users see rows where they're requester OR addressee.
create policy "friendships visible to participants"
  on public.friendships for select to authenticated
  using (auth.uid() = requester or auth.uid() = addressee);
create policy "users can request friendship"
  on public.friendships for insert to authenticated
  with check (auth.uid() = requester);
create policy "participants can update friendship status"
  on public.friendships for update to authenticated
  using (auth.uid() = requester or auth.uid() = addressee);
create policy "participants can delete friendship"
  on public.friendships for delete to authenticated
  using (auth.uid() = requester or auth.uid() = addressee);
