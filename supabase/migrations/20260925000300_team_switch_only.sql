-- Después del alta, el lugar es fijo dentro del equipo. Cambiar de equipo
-- asigna el primer lugar libre; las coordenadas se ajustan con move_token.
revoke update (team, slot) on public.match_players from authenticated;
drop function public.move_player_slot(text, uuid, text, integer);

create function public.change_player_team(
  p_match_id text, p_player_id uuid, p_team text
) returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_uid();
  v_match public.matches;
  v_player public.match_players;
  v_slot integer;
begin
  perform private.lock_match(p_match_id);
  select * into v_match from public.matches m where m.id = p_match_id;
  if v_match.id is null then
    raise exception using errcode = 'P0001', message = 'match_not_found';
  end if;
  if now() >= v_match.starts_at then
    raise exception using errcode = 'P0001', message = 'match_closed';
  end if;
  if p_team is null or p_team not in ('A', 'B') then
    raise exception using errcode = 'P0001', message = 'invalid_team';
  end if;
  select * into v_player from public.match_players p
    where p.id = p_player_id and p.match_id = p_match_id;
  if v_player.id is null then
    raise exception using errcode = 'P0001', message = 'player_not_found';
  end if;
  if v_player.user_id is distinct from v_uid and not private.is_match_admin(p_match_id) then
    raise exception using errcode = '42501', message = 'not_your_token';
  end if;
  if v_player.team = p_team then return; end if;

  select s into v_slot from generate_series(0, v_match.format - 1) as s
    where not exists (
      select 1 from public.match_players p
      where p.match_id = p_match_id and p.team = p_team and p.slot = s
    ) order by s limit 1;
  if v_slot is null then
    raise exception using errcode = 'P0001', message = 'team_full';
  end if;
  update public.match_players set team = p_team, slot = v_slot where id = v_player.id;
end;
$$;

revoke all on function public.change_player_team(text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.change_player_team(text, uuid, text) to authenticated;
