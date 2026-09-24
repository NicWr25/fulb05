-- El alias es opcional: el nombre original sigue identificando a la persona.
alter table public.match_players add column alias text;
alter table public.match_players add constraint match_players_alias_check check (
  alias is null or (char_length(alias) between 1 and 24
    and alias = btrim(alias) and alias !~ '[[:cntrl:]]')
);

-- Se puede elegir un alias al anotarse, pero las ediciones pasan por la RPC:
-- ella permite al organizador editar a sus invitados sin abrir UPDATE general.
grant insert (alias) on public.match_players to authenticated;

create function public.set_player_alias(
  p_match_id text, p_player_id uuid, p_alias text
) returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  v_player public.match_players;
  v_uid uuid := private.require_uid();
  v_alias text := nullif(btrim(p_alias), '');
begin
  select * into v_player from public.match_players p
  where p.id = p_player_id and p.match_id = p_match_id;
  if v_player.id is null then
    raise exception using errcode = 'P0001', message = 'player_not_found';
  end if;
  if v_player.user_id is distinct from v_uid
     and not (v_player.user_id is null and private.is_match_admin(p_match_id)) then
    raise exception using errcode = '42501', message = 'not_your_token';
  end if;
  update public.match_players set alias = v_alias where id = v_player.id;
  -- match_players_before bloquea el cambio si el partido ya empezó.
end;
$$;

revoke all on function public.set_player_alias(text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.set_player_alias(text, uuid, text) to authenticated;

-- El render inicial necesita el mismo alias que la lectura tras open_match.
create or replace function public.get_match_preview(p_match_id text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', m.id, 'format', m.format, 'title', m.title, 'venue', m.venue,
    'maps_url', m.maps_url, 'starts_at', m.starts_at, 'timezone', m.timezone,
    'organizer_name', m.organizer_name, 'layout', m.layout, 'server_now', now(),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name,
        'alias', p.alias, 'team', p.team, 'slot', p.slot) order by p.team, p.slot)
      from public.match_players p where p.match_id = m.id
    ), '[]'::jsonb)
  ) from public.matches m where m.id = p_match_id;
$$;
