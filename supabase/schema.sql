-- Dhongi database schema (Supabase / Postgres 15+)
-- Run this once in the Supabase SQL editor of a fresh project.
--
-- Design:
--   * rooms, players, clues are readable by anyone with the room id (needed for realtime).
--   * player_tokens, room_jar, roles, votes are PRIVATE: RLS on with no policies,
--     so the browser can never read who the Dhongi is or what the word is.
--   * Every action is a SECURITY DEFINER function that checks the player's token.

-- ---------- tables ----------
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  host_id uuid,
  status text not null default 'lobby' check (status in ('lobby','clues','voting','result')),
  max_rounds int not null default 3 check (max_rounds between 1 and 7),
  impostor_count int not null default 1 check (impostor_count between 1 and 2),
  director_view boolean not null default false,
  word_count int not null default 0,
  game_no int not null default 0,
  round int not null default 0,
  turn_idx int not null default 0,
  turn_order uuid[] not null default '{}',
  result text check (result in ('innocents','impostor')),
  reveal_word text,
  reveal_impostors uuid[],
  voted_out uuid,
  vote_tally jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 20),
  is_spectator boolean not null default false,
  has_voted boolean not null default false,
  kicked boolean not null default false,
  joined_at timestamptz not null default now()
);
create unique index players_room_name on public.players (room_id, lower(name)) where not kicked;

create table public.clues (
  id bigserial primary key,
  room_id uuid not null references public.rooms(id) on delete cascade,
  game_no int not null,
  round int not null,
  player_id uuid not null references public.players(id) on delete cascade,
  clue text not null,
  created_at timestamptz not null default now()
);
create index clues_room_game on public.clues (room_id, game_no);

create table public.player_tokens (
  player_id uuid primary key references public.players(id) on delete cascade,
  token text not null
);
create table public.room_jar (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  words text[] not null default '{}',
  used text[] not null default '{}'
);
create table public.roles (
  room_id uuid not null references public.rooms(id) on delete cascade,
  game_no int not null,
  player_id uuid not null references public.players(id) on delete cascade,
  is_impostor boolean not null,
  word text not null,
  primary key (room_id, game_no, player_id)
);
create table public.votes (
  room_id uuid not null references public.rooms(id) on delete cascade,
  game_no int not null,
  voter_id uuid not null references public.players(id) on delete cascade,
  target_id uuid not null references public.players(id) on delete cascade,
  primary key (room_id, game_no, voter_id)
);

alter table public.rooms enable row level security;
alter table public.players enable row level security;
alter table public.clues enable row level security;
alter table public.player_tokens enable row level security;
alter table public.room_jar enable row level security;
alter table public.roles enable row level security;
alter table public.votes enable row level security;

create policy "read rooms" on public.rooms for select to anon, authenticated using (true);
create policy "read players" on public.players for select to anon, authenticated using (true);
create policy "read clues" on public.clues for select to anon, authenticated using (true);

revoke all on public.player_tokens, public.room_jar, public.roles, public.votes from anon, authenticated;
revoke insert, update, delete on public.rooms, public.players, public.clues from anon, authenticated;

alter publication supabase_realtime add table public.rooms, public.players, public.clues;

-- ---------- internal helpers ----------
create or replace function public._auth(p_player uuid, p_token text)
returns public.players language plpgsql security definer set search_path = public as $$
declare p public.players;
begin
  select pl.* into p from players pl join player_tokens t on t.player_id = pl.id
   where pl.id = p_player and t.token = p_token;
  if not found then raise exception 'Not in this room' using errcode = 'P0001'; end if;
  if p.kicked then raise exception 'You were removed from this room' using errcode = 'P0001'; end if;
  return p;
end $$;

create or replace function public._host(p_player uuid, p_token text)
returns public.rooms language plpgsql security definer set search_path = public as $$
declare p public.players; r public.rooms;
begin
  p := _auth(p_player, p_token);
  select * into r from rooms where id = p.room_id for update;
  if r.host_id <> p.id then raise exception 'Only the host can do that' using errcode = 'P0001'; end if;
  return r;
end $$;

create or replace function public._new_code()
returns text language plpgsql security definer set search_path = public as $$
declare chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; c text; i int;
begin
  loop
    c := '';
    for i in 1..5 loop c := c || substr(chars, 1 + floor(random()*length(chars))::int, 1); end loop;
    exit when not exists (select 1 from rooms where code = c);
  end loop;
  return c;
end $$;

create or replace function public._clean_name(n text)
returns text language sql immutable set search_path = public as $$
  select left(regexp_replace(trim(coalesce(n,'')), '\s+', ' ', 'g'), 20)
$$;

create or replace function public._finish(p_room uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r public.rooms; top_n int; top_ids uuid[]; out_id uuid; caught boolean; tally jsonb;
begin
  select * into r from rooms where id = p_room for update;
  if r.status = 'result' then return; end if;
  select coalesce(jsonb_object_agg(target_id, c), '{}'::jsonb) into tally
    from (select target_id, count(*) c from votes where room_id = r.id and game_no = r.game_no group by target_id) s;
  select max(c) into top_n from (select count(*) c from votes where room_id = r.id and game_no = r.game_no group by target_id) s;
  select array_agg(target_id) into top_ids from (
    select target_id, count(*) c from votes where room_id = r.id and game_no = r.game_no group by target_id) s
   where c = top_n;
  -- a tie or no votes means nobody is voted out, so the Dhongi escapes
  if top_ids is not null and array_length(top_ids,1) = 1 then out_id := top_ids[1]; end if;
  caught := out_id is not null and exists (
    select 1 from roles where room_id = r.id and game_no = r.game_no and player_id = out_id and is_impostor);
  update rooms set status = 'result',
                   result = case when caught then 'innocents' else 'impostor' end,
                   voted_out = out_id,
                   vote_tally = tally,
                   reveal_word = (select word from roles where room_id = r.id and game_no = r.game_no limit 1),
                   reveal_impostors = (select array_agg(player_id) from roles where room_id = r.id and game_no = r.game_no and is_impostor),
                   updated_at = now()
   where id = r.id;
end $$;

create or replace function public._fix_turn(p_room uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r public.rooms; n int;
begin
  select * into r from rooms where id = p_room for update;
  n := coalesce(array_length(r.turn_order,1),0);
  if n < 2 then perform _finish(p_room); return; end if;
  if r.turn_idx >= n then
    if r.round >= r.max_rounds then
      update rooms set status = 'voting', updated_at = now() where id = p_room;
    else
      update rooms set round = round + 1, turn_idx = 0, updated_at = now() where id = p_room;
    end if;
  end if;
end $$;

create or replace function public._advance(p_room uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update rooms set turn_idx = turn_idx + 1, updated_at = now() where id = p_room;
  perform _fix_turn(p_room);
end $$;

create or replace function public._maybe_finish_vote(p_room uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r public.rooms; need int; got int;
begin
  select * into r from rooms where id = p_room;
  if r.status <> 'voting' then return; end if;
  select count(*) into need from roles ro join players p on p.id = ro.player_id
   where ro.room_id = r.id and ro.game_no = r.game_no and not p.kicked;
  select count(*) into got from votes v join players p on p.id = v.voter_id
   where v.room_id = r.id and v.game_no = r.game_no and not p.kicked;
  if got >= need then perform _finish(p_room); end if;
end $$;

-- ---------- rooms + players ----------
create or replace function public.create_room(p_name text)
returns json language plpgsql security definer set search_path = public as $$
declare r public.rooms; pid uuid; tok text := gen_random_uuid()::text; nm text := _clean_name(p_name);
begin
  if nm = '' then raise exception 'Enter your name' using errcode = 'P0001'; end if;
  insert into rooms (code) values (_new_code()) returning * into r;
  insert into players (room_id, name) values (r.id, nm) returning id into pid;
  insert into player_tokens values (pid, tok);
  insert into room_jar (room_id) values (r.id);
  update rooms set host_id = pid where id = r.id;
  return json_build_object('room_id', r.id, 'code', r.code, 'player_id', pid, 'token', tok);
end $$;

create or replace function public.join_room(p_code text, p_name text, p_spectator boolean default false)
returns json language plpgsql security definer set search_path = public as $$
declare r public.rooms; pid uuid; tok text := gen_random_uuid()::text; nm text := _clean_name(p_name);
begin
  if nm = '' then raise exception 'Enter your name' using errcode = 'P0001'; end if;
  select * into r from rooms where code = upper(trim(p_code));
  if not found then raise exception 'Room not found. Check the code.' using errcode = 'P0001'; end if;
  if exists (select 1 from players where room_id = r.id and lower(name) = lower(nm) and not kicked) then
    raise exception 'That name is taken in this room' using errcode = 'P0001'; end if;
  if (select count(*) from players where room_id = r.id and not kicked) >= 40 then
    raise exception 'Room is full' using errcode = 'P0001'; end if;
  insert into players (room_id, name, is_spectator) values (r.id, nm, coalesce(p_spectator,false)) returning id into pid;
  insert into player_tokens values (pid, tok);
  return json_build_object('room_id', r.id, 'code', r.code, 'player_id', pid, 'token', tok);
end $$;

create or replace function public.set_spectator(p_player uuid, p_token text, p_spectator boolean)
returns void language plpgsql security definer set search_path = public as $$
declare p public.players;
begin
  p := _auth(p_player, p_token);
  update players set is_spectator = p_spectator where id = p.id;
end $$;

create or replace function public.kick_player(p_player uuid, p_token text, p_target uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r public.rooms; pos int;
begin
  r := _host(p_player, p_token);
  if p_target = r.host_id then raise exception 'Host cannot remove themselves' using errcode = 'P0001'; end if;
  update players set kicked = true where id = p_target and room_id = r.id;
  pos := array_position(r.turn_order, p_target);
  update rooms set turn_order = array_remove(turn_order, p_target),
    turn_idx = case when r.status = 'clues' and pos is not null and pos < r.turn_idx + 1 then turn_idx - 1 else turn_idx end,
    updated_at = now() where id = r.id;
  if r.status = 'clues' then perform _fix_turn(r.id); end if;
  if r.status = 'voting' then perform _maybe_finish_vote(r.id); end if;
end $$;

-- ---------- settings + the jar ----------
create or replace function public.set_settings(p_player uuid, p_token text, p_rounds int, p_impostors int, p_director boolean)
returns void language plpgsql security definer set search_path = public as $$
declare r public.rooms;
begin
  r := _host(p_player, p_token);
  update rooms set max_rounds = greatest(1, least(7, p_rounds)),
                   impostor_count = greatest(1, least(2, p_impostors)),
                   director_view = coalesce(p_director, false),
                   updated_at = now()
   where id = r.id;
end $$;

create or replace function public.set_words(p_player uuid, p_token text, p_words text)
returns int language plpgsql security definer set search_path = public as $$
declare r public.rooms; arr text[];
begin
  r := _host(p_player, p_token);
  select coalesce(array_agg(w), '{}') into arr from (
    select distinct on (lower(left(trim(x),30))) left(trim(x), 30) as w
      from regexp_split_to_table(coalesce(p_words,''), '[\n,;]+') as x
     where trim(x) <> ''
  ) s;
  insert into room_jar (room_id, words, used) values (r.id, arr, '{}')
    on conflict (room_id) do update set words = excluded.words, used = '{}';
  update rooms set word_count = coalesce(array_length(arr,1),0), updated_at = now() where id = r.id;
  return coalesce(array_length(arr,1),0);
end $$;

-- ---------- game flow ----------
create or replace function public.start_game(p_player uuid, p_token text)
returns void language plpgsql security definer set search_path = public as $$
declare r public.rooms; j public.room_jar; avail text[]; word text; ids uuid[]; n int; k int; g int;
begin
  r := _host(p_player, p_token);
  if r.status in ('clues','voting') then raise exception 'A game is already running' using errcode = 'P0001'; end if;
  select array_agg(id order by random()) into ids
    from players where room_id = r.id and not kicked and not is_spectator;
  n := coalesce(array_length(ids,1), 0);
  if n < 3 then raise exception 'Need at least 3 players (not counting spectators)' using errcode = 'P0001'; end if;
  select * into j from room_jar where room_id = r.id for update;
  if j is null or coalesce(array_length(j.words,1),0) = 0 then
    raise exception 'Add some words to the jar first' using errcode = 'P0001'; end if;
  select coalesce(array_agg(x), '{}') into avail from unnest(j.words) x where not (x = any(j.used));
  if coalesce(array_length(avail,1),0) = 0 then
    avail := j.words; update room_jar set used = '{}' where room_id = r.id;   -- jar empty: refill
  end if;
  word := avail[1 + floor(random() * array_length(avail,1))::int];
  update room_jar set used = array_append(used, word) where room_id = r.id;
  k := case when r.impostor_count = 2 and n >= 7 then 2 else 1 end;
  g := r.game_no + 1;
  insert into roles (room_id, game_no, player_id, is_impostor, word)
  select r.id, g, pid, rn <= k, word
    from (select pid, row_number() over (order by random()) rn from unnest(ids) pid) s;
  update players set has_voted = false where room_id = r.id;
  update rooms set status = 'clues', game_no = g, round = 1, turn_idx = 0, turn_order = ids,
                   result = null, reveal_word = null, reveal_impostors = null, voted_out = null,
                   vote_tally = null, updated_at = now()
   where id = r.id;
end $$;

-- only ever returns YOUR word
create or replace function public.my_card(p_player uuid, p_token text)
returns json language plpgsql security definer set search_path = public as $$
declare p public.players; r public.rooms; ro public.roles;
begin
  p := _auth(p_player, p_token);
  select * into r from rooms where id = p.room_id;
  if r.game_no = 0 then return json_build_object('state','lobby'); end if;
  select * into ro from roles where room_id = r.id and game_no = r.game_no and player_id = p.id;
  if found then
    return json_build_object('state','player', 'game_no', r.game_no, 'is_impostor', ro.is_impostor,
                             'word', case when ro.is_impostor then null else ro.word end);
  end if;
  if r.director_view then
    return json_build_object('state','director', 'game_no', r.game_no,
      'word', (select word from roles where room_id = r.id and game_no = r.game_no limit 1),
      'impostors', (select json_agg(player_id) from roles where room_id = r.id and game_no = r.game_no and is_impostor));
  end if;
  return json_build_object('state','watcher', 'game_no', r.game_no);
end $$;

create or replace function public.submit_clue(p_player uuid, p_token text, p_clue text)
returns void language plpgsql security definer set search_path = public as $$
declare p public.players; r public.rooms; ro public.roles; c text; cn text; wn text;
begin
  p := _auth(p_player, p_token);
  select * into r from rooms where id = p.room_id for update;
  if r.status <> 'clues' then raise exception 'Not the clue phase' using errcode = 'P0001'; end if;
  if r.turn_order[r.turn_idx + 1] is distinct from p.id then
    raise exception 'Wait for your turn' using errcode = 'P0001'; end if;
  c := left(regexp_replace(trim(coalesce(p_clue,'')), '\s+', ' ', 'g'), 30);
  if c = '' then raise exception 'Type a clue' using errcode = 'P0001'; end if;
  select * into ro from roles where room_id = r.id and game_no = r.game_no and player_id = p.id;
  -- innocents can't type the secret word (the Dhongi isn't blocked, or the error would leak it)
  if not ro.is_impostor then
    cn := regexp_replace(lower(c), '[^[:alnum:]]', '', 'g');
    wn := regexp_replace(lower(ro.word), '[^[:alnum:]]', '', 'g');
    if wn <> '' and position(wn in cn) > 0 then
      raise exception 'Too close! You can''t say the secret word.' using errcode = 'P0001';
    end if;
  end if;
  insert into clues (room_id, game_no, round, player_id, clue) values (r.id, r.game_no, r.round, p.id, c);
  perform _advance(r.id);
end $$;

create or replace function public.skip_turn(p_player uuid, p_token text)
returns void language plpgsql security definer set search_path = public as $$
declare r public.rooms;
begin
  r := _host(p_player, p_token);
  if r.status <> 'clues' then raise exception 'Not the clue phase' using errcode = 'P0001'; end if;
  insert into clues (room_id, game_no, round, player_id, clue)
    values (r.id, r.game_no, r.round, r.turn_order[r.turn_idx + 1], '⏭ skipped');
  perform _advance(r.id);
end $$;

create or replace function public.go_to_vote(p_player uuid, p_token text)
returns void language plpgsql security definer set search_path = public as $$
declare r public.rooms;
begin
  r := _host(p_player, p_token);
  if r.status <> 'clues' then raise exception 'Not the clue phase' using errcode = 'P0001'; end if;
  update rooms set status = 'voting', updated_at = now() where id = r.id;
end $$;

create or replace function public.cast_vote(p_player uuid, p_token text, p_target uuid)
returns void language plpgsql security definer set search_path = public as $$
declare p public.players; r public.rooms;
begin
  p := _auth(p_player, p_token);
  select * into r from rooms where id = p.room_id for update;
  if r.status <> 'voting' then raise exception 'Voting is not open' using errcode = 'P0001'; end if;
  if not exists (select 1 from roles where room_id = r.id and game_no = r.game_no and player_id = p.id) then
    raise exception 'Only players in this game can vote' using errcode = 'P0001'; end if;
  if p_target = p.id then raise exception 'You can''t vote for yourself' using errcode = 'P0001'; end if;
  if not exists (select 1 from roles ro join players pl on pl.id = ro.player_id
                  where ro.room_id = r.id and ro.game_no = r.game_no and ro.player_id = p_target and not pl.kicked) then
    raise exception 'That player is not in this game' using errcode = 'P0001'; end if;
  insert into votes values (r.id, r.game_no, p.id, p_target)
    on conflict (room_id, game_no, voter_id) do update set target_id = excluded.target_id;
  update players set has_voted = true where id = p.id;
  perform _maybe_finish_vote(r.id);
end $$;

create or replace function public.end_vote(p_player uuid, p_token text)
returns void language plpgsql security definer set search_path = public as $$
declare r public.rooms;
begin
  r := _host(p_player, p_token);
  if r.status <> 'voting' then raise exception 'Voting is not open' using errcode = 'P0001'; end if;
  perform _finish(r.id);
end $$;

create or replace function public.back_to_lobby(p_player uuid, p_token text)
returns void language plpgsql security definer set search_path = public as $$
declare r public.rooms;
begin
  r := _host(p_player, p_token);
  update rooms set status = 'lobby', round = 0, turn_idx = 0, turn_order = '{}', updated_at = now() where id = r.id;
end $$;

-- internal helpers must not be callable from the browser
revoke execute on function public._finish(uuid) from public, anon, authenticated;
revoke execute on function public._fix_turn(uuid) from public, anon, authenticated;
revoke execute on function public._advance(uuid) from public, anon, authenticated;
revoke execute on function public._maybe_finish_vote(uuid) from public, anon, authenticated;
revoke execute on function public._auth(uuid, text) from public, anon, authenticated;
revoke execute on function public._host(uuid, text) from public, anon, authenticated;
revoke execute on function public._new_code() from public, anon, authenticated;
revoke execute on function public._clean_name(text) from public, anon, authenticated;
