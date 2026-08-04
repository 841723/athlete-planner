---
description: Sincroniza todas las sesiones de Garmin pendientes y regenera sessions/all.json.
agent: build
---

Sincroniza todas las sesiones de Garmin que falten en `sessions/` (solo las que faltan) y guarda un resumen en `sessions/all.json`. Usa la API directa (no MCP).

Pasos:
1. Recupera todos los IDs de Garmin y guarda el JSON:
   ```
   uv run --with garminconnect==0.3.8 python scripts/garmin-fetch.py ids --min-date 2026-05-12 --json > /tmp/opencode/all-ids.json
   ```
2. Calcula los IDs faltantes comparando con los archivos de `sessions/*.json` (ignora `sessions/planned/`). Si quieres, ejecuta primero `/get-sessions-ids-missing`.
3. Si no hay faltantes, termina avisando de que no hay nada que sincronizar (y regenera `sessions/all.json` igualmente con `node scripts/build-summary.mjs`).
4. Descarga el listado completo:
   ```
   uv run --with garminconnect==0.3.8 python scripts/garmin-fetch.py list --min-date 2026-05-12 --out /tmp/opencode/raw-activities.json
   ```
5. Para **cada** ID faltante, descarga su detalle:
   ```
   uv run --with garminconnect==0.3.8 python scripts/garmin-fetch.py details <id> --list /tmp/opencode/raw-activities.json --out /tmp/opencode/details/<id>.json
   ```
6. Normaliza solo los faltantes:
   ```
   node scripts/sync-sessions.mjs /tmp/opencode/raw-activities.json /tmp/opencode/details --ids=<csv-de-ids-faltantes>
   ```
7. Regenera el resumen de todas las sesiones:
   ```
   node scripts/build-summary.mjs
   ```
8. Resume: cuántas sincronizadas, cuántas omitidas por duplicado, cuántas filtradas por fecha y cuáles son.
