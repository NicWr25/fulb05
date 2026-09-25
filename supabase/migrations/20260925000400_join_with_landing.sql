-- Alta y posición inicial en una sola transacción: Realtime publica el jugador
-- junto con el layout definitivo, sin mostrar la posición vieja del slot.
create function public.join_match(
  p_match_id text, p_team text, p_name text, p_alias text,
  p_x numeric, p_y numeric, p_guest boolean
)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_uid();
  v_match public.matches;
  v_player public.match_players;
begin
  if p_guest and not private.is_match_admin(p_match_id) then
    raise exception using errcode = '42501', message = 'not_admin';
  end if;
  if not private.can_view_match(p_match_id) then
    raise exception using errcode = '42501', message = 'not_allowed';
  end if;

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
  if p_x is null or p_y is null or p_x not between 0 and 100 or p_y not between 0 and 100 then
    raise exception using errcode = 'P0001', message = 'invalid_layout';
  end if;
  if not private.in_own_half(p_team, p_x) then
    raise exception using errcode = 'P0001', message = 'wrong_half';
  end if;

  -- El trigger asigna el primer slot libre bajo el mismo advisory lock.
  insert into public.match_players (match_id, user_id, name, alias, team, slot)
  values (p_match_id, case when p_guest then null else v_uid end,
    p_name, nullif(btrim(p_alias), ''), p_team, null)
  returning * into v_player;

  update public.matches
     set layout = jsonb_set(layout, array[p_team, v_player.slot::text],
       jsonb_build_object('x', round(p_x, 1), 'y', round(p_y, 1)))
   where id = p_match_id;

  return jsonb_build_object('id', v_player.id, 'team', p_team,
    'slot', v_player.slot, 'x', round(p_x, 1), 'y', round(p_y, 1));
end;
$$;

revoke all on function public.join_match(text, text, text, text, numeric, numeric, boolean)
  from public, anon, authenticated;
grant execute on function public.join_match(text, text, text, text, numeric, numeric, boolean)
  to authenticated;
