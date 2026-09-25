-- Intercambiar dos lugares ocupados requiere que la unicidad se compruebe al
-- terminar ambas actualizaciones, incluso cuando los equipos están llenos.
alter table public.match_players drop constraint match_players_slot_key;
alter table public.match_players add constraint match_players_slot_key
  unique (match_id, team, slot) deferrable initially immediate;

create function public.swap_players(
  p_match_id text, p_first_player_id uuid, p_second_player_id uuid
) returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  v_match public.matches;
  v_first public.match_players;
  v_second public.match_players;
begin
  perform private.require_uid();
  if not private.is_match_admin(p_match_id) then
    raise exception using errcode = '42501', message = 'not_admin';
  end if;

  perform private.lock_match(p_match_id);
  select * into v_match from public.matches m where m.id = p_match_id;
  if v_match.id is null then
    raise exception using errcode = 'P0001', message = 'match_not_found';
  end if;
  if now() >= v_match.starts_at then
    raise exception using errcode = 'P0001', message = 'match_closed';
  end if;
  if p_first_player_id is null or p_second_player_id is null
     or p_first_player_id = p_second_player_id then
    raise exception using errcode = 'P0001', message = 'invalid_swap';
  end if;

  select * into v_first from public.match_players p
    where p.match_id = p_match_id and p.id = p_first_player_id;
  select * into v_second from public.match_players p
    where p.match_id = p_match_id and p.id = p_second_player_id;
  if v_first.id is null or v_second.id is null then
    raise exception using errcode = 'P0001', message = 'player_not_found';
  end if;
  if v_first.team = v_second.team then
    raise exception using errcode = 'P0001', message = 'invalid_swap';
  end if;

  set constraints public.match_players_slot_key deferred;
  update public.match_players p
     set team = case when p.id = v_first.id then v_second.team else v_first.team end,
         slot = case when p.id = v_first.id then v_second.slot else v_first.slot end
   where p.match_id = p_match_id and p.id in (v_first.id, v_second.id);
end;
$$;

revoke all on function public.swap_players(text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.swap_players(text, uuid, uuid) to authenticated;
