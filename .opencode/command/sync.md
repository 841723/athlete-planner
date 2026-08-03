---
description: Sincroniza los entrenamientos de Garmin Connect y los guarda en sessions/.
agent: build
---

Sincroniza mis entrenamientos de Garmin Connect y guárdalos en `sessions/` siguiendo el workflow de AGENTS.md.

Pasos:
1. Lista los archivos en `sessions/` y extrae los `<activity_id>` ya sincronizados (cada nombre de archivo contiene el ID: `AAAAMMDD-<activity_id>-<slug>.json`).
2. Usa `garmin_query_activities` (MCP `garmin`) para listar mis actividades con paginación, hasta cubrir lo que no esté sincronizado (por defecto las más recientes). El listado ya incluye el resumen y las métricas del esquema de sesión.
3. Guarda el JSON completo de la respuesta en un archivo temporal (por ejemplo `/tmp/opencode/raw-activities.json`) y ejecuta el normalizador:
   `node scripts/sync-sessions.mjs /tmp/opencode/raw-activities.json`
   El script genera `sessions/AAAAMMDD-<activity_id>-<slug>.json` por actividad nueva (deduplicación por `<activity_id>`) siguiendo el esquema de AGENTS.md (resumen + métricas, sin streams).
4. Si para alguna actividad hicieran falta campos extra que el listado no trae (gear, etc.), usa `garmin_get_activity_details` solo en ese caso.
5. No modifiques archivos ya existentes en `sessions/`.
6. Al terminar, resume: cuántas sincronizadas, cuántas omitidas por duplicado y cuáles son.
