-- Access control for Dhongi (run after schema.sql and ai.sql)
--   * Only people with an active host code can create rooms
--   * Everyone who joins by link waits until the host lets them in
--   * Hosts can lock a room so nobody new can knock
--   * The owner manages codes from the ?admin page with an admin code

alter table public.players add column if not exists pending boolean not null default false;
alter table public.players add column if not exists declined boolean not null default false;
alter table public.rooms add column if not exists locked boolean not null default false;

create table if not exists public.host_codes (
  code text primary key,
  label text not null default '',
  is_admin boolean not null default false,
  active boolean not null default true,
  uses int not null default 0,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
alter table public.host_codes enable row level security;
revoke all on public.host_codes from anon, authenticated;

create or replace function public._norm_code(c text)
returns text language sql immutable set search_path = public as $$
  select upper(regexp_replace(coalesce(c,''), '[^A-Za-z0-9]', '', 'g'))
$$;

create or replace function public._gen_host_code()
returns text language plpgsql security definer set search_path = public as $$
declare chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; c text; i int;
begin
  loop
    c := '';
    for i in 1..8 loop c := c || substr(chars, 1 + floor(random()*length(chars))::int, 1); end loop;
    exit when not exists (select 1 from host_codes where code = c);
  end loop;
  return c;
end $$;

create or replace function public._admin(p_admin text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from host_codes where code = _norm_code(p_admin) and is_admin and active) then
    raise exception 'That admin code isn''t right' using errcode = 'P0001';
  end if;
end $$;

-- pending players can't act until let in
create or replace function public._auth(p_player uuid, p_token text)
returns public.players language plpgsql security definer set search_path = public as $$
declare p public.players;
begin
  select pl.* into p from players pl join player_tokens t on t.player_id = pl.id
   where pl.id = p_player and t.token = p_token;
  if not found then raise exception 'Not in this room' using errcode = 'P0001'; end if;
  if p.kicked then raise exception 'You were removed from this room' using errcode = 'P0001'; end if;
  if p.pending then raise exception 'Waiting for the host to let you in' using errcode = 'P0001'; end if;
  return p;
end $$;

create or replace function public.create_room(p_name text, p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare r public.rooms; pid uuid; tok text := gen_random_uuid()::text; nm text := _clean_name(p_name); hc text := _norm_code(p_code);
begin
  if nm = '' then raise exception 'Enter your name' using errcode = 'P0001'; end if;
  if hc = '' then raise exception 'Enter your host code to start a room' using errcode = 'P0001'; end if;
  update host_codes set uses = uses + 1, last_used_at = now() where code = hc and active;
  if not found then raise exception 'That host code isn''t valid. Ask the game owner for one.' using errcode = 'P0001'; end if;
  insert into rooms (code) values (_new_code()) returning * into r;
  insert into players (room_id, name) values (r.id, nm) returning id into pid;
  insert into player_tokens values (pid, tok);
  insert into room_jar (room_id) values (r.id);
  update rooms set host_id = pid where id = r.id;
  return json_build_object('room_id', r.id, 'code', r.code, 'player_id', pid, 'token', tok);
end $$;

-- the old one-argument create_room would bypass host codes
revoke execute on function public.create_room(text) from public, anon, authenticated;

create or replace function public.join_room(p_code text, p_name text, p_spectator boolean default false)
returns json language plpgsql security definer set search_path = public as $$
declare r public.rooms; pid uuid; tok text := gen_random_uuid()::text; nm text := _clean_name(p_name);
begin
  if nm = '' then raise exception 'Enter your name' using errcode = 'P0001'; end if;
  select * into r from rooms where code = upper(trim(p_code));
  if not found then raise exception 'Room not found. Check the code.' using errcode = 'P0001'; end if;
  if r.locked then raise exception 'This room is locked. Ask the host to unlock it.' using errcode = 'P0001'; end if;
  if exists (select 1 from players where room_id = r.id and lower(name) = lower(nm) and not kicked) then
    raise exception 'That name is taken in this room' using errcode = 'P0001'; end if;
  if (select count(*) from players where room_id = r.id and not kicked and pending) >= 10 then
    raise exception 'Too many people are waiting to join. Try again in a minute.' using errcode = 'P0001'; end if;
  if (select count(*) from players where room_id = r.id and not kicked) >= 40 then
    raise exception 'Room is full' using errcode = 'P0001'; end if;
  insert into players (room_id, name, is_spectator, pending)
    values (r.id, nm, coalesce(p_spectator,false), true) returning id into pid;
  insert into player_tokens values (pid, tok);
  return json_build_object('room_id', r.id, 'code', r.code, 'player_id', pid, 'token', tok);
end $$;

create or replace function public.respond_join(p_player uuid, p_token text, p_target uuid, p_allow boolean)
returns void language plpgsql security definer set search_path = public as $$
declare r public.rooms;
begin
  r := _host(p_player, p_token);
  if p_allow then
    update players set pending = false where id = p_target and room_id = r.id and pending and not kicked;
  else
    update players set kicked = true, declined = true where id = p_target and room_id = r.id and pending;
  end if;
end $$;

create or replace function public.set_lock(p_player uuid, p_token text, p_locked boolean)
returns void language plpgsql security definer set search_path = public as $$
declare r public.rooms;
begin
  r := _host(p_player, p_token);
  update rooms set locked = coalesce(p_locked, false), updated_at = now() where id = r.id;
  if p_locked then
    update players set kicked = true, declined = true where room_id = r.id and pending and not kicked;
  end if;
end $$;

-- my_card answers someone still knocking without revealing anything about the game
create or replace function public.my_card(p_player uuid, p_token text)
returns json language plpgsql security definer set search_path = public as $$
declare p public.players; r public.rooms; ro public.roles;
begin
  select pl.* into p from players pl join player_tokens t on t.player_id = pl.id
   where pl.id = p_player and t.token = p_token;
  if not found then raise exception 'Not in this room' using errcode = 'P0001'; end if;
  if p.kicked then return json_build_object('state', case when p.declined then 'declined' else 'removed' end); end if;
  if p.pending then return json_build_object('state','pending'); end if;
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

-- start_game and add_bot also skip pending players (`and not pending` in their player queries)

create or replace function public.admin_list_codes(p_admin text)
returns json language plpgsql security definer set search_path = public as $$
begin
  perform _admin(p_admin);
  return coalesce((select json_agg(json_build_object('code', code, 'label', label, 'is_admin', is_admin,
            'active', active, 'uses', uses, 'created_at', created_at, 'last_used_at', last_used_at)
            order by is_admin desc, active desc, created_at desc) from host_codes), '[]'::json);
end $$;

create or replace function public.admin_create_code(p_admin text, p_label text, p_is_admin boolean default false)
returns text language plpgsql security definer set search_path = public as $$
declare c text;
begin
  perform _admin(p_admin);
  c := _gen_host_code();
  insert into host_codes (code, label, is_admin) values (c, left(trim(coalesce(p_label,'')), 40), coalesce(p_is_admin, false));
  return c;
end $$;

create or replace function public.admin_set_active(p_admin text, p_code text, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform _admin(p_admin);
  if _norm_code(p_code) = _norm_code(p_admin) and not p_active then
    raise exception 'You can''t switch off the admin code you''re using' using errcode = 'P0001';
  end if;
  update host_codes set active = p_active where code = _norm_code(p_code);
end $$;

revoke execute on function public._norm_code(text) from public, anon, authenticated;
revoke execute on function public._gen_host_code() from public, anon, authenticated;
revoke execute on function public._admin(text) from public, anon, authenticated;

-- First admin code: create it once by hand in the SQL editor, then use the ?admin page.
-- insert into host_codes (code, label, is_admin) values (_gen_host_code() || _gen_host_code(), 'Owner', true);
