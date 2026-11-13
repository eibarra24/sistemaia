# SistemaIA — Control de gastos personales

Monorepo con:

- **Front**: SvelteKit (Svelte 5) en `apps/web`
- **Back**: Node.js + Express en `apps/api`
- **DB**: Supabase (Postgres) — esquema en `supabase/schema.sql`
- **Deploy**: Vercel (un proyecto por app, o monorepo con dos proyectos)

## Funcionalidades

- Registro/login con contraseñas hasheadas con **bcrypt** (costo 12)
- Sesiones con **JWT** (7 días)
- CRUD de gastos y categorías
- Presupuestos mensuales por categoría con umbral de alerta
- Reglas de alerta: gasto grande, total mensual, % de presupuesto
- Notificaciones en tiempo real al crear gastos que cruzan umbrales
- **Rate limiting** en auth (20 req/15min) y API general (300 req/15min)
- Helmet, CORS restringido, validación con Zod

## Setup local

1. `npm install` (en la raíz, workspaces)
2. Crear proyecto en [Supabase](https://supabase.com) y ejecutar `supabase/schema.sql` en el SQL Editor
3. Copiar `.env.example` → `apps/api/.env` y `apps/web/.env` con tus credenciales
   - `JWT_SECRET`: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
4. `npm run dev:api` (puerto 3001) y `npm run dev:web` (puerto 5173)

## Deploy en Vercel

### Backend (`apps/api`)

```bash
cd apps/api
vercel --prod
```

Variables de entorno en Vercel: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `CORS_ORIGIN` (URL del front).

El `vercel.json` reescribe todo a la función serverless en `api/index.js`.

### Frontend (`apps/web`)

```bash
cd apps/web
vercel --prod
```

Variable de entorno: `PUBLIC_API_URL` = URL del backend en Vercel.

## Seguridad

- `.env` nunca se commitea; usa `.env.example` como plantilla
- La `SERVICE_ROLE_KEY` solo vive en el backend — el front nunca habla directo con Supabase
- RLS habilitado en todas las tablas; el backend valida ownership (`user_id`) en cada query
- Contraseñas con bcrypt, tokens JWT firmados, rate limiting en endpoints sensibles
