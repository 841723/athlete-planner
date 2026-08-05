# Training

Seguimiento personal de entrenamientos para Ironman 70.3 con frontend, backend
y sincronización directa con la API de Garmin Connect. Multi-atleta: cada
atleta tiene su propio tenant (datos, objetivos, perfil) y el acceso se controla
con Google OAuth y roles.

## Requisitos

- Node.js **24+** (backend usa `node:sqlite`)
- [uv](https://docs.astral.sh/uv/) (para ejecutar el script de Python)
- Cuenta de Garmin Connect
- Cuenta de Google y un **OAuth Client ID** de tipo "Web application" (creado en
  Google Cloud Console → Credenciales). Configura como redirect URI
  `http://localhost:3000` (dev) o tu dominio en producción.

## Setup inicial (una sola vez)

1. Instala dependencias de Node:

   ```sh
   npm install
   ```

2. Crea el fichero `.env` (copia de `.env.example`) y rellena:

   ```sh
   GOOGLE_CLIENT_ID=<tu-oauth-client-id>
   DEFAULT_OWNER_EMAIL=<tu-email-de-google>
   PORT=4000
   MIN_DATE=2026-05-12
   ```

   `DEFAULT_OWNER_EMAIL` es quien se convierte en `athlete` (owner) del tenant
   migrado `default`. **Sin él, el tenant default queda sin miembros y nadie
   puede acceder a los datos migrados.**

3. Autentica con Garmin (te pedirá email, contraseña y código MFA si lo tienes
   activado; guarda los tokens en `~/.garminconnect`):

   ```sh
   uvx garmin-connect-mcp auth
   ```

4. Arranca el backend en dev (al primer arranque migra `sessions/*.json` y el
   perfil de `data/athlete-profile.json` a la base de datos SQLite):

   ```sh
   node backend/server.js --port 4000
   ```

5. Arranca el frontend con Vite (puerto 3000, con proxy a `/api`):

   ```sh
   cd frontend && npm run dev
   ```

6. Entra en `http://localhost:3000` e inicia sesión con Google usando la cuenta
   de `DEFAULT_OWNER_EMAIL`.

## Multi-atleta y roles

- Login con Google. Cada atleta es un **tenant** con sus propios datos
  (sesiones, planificadas, objetivos, perfil, ajustes).
- Al entrar, el selector de tenant (menú del usuario, esquina superior derecha)
  cambia entre los tenants a los que perteneces.
- Roles por tenant:
  - `athlete` — owner; acceso total. No puede ser eliminado ni cambiado de rol
    por otros.
  - `admin` — acceso total salvo tocar al owner.
  - `visitor` — solo lectura; los botones de crear/editar/eliminar quedan
    ocultos.
- Los miembros se gestionan desde la página **Configuración** (`admin`/`athlete`),
  que además permite renombrar el tenant, editar el perfil del atleta en JSON y
  los próximos objetivos.

### Crear un nuevo atleta

```sh
node scripts/create-athlete.mjs --name "Sara" --owner-email sara@example.com \
  --profile data/athlete-profile.example.json
```

Crea el tenant, el owner (`athlete`) y el perfil. Flags opcionales: `--slug`,
`--min-date`, `--plan-start`, `--goal-date`, `--training-week-one-start`.
Idempotente: falla si el `slug` ya existe. La persona debe iniciar sesión con la
misma cuenta de Google y seleccionar el tenant nuevo.

## Sincronización con Garmin

Invoca `/sync-all` (o `/sync`, su alias) para sincronizar todas las sesiones
pendientes. También desde la web con el botón **Sincronizar** de la página de
Inicio (solo visible con permiso de edición). Los resultados se guardan en la BD
del tenant activo.

## Frontend

Vite + React + Tailwind, responsive (móvil/tablet/desktop). Páginas:

- **Inicio** (`/`) — resumen del plan, hoy/mañana y botón **Sincronizar**.
- **Calendario** (`/calendar`) — sesiones por día; en móvil muestra celdas
  compactas con puntos y una hoja inferior con las sesiones del día.
- **Semanal** (`/weekly`) — horas por semana, distribución por deporte y detalle
  semanal (tabla en desktop, tarjetas en móvil).
- **Estadísticas** (`/stats`) — totales, récords y gráficas.
- **Planificadas** (`/planned`) — CRUD de sesiones planificadas y **Generar Plan
  con IA** (`POST /api/generate-plan`), que antes de generar actualiza el perfil
  del atleta con los datos de las últimas 8 semanas (Z2 running, potencia en
  bici, ritmo en natación y semana actual).
- **Configuración** (`/config`) — nombre del tenant, perfil del atleta en JSON,
  próximos objetivos y permisos (miembros). Solo `admin`/`athlete`.
- **Detalle de sesión** (`/session/:id`) — navegación Anterior/Siguiente entre
  sesiones; "Volver" lleva al calendario.

El cambio de tenant y el acceso a Configuración están en el menú del usuario
(esquina superior derecha).

## Docker

### Desarrollo

```sh
docker compose up --build
```

Arranca backend (Node 24 + uv) y frontend (Vite HMR). Requiere el `.env`
configurado. Los tokens de Garmin se guardan en el volumen `garmin_tokens`
(la primera vez hay que autenticarse dentro del contenedor):

```sh
docker compose exec app uvx garmin-connect-mcp auth
```

### Producción

El despliegue usa un único contenedor que sirve el frontend compilado y la API
desde el mismo puerto (`Dockerfile.prod` + `docker-compose.prod.yml`). El
frontend usa URLs relativas (`/api`), así que todo funciona bajo un único
dominio sin configurar ninguna URL de endpoint.

```sh
docker compose -f docker-compose.prod.yml up -d --build
```

Mapea el puerto `13799` (host) al `4000` (contenedor). Pasos para exponerlo a
internet tras levantar el contenedor:

1. **`.env` en el servidor**: copia el fichero `.env` (está en `.gitignore`).
   Revisa `GOOGLE_CLIENT_ID`, `DEFAULT_OWNER_EMAIL` y `MIN_DATE`.
2. **Google OAuth**: en Google Cloud Console → Credenciales → tu OAuth Client,
   añade `https://<tu-subdominio>` en **Authorized JavaScript origins** (el
   login usa el flujo de `credential`, no hace falta redirect URI).
3. **Túnel de Cloudflare**: apunta un túnel (cloudflared) al puerto
   `http://localhost:13799`. El backend no gestiona TLS; la termina Cloudflare.
4. **Garmin (opcional)**: si reactivas el botón de sincronizar, autentica
   dentro del contenedor para guardar los tokens en el volumen:

   ```sh
   docker compose -f docker-compose.prod.yml exec app uvx garmin-connect-mcp auth
   ```

## Estructura

- `scripts/garmin-fetch.py` — descarga datos de Garmin Connect (sin MCP).
- `scripts/sync-sessions.mjs` — normaliza y escribe sesiones en la BD.
- `scripts/migrate-to-db.mjs` — migra los JSON legados de `sessions/` a la BD.
- `scripts/create-athlete.mjs` — crea un nuevo atleta/tenant.
- `backend/lib/db.js` — SQLite (`data/endurance.db`) y esquema.
- `backend/lib/auth.js` — verificación del token de Google y sesiones.
- `backend/lib/sessions.js` — capa de datos multi-tenant (sesiones, perfil,
  ajustes).
- `backend/lib/trainer.js` — genera el plan con IA y actualiza el perfil del
  atleta con los últimos datos de las sesiones.
- `backend/server.js` — API REST con auth, tenants, roles y estáticos.
- `frontend/` — interfaz web (Vite + React).
- `sessions/` — legado en JSON (migrado a BD al primer arranque).
- `AGENTS.md` — esquema JSON de sesión, endpoints y workflow de sync.
- `opencode.json` — config de opencode.

## Nota

Garmin no publica una API oficial; `garmin-fetch.py` usa la librería no oficial
`python-garminconnect`. Si Garmin cambia sus endpoints internos, algún dato
podría dejar de estar disponible temporalmente. Es de solo lectura.
