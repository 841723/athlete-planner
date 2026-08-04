# AGENTS.md

Proyecto personal de seguimiento de entrenamientos para Ironman 70.3.
Los entrenamientos se descargan desde Garmin Connect mediante la API directa
(`scripts/garmin-fetch.py`) y se guardan en `sessions/` como archivos JSON.

## Cómo sincronizar

El usuario invoca `/sync-all` (o `/sync`, su alias) para sincronizar solo las
sesiones que faltan. Nunca hagas sincronizaciones automáticas sin que el usuario
lo pida.

Comandos disponibles:

- `/get-sessions-ids`: lista todos los IDs de actividades de Garmin.
- `/get-sessions-ids-missing`: calcula los IDs que faltan en `sessions/` y los
  guarda en `sessions/missing.json`.
- `/sync-session <activity_id>`: sincroniza una única sesión.
- `/sync-all`: sincroniza todas las sesiones pendientes y regenera
  `sessions/all.json` con el resumen de todas.

## Fuente de datos: API directa de Garmin (sin MCP)

- **No uses el MCP para obtener datos.** Toda la descarga se hace con
  `scripts/garmin-fetch.py`, que usa la librería `garminconnect` y reutiliza los
  tokens de `~/.garminconnect`.
- La autenticación se hace una sola vez con `uvx garmin-connect-mcp auth` (guarda
  tokens en `~/.garminconnect`). A partir de ahí el MCP ya no se usa.
- Ejecuta siempre con `uv run --with garminconnect==0.3.8 python scripts/garmin-fetch.py ...`.
- Subcomandos de `scripts/garmin-fetch.py`:
  - `list [--min-date YYYY-MM-DD] [--out FILE]`: listado de actividades con el
    mismo formato que consumía el MCP (`data.activities`).
  - `details <activity_id> [--list FILE] [--out FILE]`: detalle de una actividad
    (splits `lapDTOs`, `hr_zones`, RPE/feel en `activity.summaryDTO`).
  - `ids [--min-date YYYY-MM-DD] [--json]`: imprime los activity IDs.
- `--min-date 2026-05-12` es el rango de sincronización (debe coincidir con
  `MIN_DATE` de `scripts/sync-sessions.mjs`).

## Convención de archivos en `sessions/`

- Un archivo por actividad: `sessions/AAAAMMDD-<activity_id>-<slug>.json`
  - `AAAAMMDD`: fecha local de inicio de la actividad.
  - `<activity_id>`: ID de la actividad en Garmin (permite deduplicar).
  - `<slug>`: nombre corto en minúsculas con guiones (sin espacios ni acentos).
- **Nunca dupliques** una actividad: antes de escribir, lista `sessions/` y comprueba
  que no exista ya el `<activity_id>`. Si existe, omítela.
- `sessions/all.json`: resumen de todas las sesiones (generado por
  `scripts/build-summary.mjs`). No es una sesión, es un índice.
- `sessions/missing.json`: lista de IDs pendientes (generado por
  `/get-sessions-ids-missing`). Tampoco es una sesión.

## Esquema JSON de sesión

Cada archivo de sesión debe cumplir este esquema:

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

- `sport`: valor de `activityType` de Garmin (`running`, `cycling`, `swimming`,
  `virtual_ride`, `walking`, `hiking`, `other`, `training`, ...).
- `title`: tipo de entrenamiento interpretado (p.ej. "Carrera en Z2", "Bici llana",
  "Natación aguas abiertas", "Natación piscina", "Series de 400m"). El usuario puede
  editarlo a mano en el JSON; `/sync` lo preserva y no lo sobreescribe.
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

## Trabajar con los datos

- Para leer/analizar varias sesiones, usa las herramientas de búsqueda del proyecto
  (Glob/Grep) sobre `sessions/` o escribe scripts en Node si hace falta.
- El comando `/sync-all` (y `/sync-session`) normaliza el listado de actividades con
  `scripts/sync-sessions.mjs` (lee el JSON de `garmin-fetch.py` y escribe las sesiones).
  Soporta `--force` (sobreescribir conservando el `title`) y `--ids=id1,id2` (solo esos).
- `sessions/all.json` lo regenera `scripts/build-summary.mjs` al terminar cada sync.
- No modifiques los archivos de `sessions/` salvo que el usuario lo pida.
