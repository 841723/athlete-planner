# AGENTS.md

Proyecto personal de seguimiento de entrenamientos para Ironman 70.3.
Los entrenamientos se descargan desde Garmin Connect a través del MCP de Garmin
y se guardan en `sessions/` como archivos JSON.

## Cómo sincronizar

El usuario invoca `/sync`. Ese comando contiene el workflow completo. Nunca hagas
sincronizaciones automáticas sin que el usuario lo pida.

## Fuente de datos: MCP de Garmin

- Usa exclusivamente las herramientas del MCP `garmin` para obtener datos de
  entrenamientos. No inventes datos.
- Servidor: `garmin-connect-mcp` (local, stdio). La autenticación se hace una
  sola vez con `uvx garmin-connect-mcp auth` (guarda tokens en `~/.garminconnect`).
- Las herramientas llevan el prefijo del nombre del servidor (`garmin_`):
  - `garmin_query_activities`: lista actividades con paginación (por ID, rango de
    fechas o fecha concreta).
  - `garmin_get_activity_details`: detalle completo de una actividad (splits,
    laps, zonas HR, weather, gear, métricas).
- Verifica los nombres exactos con `opencode mcp list` si tienes dudas.

## Convención de archivos en `sessions/`

- Un archivo por actividad: `sessions/AAAAMMDD-<activity_id>-<slug>.json`
  - `AAAAMMDD`: fecha local de inicio de la actividad.
  - `<activity_id>`: ID de la actividad en Garmin (permite deduplicar).
  - `<slug>`: nombre corto en minúsculas con guiones (sin espacios ni acentos).
- **Nunca dupliques** una actividad: antes de escribir, lista `sessions/` y comprueba
  que no exista ya el `<activity_id>`. Si existe, omítela.

## Esquema JSON de sesión

Cada archivo de sesión debe cumplir este esquema:

```json
{
  "schema_version": 2,
  "id": "23828843055",
  "sport": "running",
  "name": "Alcanar Carrera",
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
  "average_temp_c": 33.5,
  "training_effect": 3.2,
  "calories_kcal": 740,
  "segments": [
    {
      "distance_m": 1000,
      "time_s": 405,
      "avg_pace_s_per_km": 405,
      "avg_heartrate": 121,
      "max_heartrate": 130
    }
  ],
  "best_efforts": []
}
```

- `sport`: valor de `activityType` de Garmin (`running`, `cycling`, `swimming`,
  `virtual_ride`, `walking`, `hiking`, `other`, `training`, ...).
- `avg_pace_s_per_km`: ritmo promedio en segundos por kilómetro, derivado de la
  velocidad media (`1000 / avg_speed_ms`). Para actividades sin velocidad (p.ej.
  fuerza) se omite.
- `segments`: un objeto por lap del detalle (`lapDTOs`), solo laps con distancia
  > 0. Cada segmento tiene distancia, tiempo, ritmo promedio y FC media/máx.
- `best_efforts`: array de objetos `{ name, distance_m, elapsed_time_s }` si el
  MCP los devuelve; si no, array vacío.
- Campos que Garmin no devuelva: omítelos, no uses `null` inventado. Si el deporte
  es natación y no hay potencia, omite los campos de watts.

## Trabajar con los datos

- Para leer/analizar varias sesiones, usa las herramientas de búsqueda del proyecto
  (Glob/Grep) sobre `sessions/` o escribe scripts en Node si hace falta.
- El comando `/sync` normaliza el listado de actividades con
  `scripts/sync-sessions.mjs` (lee un JSON crudo del MCP y escribe las sesiones).
- No modifiques los archivos de `sessions/` salvo que el usuario lo pida.
