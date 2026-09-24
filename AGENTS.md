<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# fulb05 · Contexto para agentes

App web mobile-first para armar partidos de fútbol 5/7 entre amigos. Alguien crea el
partido, comparte `/p/[id]` por WhatsApp y cada uno se anota eligiendo equipo y puesto en
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
  `venue`, `maps_url`, `starts_at` timestamptz + `timezone` IANA, `organizer_name`,
  `layout` jsonb **NOT NULL** con las posiciones de las fichas.
- `match_players`: `team` `'A'|'B'`, `slot` 0..format-1 (**null = banco**), `user_id`
  (null = agregado por el organizador), `bench_since`. `UNIQUE(match_id, team, slot)`
  resuelve carreras por el mismo lugar; `UNIQUE(match_id, user_id)` = una inscripción
  por persona.
- `match_admins`, `match_viewers` ("el link es la llave": solo lee quien llamó a
  `open_match`), `match_admin_secrets` (hash SHA-256 del token de admin; sin políticas).
- RPC: `create_match`, `open_match`, `claim_admin`, `get_match_preview` (única para
  `anon`, la usa el servidor), `update_match`, `move_token`, `reset_team_layout`.
- Triggers: cierre a la hora de inicio (`match_closed`), `slot < format`, tope de 6 en el
  banco, **ascenso automático del banco** y advisory lock por partido. Insertar con
  `slot: null` = "primer lugar libre o banco" (lo resuelve la base).
- `pg_cron` corre `private.purge_expired()` todos los días a las 07:15 UTC (partidos de
  hace más de 7 días y usuarios anónimos huérfanos de más de 30).
- Errores: los triggers/RPC lanzan `P0001` con un `message` corto (`match_closed`,
  `bench_full`, `wrong_half`, `not_your_token`…) que `lib/domain/errors.ts` traduce.

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
  `stat`, `pitch`, `card`, `rosters`, `share`.
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
- StrictMode monta los efectos dos veces en desarrollo (ver `app/p/[id]/admin/ClaimAdmin.tsx`).
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

## TAREA PENDIENTE (aprobada, sin implementar): UI minimalista, Blanco/Negro y fichas solo propias

Pedido de Nico: que la app "sirva para armar partidos, sin información que no es
relevante a primeras". Mandó un **mockup** (no es código existente): una barra con el
input "Nombre del jugador" y un botón "+ Agregar" **arriba de la cancha**, sin card.

Decisiones ya confirmadas por Nico:
- Sin puesto elegido, el equipo lo define un **selector chico Blanco/Negro** (no se
  asigna solo al que tiene menos).
- La regla de arrastre vale **también para el organizador**.
- La barra mínima reemplaza **también** la card "Anotate" del jugador.

### 1. Solo tu propia ficha (base + cliente)
- **Migración nueva** `supabase/migrations/20260925000100_own_token_only.sql` con
  `create or replace function public.move_token(p_match_id text, p_team text, p_slot
  integer, p_x numeric, p_y numeric)`: se saca la excepción de admin (hoy en
  `20260924000700_player_positions.sql`, variable `v_admin`). Para **todos**: la ficha
  tiene que ser del que llama (`match_players.user_id = auth.uid()` en ese team/slot →
  si no, `42501 not_your_token`), el partido no empezó (`match_closed`) y el punto queda
  en su mitad (`wrong_half`) y dentro de 0..100 (`invalid_layout`). Conservar
  `security definer`, `set search_path = ''` y los grants (execute solo `authenticated`).
  `reset_team_layout` (solo admin) **no cambia**.
- `components/match/OrganizerView.tsx`: `canDrag` pasa de `() => true` a la misma regla
  que `PlayerView` (`!closed && player?.id === me?.id`). `canSelect` sigue `() => true`.
  Actualizar el texto de ayuda bajo la cancha.
- `supabase/tests/04_positions.test.sql`: "el admin puede mover un lugar libre" →
  espera `not_your_token`; "el admin sí puede seguir acomodando" (partido empezado) →
  `match_closed`; el caso de mitades del admin se reescribe con **su propia ficha**
  (anotarlo primero); agregar "el admin no puede mover la ficha de otro jugador". Ajustar
  `plan(n)`.

### 2. Equipos Blanco / Negro
- `lib/domain/teams.ts`: `TEAM_LABEL = { A: "Blanco", B: "Negro" }` y nuevo
  `TEAM_IN = { A: "el equipo blanco", B: "el equipo negro" }` para frases ("Jugás de
  defensa en el equipo blanco", "El equipo negro está completo: …"). Los ids `A`/`B` no
  cambian (la base no se toca).
- `app/globals.css`: `--color-team-a: #ffffff` (texto `ink`) y `--color-team-b:
  #16181d` (texto blanco). `TEAM_TOKEN_CLASS` en `teams.ts` ya usa `text-ink`/`text-white`.
- Usar `TEAM_IN` donde hoy se arman frases con `TEAM_LABEL`: `PlayerView.tsx`,
  `OrganizerView.tsx`, `MyEntryCard` (vía `PlayerView`), `MatchPitch.tsx` (aria-labels).
  `TeamLegend.tsx`, `Rosters.tsx`, `TeamToggle.tsx` siguen con `TEAM_LABEL`.
- `app/p/[id]/opengraph-image.tsx`: constantes `C.teamA/teamB` y etiquetas "Claros" /
  "Oscuros" → Blanco/Negro. También `app/dev/ui/UiGallery.tsx`.
- Comentarios y descripciones de tests TS que digan "Claros/Oscuros". **No** edites las
  migraciones viejas.

### 3. Barra mínima arriba de la cancha
- Componente nuevo `components/match/QuickAddBar.tsx`, que reemplaza a
  `components/match/AddPlayerCard.tsx` y `components/match/JoinCard.tsx` (borrarlos):
  - Fila 1: input de nombre (label **visualmente oculto** `sr-only` para accesibilidad;
    placeholder "Nombre del jugador" en el organizador / "Tu nombre" en el jugador;
    `maxLength={LIMITS.name}`) + botón negro "+ Agregar" / "Anotarme" (pasa a "Al banco"
    si el equipo destino está lleno y no hay puesto libre elegido; "Conectando…"
    deshabilitado mientras `status !== "ready"`).
  - Fila 2: selector chico Blanco/Negro (dos chips con `TeamSwatch`, alto ≥ 44 px,
    `aria-pressed`) + una línea `aria-live` de altura fija con la ayuda ("Va de defensa
    en el equipo negro") o el error (`errorMessage`, ej. "Ese lugar lo acaba de ocupar…").
  - Enter envía. Reusar `playerNameError`, `LIMITS`, `TeamSwatch`, `cx`, tokens de diseño.
- Ubicación: en el slot `pitch` de `MatchLayout`, **arriba** de la leyenda y la cancha,
  en celular y escritorio. El slot `card` queda solo para `MyEntryCard` (jugador ya
  anotado), la card de partido cerrado/"Reprogramar" y la de error de conexión.
- Organizador: "¿Jugás vos? Anotarme como {nombre}" pasa a un link chico debajo de la
  barra; si ya está anotado: "Estás como X · Bajarme". Mantener `TeamBars` (leyenda +
  restablecer posiciones) pero compacto en una sola línea.
- La lógica de destino ya existe: `target()` en `OrganizerView` (puesto elegido si está
  libre; si no `slot: null`) y `join()` en `PlayerView`. No duplicar: la barra recibe
  callbacks/props.

### 4. Nombre del partido
- `lib/domain/share.ts`: `matchTitle(title, organizerName)` →
  `title?.trim() || \`Partido de ${organizerName}\``. Actualizar los 4 usos:
  `app/p/[id]/page.tsx`, `PlayerView.tsx`, `OrganizerView.tsx`, `lib/domain/og.ts`
  (`weekday` deja de hacer falta ahí). Como `title` null se calcula al vuelo, si cambia
  `organizer_name` el título lo sigue.
- `components/create/CreateMatchForm.tsx`: sacar el campo "Nombre del partido" (sigue
  mandando `p_title: ""`, que la RPC guarda como null). El resumen de la pantalla de
  éxito usa `Partido de {organizerName}`. Sin cambios en la base.
- Edición en línea en `components/match/MatchHeader.tsx`: prop opcional
  `onRenameTitle(title: string): Promise<void>`. Si viene (organizador), el `h1`
  contiene un botón con el título + `EditIcon`; al tocarlo, input + Guardar/Cancelar
  (Enter guarda, Esc cancela, vacío = volver al título por defecto → `p_title: ""`),
  máximo `LIMITS.title` (60). Guardar con `update_match` reusando `details()` de
  `OrganizerView` con `p_title` nuevo, y después `reload()`.
- `components/match/EditMatchDialog.tsx`: sacar el campo título (queda día, hora,
  cancha, Maps y organizador). Seguir mandando el título actual en `update_match`.

### Tests a actualizar
- `tests/unit/match.test.ts` (`matchTitle` → "Partido de Nico"), `tests/unit/og.test.ts`
  (`title` de `ogImageData`), test nuevo para `TEAM_LABEL`/`TEAM_IN`.
- pgTAP `04_positions.test.sql` según el punto 1.
- `tests/integration/positions.test.ts` debería seguir pasando (cada jugador mueve la suya).

### Verificación
1. `pnpm db:reset` → `pnpm db:test` → `pnpm test` → `pnpm test:integration` →
   `pnpm lint` → `pnpm typecheck` → `pnpm build` → `pnpm supabase db lint --level warning`.
2. En el navegador (preset mobile y 1280 px): crear partido sin nombre ("Partido de
   Nico"); renombrar el título desde el panel, recargar y ver que persiste; vaciarlo y
   que vuelva al default; barra mínima con y sin puesto elegido y con equipo lleno ("Al
   banco"); el organizador **no** puede arrastrar fichas ajenas ni puestos libres, sí la
   suya; jugador: barra "Anotarme" → `MyEntryCard`, arrastra solo la suya; colores y
   textos Blanco/Negro; controles ≥ 44 px.
3. Mostrarle el resultado a Nico y **esperar su OK**. Recién ahí: commit →
   `pnpm supabase db push --dry-run` → `pnpm supabase db push` → `git push` → verificar
   el CI en verde y https://fulb05.vercel.app.
