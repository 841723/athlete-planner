---
description: Sincroniza una sola sesión de Garmin (por activity_id) y la guarda como JSON en sessions/.
agent: build
---

Sincroniza una única sesión de Garmin. `$1` = `<activity_id>` (obligatorio). Usa la API directa (no MCP).

Pasos:
1. Comprueba la deduplicación: busca `<activity_id>` en los nombres de `sessions/*.json` (patrón `AAAAMMDD-<activity_id>-<slug>.json`). Si ya existe y no usas `--force`, omítela y avisa al usuario.
2. Descarga el listado completo y guárdalo:
   ```
   uv run --with garminconnect==0.3.8 python scripts/garmin-fetch.py list --min-date 2026-05-12 --out /tmp/opencode/raw-activities.json
   ```
3. Descarga el detalle de la sesión (splits, zonas FC, RPE/feel, ascenso/descenso por vuelta):
   ```
   uv run --with garminconnect==0.3.8 python scripts/garmin-fetch.py details <activity_id> --list /tmp/opencode/raw-activities.json --out /tmp/opencode/details/<activity_id>.json
   ```
4. Normaliza solo esa actividad (genera el JSON en `sessions/` con título interpretado, p. ej. "Carrera en Z2"):
   ```
   node scripts/sync-sessions.mjs /tmp/opencode/raw-activities.json /tmp/opencode/details --ids=<activity_id>
   ```
   Si quieres sobreescribir una existente conservando su `title` editado a mano, añade `--force`.
5. Regenera el resumen de todas las sesiones:
   ```
   node scripts/build-summary.mjs
   ```
6. Muestra el resultado: archivo creado, título interpretado y número de segmentos/vueltas.
