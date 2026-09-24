<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# fulb05 · Contexto para agentes

App web mobile-first para armar partidos de fútbol 5/7 entre amigos. Alguien crea el
partido, comparte `/p/[id]` por WhatsApp y cada uno se anota eligiendo equipo y lugar en
una cancha, en vivo, sin registrarse. **Está en producción.** Leé también el `README.md`:
explica la arquitectura, la seguridad y las decisiones técnicas en detalle.

## Quién es el usuario y cómo trabajar con él

- **Nico** (GitHub `NicWr25`) es estudiante de Ingeniería en Informática y el proyecto es
  para su **portfolio**. Quiere **entender cada capa**: explicá brevemente el porqué de
  cada decisión importante (RLS, índices, migraciones…) y no escondas complejidad.
- Idioma: **español rioplatense** (voseo), tanto en la UI como al hablar con él.
- **Trabajo por etapas chicas y verificables.** Al terminar cada una: mostrá qué hiciste y
  cómo probarlo, y **esperá su OK antes de commitear, hacer `db push` o `git push`.**
- **Antes de agregar una dependencia, justificala.** Runtime hoy: `next`, `react`,
  `react-dom`, `@supabase/supabase-js`. Nada más.
- A veces pide una **guía paso a paso** para hacer él mismo un cambio en vez de que lo
  hagas vos; respetá esa elección.
- Commits: mensaje en español, cuerpo explicando el porqué, y al final
  `Co-Authored-By: <modelo> <noreply@anthropic.com>`. La identidad git **local** del repo
  ya está configurada (`NicWr25 <nicolaswagner.skerl2005@gmail.com>`); no la cambies ni
  toques la configuración global.
- El editor de Nico formatea con Prettier (80 columnas) al guardar. El repo no tiene
  config de Prettier; seguí el estilo del archivo que estés tocando.

## Stack y comandos

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · pnpm 10 · Node 22 ·
Supabase (Postgres + RLS, Realtime, Auth anónima, pg_cron) · Vercel.

```bash
pnpm supabase start      # Supabase local en Docker (Docker Desktop tiene que estar corriendo)
pnpm dev                 # http://localhost:3000   (.env.local apunta al Supabase local)
pnpm db:reset            # recrea la base local aplicando supabase/migrations/ desde cero
pnpm db:test             # pgTAP (supabase/tests/*.test.sql)
pnpm db:types            # regenera lib/supabase/database.types.ts (después de cambiar el esquema)
pnpm test                # Vitest unitarios (tests/unit, sin base)
pnpm test:integration    # Vitest contra el Supabase local (tests/integration)
pnpm lint && pnpm typecheck && pnpm build
```

- La CLI de Supabase es devDependency: siempre `pnpm supabase …`.
- `/dev/ui` es la galería de componentes (solo en desarrollo).
- CI (`.github/workflows/ci.yml`) corre lint, tipos, unitarios y build, y aparte levanta
  Supabase en Docker y corre pgTAP + integración. Tiene que quedar en verde.

## Producción

| | |
|---|---|
| App | https://fulb05.vercel.app (Vercel despliega solo cada push a `main`) |
| Repo | https://github.com/NicWr25/fulb05 (público) |
| Supabase | proyecto `kkejdbpfayhrmmtkazvj` (ya vinculado con `supabase link`) |

**Orden para desplegar un cambio que incluye base de datos:** probar en local →
commit → `pnpm supabase db push --dry-run` (revisar) → `pnpm supabase db push` →
`git push`. La migración va **antes** que el código que la usa.

## Reglas que no se rompen

1. **Migraciones inmutables.** Nunca edites una migración ya commiteada: están aplicadas
   en producción. Todo cambio de esquema va en una migración nueva
   (`pnpm supabase migration new <nombre>`). Nada se cambia a mano en el panel.
2. **Nunca** corras comandos destructivos contra producción (`supabase db reset --linked`
   y similares).
3. **`supabase config push` aplica los cambios SIN confirmar** cuando no corre en una
   terminal interactiva (le pasó a un agente anterior y desactivó una protección de Auth).
   Siempre corré antes `pnpm supabase config diff` y revisá el JSON completo (el diff
   viene en las líneas JSON: no las filtres).
4. **Seguridad:** en el frontend solo va la anon key. La `service_role` no se usa en
   ningún lado (tampoco en Vercel). `.env*` está ignorado salvo `.env.example`.
5. **Toda regla de negocio o de permisos se valida en Postgres** (RLS, triggers o RPC
   `security definer` con `set search_path = ''`). La UI solo refleja; nunca confíes solo
   en el cliente.
6. El registro por mail está **desactivado** a propósito (`[auth.email] enable_signup =
   false`); el `enable_signup` general de `[auth]` tiene que seguir en `true` porque el
   login anónimo cuenta como registro.

## Modelo de datos (resumen)

- `matches`: `id` de 8 caracteres del alfabeto `abcdefghjkmnpqrstuvwxyz23456789` (sin
  i, l, o, 0, 1; un CHECK lo exige), `format` 5|7, `title` (null = título por defecto),
  `venue` (opcional), `maps_url` (obligatorio en altas/edición), `starts_at` timestamptz + `timezone` IANA, `organizer_name`,
  `layout` jsonb **NOT NULL** con las posiciones de las fichas.
- `match_players`: `team` `'A'|'B'`, `slot` 0..format-1 (NOT NULL), `user_id`
  (null = agregado por el organizador). `UNIQUE(match_id, team, slot)`
  resuelve carreras por el mismo lugar; `UNIQUE(match_id, user_id)` = una inscripción
  por persona.
- `match_viewers` ("el link es la llave": solo lee quien llamó a `open_match`).
  La administración depende de `matches.created_by = auth.uid()`.
- RPC: `create_match`, `open_match`, `get_match_preview` (única para
  `anon`, la usa el servidor), `update_match`, `move_token`, `move_player_slot`, `reset_team_layout`.
- Triggers: cierre a la hora de inicio (`match_closed`), `slot < format`, capacidad
  exacta de 5/7 por equipo y advisory lock por partido. Insertar con `slot: null` = primer lugar libre
  o error `team_full` (lo resuelve la base).
- `pg_cron` corre `private.purge_expired()` todos los días a las 07:15 UTC (partidos de
  hace más de 7 días y usuarios anónimos huérfanos de más de 30).
- Errores: los triggers/RPC lanzan `P0001` con un `message` corto (`match_closed`,
  `team_full`, `wrong_half`, `not_your_token`…) que `lib/domain/errors.ts` traduce.

## Mapa del código

- `lib/domain/` — lógica pura y testeable. `teams.ts` (`TEAM_LABEL`, clases de color),
  `positions.ts` (layout canónico, mitades, `clampToHalf`, `toScreen`/`fromScreen`),
  `match.ts`, `datetime.ts` (todo en la zona del partido), `share.ts` (`matchTitle`,
  WhatsApp), `og.ts`, `errors.ts`, `validation.ts` (espejo de los CHECK).
- `lib/hooks/useMatch.ts` — sesión anónima + `open_match` + lectura + Realtime. Ante
  cualquier evento **relee todo** (debounce 150 ms). Los DELETE se escuchan **sin
  filtro** porque con la replica identity por defecto solo traen la PK y un filtro por
  `match_id` nunca coincidiría. También detecta si sos admin.
- `lib/supabase/browser.ts` — `ensureSession()` verifica la sesión con `auth.getUser()`
  (si el usuario fue borrado, crea una nueva; si no, los INSERT fallan con 409 por FK).
- `components/match/MatchClient.tsx` elige `OrganizerView` o `PlayerView`, maneja el
  cierre en vivo y el banner de conexión. `MatchLayout.tsx` usa `grid-template-areas`
  (orden del DOM = celular; en `lg` la cancha va a la derecha) con slots `header`,
  `stat`, `pitch`, `card`, `share`.
- `components/match/MatchPitch.tsx` — cancha interactiva genérica con `canDrag(ref,
  player)` / `canSelect(ref, player)`, `onSelect`, `onMove`. Arrastre con pointer events,
  flechas del teclado como alternativa, sombra en la mitad rival, estado `pending` hasta
  que Realtime trae el layout guardado.
- La orientación de la cancha (vertical en celular, apaisada desde `lg`) es **solo CSS**:
  `.pitch-surface`, `.pitch-spot`, `.pitch-shade` en `app/globals.css`, con coordenadas
  canónicas en variables `--x`/`--y` (x a lo largo, 0 = arco del equipo A).
- Design tokens en `@theme` de `app/globals.css` (escalas por defecto de Tailwind
  anuladas: usá `text-13`, `rounded-btn`, `bg-cream`, etc.). Diseño original en
  `design/*.dc.html` (prototipos de Claude Design).
- Accesibilidad: controles táctiles ≥ 44×44 px, contraste WCAG verificado, foco visible
  (`--focus-ring`: tinta en claro, dorado sobre la cancha).

## Trampas conocidas (aprendidas en este proyecto)

- `LayoutProps`/`PageProps` son tipos globales generados: `pnpm typecheck` corre
  `next typegen` antes de `tsc`. `params` es una Promise.
- React Compiler lint: nada de `setState` sincrónico en efectos ni `Date.now()` en el
  render (usá el patrón "estado del render anterior" o la hora de Postgres `server_now`).
- `openGraph` de una página **reemplaza** (no combina) al del layout raíz.
- Las funciones SQL que usan `jsonb_build_object` son `STABLE`, no `IMMUTABLE`
  (`supabase db lint` lo marca).
- En tests pgTAP: los ids de partido tienen que respetar el alfabeto; no se puede
  insertar un jugador en un partido que ya empezó (crealo en el futuro y después movés
  la fecha); `private.*` no es ejecutable por `authenticated` (hacé `reset role` antes).
- En los tests de integración, esperá **condiciones** (`waitFor`), no tiempos fijos:
  en CI Realtime tarda más.
- La herramienta de capturas del navegador no dibuja los `<dialog>` modales (top layer).

---

## Estado actual de la UI y reglas

La rama de trabajo implementa la UI minimalista Blanco/Negro y el plan posterior de Nico:
- El organizador elige equipo y se anota antes de compartir. Admin = `created_by = auth.uid()`;
  no existe enlace secreto ni recuperación desde otra sesión.
- El organizador puede arrastrar cualquier ficha ocupada y mover jugadores a lugares
  libres, incluso al otro equipo; no puede bajarse.
- Cada equipo admite exactamente 5 o 7 jugadores. No hay suplentes: `slot` es NOT NULL.
  Insertar con `slot: null` asigna el primer lugar libre en el trigger o falla `team_full`.
- La barra para anotarse y la confirmación de la propia inscripción van arriba de la
  cancha. Los lugares libres se numeran del 1 al formato; no hay roles ni listas abajo.
- Google Maps es obligatorio al crear/editar; el nombre de la cancha es opcional y se
  extrae localmente de enlaces largos `/maps/place/` cuando es posible.
- Migración nueva: `20260925000100_simplify_matches.sql`. No editar migraciones previas.
- Antes de commit, `db push` o `git push`, mostrar el trabajo y esperar OK de Nico.
