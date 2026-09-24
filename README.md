# fulb05 — Armá el partido

App web (mobile-first) para armar equipos de fútbol 5 o 7 entre amigos: alguien crea
un partido, comparte el link por WhatsApp y cada uno se anota eligiendo equipo y puesto
en la cancha. Todos ven el mismo estado en vivo.

> 🚧 En construcción, por etapas. Este README se completa en la etapa (h).

## Stack

- **Frontend:** Next.js (App Router) + TypeScript + Tailwind v4, `@supabase/supabase-js`.
- **Backend:** Supabase (Postgres + Row Level Security, Realtime, Auth anónima). Sin servidor propio.
- **Hosting:** Vercel.

## Correr en local

Requisitos: Node 22, pnpm 10, Docker Desktop corriendo.

```bash
pnpm install
pnpm supabase start          # levanta Postgres, Auth, Realtime y Studio (http://127.0.0.1:54323)
cp .env.example .env.local   # completar con `pnpm supabase status`
pnpm dev                     # http://localhost:3000
```

La CLI de Supabase es una devDependency (`supabase`), así la versión queda fijada en el
repo y no hace falta instalarla global.

## Scripts

| Script | Qué hace |
|---|---|
| `pnpm dev` / `pnpm build` | Next.js |
| `pnpm test` | Tests unitarios (Vitest) |
| `pnpm typecheck` | Genera tipos de rutas (`next typegen`) y corre `tsc` |
| `pnpm db:reset` | Recrea la base local aplicando `supabase/migrations/` desde cero |
| `pnpm db:test` | Tests de base de datos (pgTAP: RLS, triggers, funciones) |

## Arquitectura

_Pendiente (etapa h)._

## Seguridad

_Pendiente (etapa h)._ Resumen de decisiones:

- Solo la `anon` key llega al navegador; la seguridad real la dan las políticas RLS.
- Login anónimo: cada navegador recibe un `auth.uid()` sin registrarse.
- Todo cambio de esquema vive en `supabase/migrations/` (nada hecho a mano en el panel).
