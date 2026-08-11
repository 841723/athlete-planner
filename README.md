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
   ADMIN_EMAILS=<email-superadmin>          # opcional
   PORT=4000
   MIN_DATE=2026-05-12
   ```

   `DEFAULT_OWNER_EMAIL` es quien se convierte en `athlete` (owner) del tenant
   migrado `default`. **Sin él, el tenant default queda sin miembros y nadie
   puede acceder a los datos migrados.**

   `ADMIN_EMAILS` (opcional, lista separada por comas) marca a esos usuarios
   como **superadministradores** del sistema (panel `/admin`): al arrancar el
   backend se sincroniza el flag `is_superadmin` de la tabla `users`.

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

### Panel de administración (`/admin`)

Solo visible para usuarios con `is_superadmin` (env `ADMIN_EMAILS`; el backend
recomprueba el flag de la BD en cada petición, nunca confía en el cliente).
Permite, de forma global:

- **Proveedores**: habilitar/deshabilitar proveedores de IA (gemini, opencode,
  mock) y fijar la URL base de la instancia de opencode. Un proveedor
  deshabilitado se rechaza en `callAi`/`callAiChat` y no aparece en la UI.
- **Modelos opencode**: catálogo global (nombre, proveedor, precio input/output
  y habilitado). Es la **única fuente** de precios y disponibilidad para todos
  los tenants; los modelos no incluidos quedan deshabilitados. El tenant ya no
  edita precios de opencode.
- **Tenants**: listar/crear tenants (nombre, owner y slug opcionales), renombrar
  y gestionar miembros (añadir, cambiar rol, eliminar), con las mismas reglas
  que en el tenant (el owner es intocable).

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

Se levantan **4 contenedores separados**: `database` (propietario del directorio
SQLite), `opencode` (instancia local de IA, `opencode serve`), `backend`
(Node 24 + uv) y `frontend` (Vite en dev; nginx + estático en producción).

### Desarrollo

```sh
docker compose up --build
```

- `frontend` en `http://localhost:3000` (Vite HMR; proxya `/api` al backend).
- `backend` en `http://localhost:4000`.
- `opencode` expuesto en `http://localhost:4096` (el backend usa
  `OPENCODE_BASE_URL=http://opencode:4096` dentro de la red de compose).
- `database` monta `./data` del host, así que la BD (`data/endurance.db`) es la
  misma que usan los scripts locales (`uv run ...`, `node --input-type=module`).

Requiere el `.env` configurado (ver arriba).

### Producción

El despliegue usa un contenedor `frontend` con nginx que sirve el compilado y
proxya `/api` al backend (mismo origen, URLs relativas) y el directorio `./data`
del host (bind mount) para la BD SQLite, igual que el desarrollo.

```sh
docker compose -f docker-compose.prod.yml up -d --build
```

Mapea el puerto `43520` (host) al `80` (nginx). Pasos para exponerlo a internet
tras levantar el contenedor:

1. **`.env` en el servidor**: copia el fichero `.env` (está en `.gitignore`).
   Revisa `GOOGLE_CLIENT_ID`, `DEFAULT_OWNER_EMAIL`, `ADMIN_EMAILS` y `MIN_DATE`.
2. **Google OAuth**: en Google Cloud Console → Credenciales → tu OAuth Client,
   añade `https://<tu-subdominio>` en **Authorized JavaScript origins** (el
   login usa el flujo de `credential`, no hace falta redirect URI).
3. **Túnel de Cloudflare**: apunta un túnel (cloudflared) al puerto
   `http://localhost:43520`. El backend no gestiona TLS; la termina Cloudflare.
4. **Garmin (opcional)**: la conexión se gestiona desde Configuración →
   Sincronización (los tokens se guardan en la BD del tenant, no en ficheros).

## Estructura

- `scripts/garmin-fetch.py` — descarga datos de Garmin Connect (sin MCP).
- `scripts/sync-sessions.mjs` — normaliza y escribe sesiones en la BD.
- `scripts/migrate-to-db.mjs` — migra los JSON legados de `sessions/` a la BD.
- `scripts/create-athlete.mjs` — crea un nuevo atleta/tenant.
- `backend/init.sql` — esquema SQLite (se aplica desde `backend/lib/db.js`).
- `backend/lib/db.js` — acceso a SQLite (`data/endurance.db`) y migraciones.
- `backend/lib/auth.js` — verificación del token de Google y sesiones.
- `backend/lib/api-keys.js` — API keys por tenant para autenticación sin Google.
- `backend/lib/sessions.js` — capa de datos multi-tenant (sesiones, perfil,
  ajustes).
- `backend/lib/trainer.js` — genera el plan con IA y actualiza el perfil del
  atleta con los últimos datos de las sesiones.
- `backend/lib/ai-provider.js` — proveedores de IA (gemini/openai/anthropic/…)
  y `callAi` con logging de cada solicitud (`backend/lib/ai-logs.js`).
- `backend/server.js` — arranque HTTP: dispatch estático/API, auth (cookie o
  API key) y montaje de las rutas de `backend/routes/` (divididas por dominio).
- `frontend/` — interfaz web (Vite + React).
- `sessions/` — legado en JSON (migrado a BD al primer arranque).
- `AGENTS.md` — esquema JSON de sesión, endpoints y workflow de sync.
- `opencode.json` — config de opencode.

## Nota

Garmin no publica una API oficial; `garmin-fetch.py` usa la librería no oficial
`python-garminconnect`. Si Garmin cambia sus endpoints internos, algún dato
podría dejar de estar disponible temporalmente. Es de solo lectura.
