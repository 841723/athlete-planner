---
description: Sincroniza los entrenamientos de Garmin Connect que faltan y guarda el resumen en sessions/all.json.
agent: build
---

Sincroniza mis entrenamientos de Garmin Connect y guárdalos en `sessions/` siguiendo el workflow de AGENTS.md, usando la API directa de Garmin (sin MCP).

Este comando es un alias de `/sync-all`. Ejecuta exactamente el workflow de `.opencode/command/sync-all.md`:
1. Recupera los IDs de Garmin (`scripts/garmin-fetch.py ids`) y compara con `sessions/` para saber cuáles faltan.
2. Descarga listado y detalles solo de las que faltan (`scripts/garmin-fetch.py list` + `details` por id).
3. Normaliza con `node scripts/sync-sessions.mjs <listado> <detalles> --ids=<faltantes>`.
4. Regenera el resumen con `node scripts/build-summary.mjs`.
5. No modifiques archivos ya existentes en `sessions/` y no sobreescribas el campo `title` editado a mano (añade `--force` solo si hace falta re-normalizar conservándolo).
6. Al terminar, resume: cuántas sincronizadas, cuántas omitidas por duplicado, cuántas filtradas y cuáles son.
