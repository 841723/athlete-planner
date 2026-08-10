# AGENTS.md

Proyecto personal de seguimiento de entrenamientos para Ironman 70.3.
Los entrenamientos se descargan desde **Garmin Connect** (API directa vía
`scripts/garmin-fetch.py`) o **Strava** (OAuth, `backend/lib/strava.js`) y se
guardan en una base de datos SQLite (`data/endurance.db`), aislada por
**tenant** (un tenant = un atleta). Cada tenant conecta **una** fuente a la vez
(tabla `sync_sources`, gestionada desde Configuración → Sincronización).

`sessions/` (JSON) es **legado**: se migró una sola vez a la BD al primer
arranque (`backend/lib/migrate.js`). No lo uses como origen de datos ni lo
modifiques.

## Autenticación, tenants y roles

- Todo `/api/*` requiere sesión (cookie `endurance_tok`, HttpOnly) salvo
  `health`, `auth/config` y `auth/google`.
- **Alternativa sin Google**: cada tenant puede crear **API keys**
  (`backend/lib/api-keys.js`, tabla `api_keys`) y usarlas con la cabecera
  `Authorization: Bearer <key>` o `X-Api-Key: <key>`. La key resuelve tenant +
  rol (`admin`/`visitor`) y prevalece sobre `X-Tenant-Id`. Se gestionan desde
  Configuración → Acceso (o por API, `GET/POST /api/api-keys`,
  `DELETE /api/api-keys/:id`). La key raw solo se muestra una vez al crearla;
  en BD se guarda solo su hash sha256.
- El login es con Google (ID token verificado con `google-auth-library`;
  solo hace falta `GOOGLE_CLIENT_ID` en `.env`). Al primer login se crea el
  usuario automáticamente.
- Cada petición lleva el tenant activo en la cabecera `X-Tenant-Id` (el
  frontend lo gestiona en `frontend/src/services/api.ts`). El backend resuelve
  la pertenencia con `backend/lib/sessions.js` (`withTenant`/`getTenantId`).
- Roles por tenant: `athlete` (owner, no se puede tocar), `admin` (total salvo
  al owner), `visitor` (solo lectura; el frontend oculta los botones de
  escribir). Añadir/cambiar/eliminar miembros: solo `admin`/`athlete`
  (`backend/lib/members.js`).
- El owner de un tenant se define en la migración con `DEFAULT_OWNER_EMAIL`
  (`.env`). Para crear atletas nuevos usa `scripts/create-athlete.mjs` (crea
  tenant + owner + perfil opcional).

## Cómo sincronizar

El usuario invoca `/sync-all` (o `/sync`, su alias) para sincronizar solo las
sesiones que faltan. También desde la web con el botón **Sincronizar** de la
página de Inicio (llama a `POST /api/sync`); el backend ejecuta la misma
pipeline (`backend/lib/sync.js`) con `uv run` y los scripts. `runSync` usa la
**fuente conectada** del tenant (`sync_sources`): Garmin (tokens del tenant en
fichero temporal, pasados con `--tokens`) o Strava (`backend/lib/strava.js`).
Si no hay fuente conectada, devuelve error claro. **Nunca hagas
sincronizaciones automáticas sin que el usuario lo pida.**

Comandos disponibles:

- `/get-sessions-ids`: lista todos los IDs de actividades de Garmin.
- `/get-sessions-ids-missing`: calcula los IDs que faltan en la BD del tenant
  y los guarda en `sessions/missing.json`.
- `/sync-session <activity_id>`: sincroniza una única sesión.
- `/sync-all`: sincroniza todas las sesiones pendientes del tenant activo.

## Fuentes de datos (Garmin y Strava)

- **Garmin (API directa, sin MCP)**: toda la descarga se hace con
  `scripts/garmin-fetch.py`, que usa la librería `garminconnect`. El login se
  hace con `backend/lib/garmin.js` (`garminLogin`, soporta MFA) desde
  `POST /api/sync-sources/garmin/connect`; los tokens se guardan **en la BD del
  tenant** (columna `tokens` de `sync_sources`, el string raw que devuelve
  `dumps()`), no en `~/.garminconnect`. Al sincronizar se escriben en un fichero
  temporal y se pasan con `--tokens <file>`.
- **Strava (OAuth)**: `backend/lib/strava.js` (authorize/exchange/refresh). La
  conexión se inicia con `POST /api/sync-sources/strava/connect` (devuelve la
  URL con un `state` = tenantId.nonce), y el callback público
  `GET /api/sync-sources/strava/callback` canjea el `code`, guarda los tokens y
  redirige a `/<tenantId>/config/sync?connected=strava`. Necesita
  `STRAVA_CLIENT_ID` y `STRAVA_CLIENT_SECRET` en `.env`.
- Ejecuta siempre Garmin con `uv run --with garminconnect==0.3.8 python scripts/garmin-fetch.py ...`.
- Subcomandos de `scripts/garmin-fetch.py`:
  - `list [--min-date YYYY-MM-DD] [--max-date YYYY-MM-DD] [--tokens FILE] [--out FILE]`.
  - `details <activity_id> [--list FILE] [--tokens FILE] [--out FILE]`: detalle
    de una actividad (splits `lapDTOs`, `hr_zones`, RPE/feel en `activity.summaryDTO`).
  - `ids [--min-date ...] [--max-date ...] [--tokens FILE] [--json]`: activity IDs.
- **Rango de fechas por fuente**: cada fuente conectada puede definir
  `min_date`/`max_date` (Configuración → Sincronización). `sync.js` y
  `syncStrava` los pasan a la fuente (`--min-date/--max-date`; en Strava
  `after`/`before`). Si no se definen, se usa el fallback
  `config.min_date` → `process.env.MIN_DATE` → `tenant_settings.min_date`.

## Esquema JSON de sesión

Cada sesión (completada o planificada) cumple este esquema, que se guarda como
JSON dentro de la tabla `sessions` de la BD (un tenant por fila):

```json
{
  "schema_version": 4,
  "id": "23828843055",
  "sport": "running",
  "name": "Alcanar Carrera",
  "title": "Carrera en Z2",
  "start_date_local": "2026-08-02T20:17:27",
  "distance_m": 10099.69,
  "moving_time_s": 3872,
  "elapsed_time_s": 3876,
  "avg_speed_ms": 2.605,
  "avg_pace_s_per_km": 384,
  "avg_heartrate": 135,
  "max_heartrate": 145,
  "avg_watts": 292,
  "max_watts": 412,
  "total_elevation_gain_m": 58,
  "total_elevation_loss_m": 59,
  "average_temp_c": 33.5,
  "training_effect": 3.2,
  "calories_kcal": 740,
  "rpe": 60,
  "feel": 75,
  "segments": [
    {
      "distance_m": 1000,
      "time_s": 405,
      "avg_speed_ms": 2.467,
      "avg_pace_s_per_km": 405,
      "max_speed_ms": 2.9,
      "avg_heartrate": 121,
      "max_heartrate": 130,
      "avg_watts": 290,
      "max_watts": 330,
      "total_elevation_gain_m": 5,
      "total_elevation_loss_m": 6,
      "intensity": "ACTIVE"
    }
  ],
  "best_efforts": [],
  "hr_zones": [
    { "zoneNumber": 2, "zoneLowBoundary": 117, "secsInZone": 3500 }
  ]
}
```

- `sport`: valor de `activityType` de Garmin (`running`, `trail_running`, `cycling`,
  `virtual_ride`, `indoor_cycling`, `lap_swimming`, `open_water_swimming`,
  `strength_training`, `paddelball`, `walking`, `hiking`, `other`, `training`, ...).
- `name`: título original de Garmin (p.ej. "Alcanar Ciclismo"). Es el valor de
  origen; no se modifica.
- `title`: tipo de entrenamiento interpretado (p.ej. "Tempo run", "Carrera en Z2",
  "Ciclismo en rodillo", "Natación series", "Fuerza"). Lo genera una IA al analizar
  la actividad, y **solo** cuando se ejecuta la generación de un plan con IA
  (`POST /api/generate-plan`), sobre las sesiones completadas de las últimas 8
  semanas que aún no tienen `title`. El código estático no genera títulos al
  sincronizar: si no hay `title`, la UI muestra `name`. El usuario puede editarlo
  en la web/JSON; `/sync` lo preserva y no lo sobreescribe.
- `avg_pace_s_per_km`: ritmo promedio en segundos por kilómetro, derivado de la
  velocidad media (`1000 / avg_speed_ms`). Para actividades sin velocidad (p.ej.
  fuerza) se omite.
- `segments`: un objeto por lap del detalle (`lapDTOs`), solo laps con distancia
  > 0. Cada segmento tiene distancia, tiempo, ritmo promedio, velocidad, FC media/máx,
  potencia media/máx, ascenso/descenso e `intensity` (`ACTIVE`, `REST`, `WARMUP`,
  `COOLDOWN`).
- `best_efforts`: array de objetos `{ name, distance_m, elapsed_time_s }` si los
  devuelve Garmin; si no, array vacío.
- `hr_zones`: array de `{ zoneNumber, zoneLowBoundary, secsInZone }` con el tiempo
  en cada zona de frecuencia cardiaca (del detalle). Solo si Garmin lo devuelve.
- `rpe` y `feel`: autoevaluación de Garmin (0–100) que rellena el usuario al terminar
  la actividad (`directWorkoutRpe` / `directWorkoutFeel` del detalle). Solo si existen.
- Campos que Garmin no devuelva: omítelos, no uses `null` inventado. Si el deporte
  es natación y no hay potencia, omite los campos de watts.

## Sesiones planificadas

Viven en la BD (tabla `sessions` con `kind = 'planned'`). Usan el mismo esquema
que las completadas, con campos opcionales adicionales:

- `title`: tipo de entrenamiento (ej. "Carrera en Z2", "5K", "Series de 400m").
  El backend lo interpreta para generar los objetivos (`objectives` en la API)
  solo cuando no hay `workout_text`.
- `workout_text`: las "vueltas" del entrenamiento en texto libre (una línea por
  bloque, series anidadas con `Nx` y pasos sangrados). Es el campo principal que
  usa la UI: si existe, se muestra en lugar de `objectives`. Formato por deporte:
  - Natación: líneas de vueltas (`300 suaves`, `4x28m Side Kick`, `7x112m continuos suaves`, ...).
  - Ciclismo: minutos con potencia (`10 min @90W`, `15 min @130-135W`), series
    anidadas con `3x` + pasos sangrados, o simplemente `MTB`.
  - Carrera: `65 min @ Z2`, o `calentamiento libre` / `12x` + `400m @ 3:30 min/km`
    + `1 min descanso` / `enfriamiento libre`.
- (Legado) `workout`: pasos estructurados (warmup/blocks/cooldown). Ya no se
  edita desde la web; el formulario lo limpia al guardar.
- (Legado) `hr_from` / `hr_to`, `distance_m`, `moving_time_s`, ...: campos
  numéricos opcionales. Las planificadas nuevas (manuales o IA) son solo texto y
  no incluyen campos numéricos.
- Las planificadas se crean/editan/borran desde la web (páginas `/planned` y
  calendario) con `schema_version: 2` e id `randomUUID()`.

**Las planificadas no se contabilizan en el resumen semanal ni en los totales**:
`/api/weekly` y los `totals` de `/api/sessions` solo usan sesiones completadas.

## Backend (`/backend`)

- Backend en Node puro (ESM, sin build) que sirve la API REST y los estáticos
  (`frontend/dist` en producción). Toda la lógica de datos vive aquí; el frontend
  solo renderiza. Arranque:
  - Dev: `node backend/server.js --port 4000` y Vite en `frontend/` (puerto 3000)
    con proxy `/api → http://localhost:4000` (ya configurado en `vite.config.ts`).
  - Producción: `node backend/server.js --port 4000 --static` (sirve `frontend/dist`).
  - Requiere `.env` (ver `README.md`). Al arrancar hace la migración si la BD está vacía.
- **Esquema**: el DDL vive en `backend/init.sql` (lo lee `backend/lib/db.js` al
  primer acceso; `CREATE TABLE IF NOT EXISTS`). Las columnas nuevas sobre tablas
  existentes se añaden con `ensureColumn` en `db.js`. **No hardcodees DDL en los
  módulos del backend**; añádelo a `init.sql` (o como `ensureColumn`).
- **Estructura**: `backend/server.js` es solo el arranque (http, dispatch estático/API,
  auth cookie o API key, `withTenant`). Las rutas están divididas por dominio en
  `backend/routes/` (`index.js` monta: auth, tenants, sessions, weekly, stats,
  goals, planned, trainer, profile, ai, sync, sync-sources, api-keys, ai-logs,
  plan-chat, equipment, ai-configs). Cada handler
  recibe un `ctx` con `{ user, token, tenantId, membership, actor, params }` y
  helpers de `backend/lib/http.js` (`sendJson`, `readBody`, `requireRole`,
  `canWrite`, `canManage`, ...). El enrutado usa `backend/lib/router.js`
  (`createRouter` con `get/post/put/delete` y parámetros `:id`).
- **Proveedores de IA**: `backend/lib/ai-provider.js` abstrae gemini/openai/
  anthropic/openai_compatible (endpoint, header de auth, body y extracción por
  proveedor) y **opencode** (instancia local `opencode serve`, por defecto
  `http://localhost:4096`, sin API key; se lista en `GET /api/ai-configs/models`
  con `configId` o `baseUrl`). `callAi(settings, {systemPrompt, userPrompt}, actor)`
  usa `ai_provider_settings.base_url` si existe; **no se hardcodea endpoint ni
  header con la key en el código de negocio**. En opencode los precios son por
  modelo: `pricing.opencode[modelId] = { input_per_mtok, output_per_mtok }`
  sobreescribe el coste que expone la instancia (`backend/lib/opencode.js`).
  `backend/lib/trainer.js` llama a `callAi` para títulos y plan.
- **Log de IA**: cada llamada a un proveedor se registra en `ai_logs` con actor
  (quién la generó), input, endpoint real, key enmascarada y respuesta/error
  (`backend/lib/ai-logs.js`, `listAiLogs`, `logAiRequest`). La key **siempre
  enmascarada** (`maskApiKey`); no se guarda nunca en claro.
- **Prompts (100% por tenant, sin prompts compartidos)**: viven en la tabla
  `ai_prompts` con una columna `role`:
  - `system` ("Prompt base"), `titles` (títulos de sesión) y `chat` (chat del
    plan): **defaults por tenant**, sembrados al crear el atleta y de forma
    perezosa para tenants existentes (`seedTenantPrompts` en
    `backend/lib/ai-prompts.js`, contenido tomado de `data/*.txt` como plantilla).
    Son `is_predefined = 1` (solo lectura). `titles` y `chat` son internos (no se
    muestran en la UI).
  - `plan`: prompts seleccionables al generar (4 predefinidos de solo lectura +
    personalizados). Los predefinidos **no se editan**: se duplican con
    `POST /api/prompts/:id/duplicate` y la copia (`is_predefined = 0`,
    `role = 'plan'`, nombre "Copia de X") ya es editable (nombre y contenido).
    Máximo 20 personalizados (`MAX_CUSTOM_PROMPTS`).
  - `backend/lib/trainer.js` lee `getRolePrompt(tenantId, role)` para el base,
    títulos y chat; los prompts de plan personalizados reciben además el bloque
    FORMATO DE RESPUESTA del `system` del tenant (`getFormatBlock`). No se leen
    ficheros `.txt` en runtime.
- Endpoints:
  - `GET /api/health`: comprobación de vida (sin auth).
  - `GET /api/auth/config`, `POST /api/auth/google`, `POST /api/auth/logout`,
    `GET /api/me`, `POST /api/switch-tenant`.
  - `GET/POST /api/tenants/:id/members` y `PUT/DELETE /api/tenants/:id/members/:userId`
    (CRUD de miembros, solo `admin`/`athlete`). `PUT /api/tenants/:id/name`
    renombra el tenant (solo `admin`/`athlete`).
  - `GET /api/sessions`: `{ completed, planned, totals, totalsCompleted }` con
    sesiones enriquecidas (`category`, `time_s`, `weekNumber`). `PUT /api/sessions/:id`
    para editar (notas, título).
  - `GET /api/weekly`: resumen semanal (solo sesiones completadas; las
    planificadas no se contabilizan).
  - `GET /api/stats`, `GET /api/stats-records`: totales y récords.
  - `GET /api/charts`: series listas para recharts (weeklyHours, trainingLoad,
    volumeEvolution, cumulativeDistance, distanceBySport, runningPaces,
    cyclingSpeeds, swimMinutes, weekChart, sportDistribution).
  - `GET/PUT /api/goals`: objetivos del plan (`GET` libre para miembros con
    acceso; `PUT` guarda, solo `admin`/`athlete`). `GET/PUT /api/meta` (fechas
    del plan: `plan_start`, `training_week_one_start`, `goal_date`, `min_date`,
    y `focus_sports`) y `GET/PUT /api/profile` (perfil del atleta) — todo por tenant.
  - `GET /api/sync-sources` (estado de fuentes), `POST .../garmin/connect`
    (login con MFA, devuelve `202 {mfaRequired:true}` si pide código),
    `POST .../garmin/mfa`, `POST .../strava/connect` (URL OAuth),
    `POST .../:provider/disconnect` y `PUT .../:provider/config`
    (guarda `min_date`/`max_date`). Callback público `GET /api/sync-sources/strava/callback`.
  - `GET/POST /api/planned` y `PUT/DELETE /api/planned/:id`: CRUD de planificadas
    (en BD; el id es el del JSON).
  - `POST /api/generate-plan`: genera planificadas con IA (rol con permisos de
    edición). Antes de llamar al LLM **actualiza el perfil del atleta** con datos
    derivados de las sesiones de las últimas 8 semanas (rango de FC Z2 en
    running, potencia media en bici, ritmo en natación y `goal.current_week`)
    y los guarda con `saveAthleteProfile` (`backend/lib/trainer.js`). El prompt
    del LLM incluye la sección "ÚLTIMOS DATOS OBTENIDOS" y "DEPORTES DE ENFOQUE"
    (los deportes de `focus_sports` del tenant; la IA genera siempre sesiones de
    esos deportes). Además, como parte de
    este endpoint, una IA analiza las sesiones completadas de las últimas 8
    semanas que aún no tienen `title` y les asigna título (ver `title` en el
    esquema); la lista actualizada se devuelve como `titlesUpdated`.
  - `POST /api/sync`: sincroniza la fuente conectada del tenant (rol con
    permisos de edición).
  - `GET/POST /api/api-keys` y `DELETE /api/api-keys/:id`: gestión de API keys
    (solo `admin`/`athlete`). `GET /api/ai-logs`: log de solicitudes de IA
    (solo `admin`/`athlete`).
- El frontend consume todo vía `frontend/src/services/api.ts` (fetch a `/api`).
  No uses el backend como origen de datos si no está corriendo.

## Frontend (`/frontend`)

- Vite + React + Tailwind. Responsive (móvil/tablet/desktop); los cambios de
  layout van tras variantes `sm:`/`md:`/`lg:` sin alterar la vista desktop.
- Páginas: Inicio (`/`), Calendario (`/calendar`), Semanal (`/weekly`),
  Estadísticas (`/stats`), Planificadas (`/planned`), Configuración (`/config`)
  y Detalle de sesión (`/session/:id`). El calendario y el detalle de sesión
  son responsive: el calendario en móvil muestra celdas compactas con puntos y
  una hoja inferior con las sesiones del día; el detalle navega Anterior/Siguiente
  entre sesiones y su botón "Volver" va al calendario.
- Configuración (`frontend/src/pages/config.tsx`) tiene un submenú con pestañas:
  **General** (nombre del tenant, fecha de inicio del plan, deportes de enfoque,
  perfil del atleta, próximos objetivos), **IA y planes** (proveedor de IA con
  base_url, prompts, log de solicitudes de IA), **Sincronización** (conexión y
  rango de fechas de Garmin/Strava) y **Acceso** (CRUD de miembros y API keys).
- El perfil muestra los bloques de "Estado actual por disciplina" solo de los
  **deportes de enfoque** seleccionados (`focus_sports`: running/ciclismo/natación;
  fuerza siempre). Los datos de deportes deseleccionados se conservan al guardar.
- Estado del calendario (mes, filtros, `showFilters`) vive fuera del componente
  en `frontend/src/lib/calendar-store.ts` (store externo con `useSyncExternalStore`)
  porque el detalle de sesión desmonta la página al navegar.
- React Query: para invalidar varias claves a la vez usa `invalidateMany(qc, keys)`
  de `frontend/src/lib/invalidate.ts` (invalida clave a clave; un solo array como
  `queryKey` no matchea). `POST /api/generate-plan` invalida también `profile`.

## Trabajar con los datos

- Los datos viven en `data/endurance.db` (SQLite, WAL). Para leer/analizar usa
  scripts Node (`node --input-type=module`) que importen `backend/lib/db.js` o
  consulten los endpoints. `sessions/` es legado: no lo modifiques.
- El comando `/sync-all` (y `/sync-session`) normaliza el listado con
  `scripts/sync-sessions.mjs` y escribe en la BD (upsert por `activity_id` +
  tenant). Soporta `--force` (sobreescribir conservando el `title`) y
  `--ids=id1,id2` (solo esos).
- Para crear un atleta nuevo: `node scripts/create-athlete.mjs --name "X"
  --owner-email correo@example.com [--profile ruta.json]` (idempotente). Al
  crearlo se siembran los prompts por defecto del tenant (`seedTenantPrompts`),
  el equipamiento y la configuración de IA.
- No modifiques los datos de un tenant sin que el usuario lo pida.
