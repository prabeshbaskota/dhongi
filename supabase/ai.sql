-- AI additions for Dhongi (run after schema.sql)

alter table public.players add column if not exists is_bot boolean not null default false;
alter table public.rooms add column if not exists roast text;
alter table public.rooms add column if not exists ai_calls int not null default 0;
alter table public.rooms add column if not exists ai_day date not null default current_date;

-- Host adds an AI player. Only for small groups: fewer than 3 humans, max 2 bots.
create or replace function public.add_bot(p_player uuid, p_token text)
returns json language plpgsql security definer set search_path = public as $$
declare r public.rooms; humans int; bots int; nm text; pid uuid;
begin
  r := _host(p_player, p_token);
  if r.status in ('clues','voting') then raise exception 'Add bots between games' using errcode = 'P0001'; end if;
  select count(*) filter (where not is_bot), count(*) filter (where is_bot) into humans, bots
    from players where room_id = r.id and not kicked and not is_spectator;
  if humans >= 3 then raise exception 'Bots are only for small groups. You already have 3+ players.' using errcode = 'P0001'; end if;
  if bots >= 2 then raise exception 'Two bots is the limit' using errcode = 'P0001'; end if;
  select n into nm from unnest(array['Robo Raju','Bot Bimala','Chatpate Bot','Momo-tron','Sahu-ji 3000']) n
   where not exists (select 1 from players where room_id = r.id and lower(name) = lower(n) and not kicked)
   order by random() limit 1;
  insert into players (room_id, name, is_bot) values (r.id, nm, true) returning id into pid;
  insert into player_tokens values (pid, gen_random_uuid()::text);
  return json_build_object('id', pid, 'name', nm);
end $$;

-- start_game, redefined so a new game clears the previous roast
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
    avail := j.words; update room_jar set used = '{}' where room_id = r.id;
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
                   vote_tally = null, roast = null, updated_at = now()
   where id = r.id;
end $$;
