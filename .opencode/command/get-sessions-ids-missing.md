---
description: Calcula los IDs de Garmin aún no sincronizados en sessions/ y los guarda en sessions/missing.json.
agent: build
---

Calcula qué sesiones de Garmin faltan en `sessions/` y guárdalas en `sessions/missing.json`.

Pasos:
1. Recupera todos los IDs de Garmin:
   ```
   uv run --with garminconnect==0.3.8 python scripts/garmin-fetch.py ids --min-date 2026-05-12 --json
   ```
   Guarda la salida en `/tmp/opencode/all-ids.json`.
2. Extrae los IDs ya sincronizados leyendo los nombres de los archivos de `sessions/` con Glob sobre `sessions/*.json` (patrón `AAAAMMDD-<activity_id>-<slug>.json`). Ignora `sessions/planned/` y `sessions/README.md`.
3. Calcula la diferencia: IDs de Garmin que no aparecen en `sessions/`.
4. Escribe `sessions/missing.json` con este esquema:
   ```json
   {
     "generated_at": "<fecha>",
     "total": N,
     "synced": M,
     "missing": ["<id>", "..."]
   }
   ```
5. Resume: total de IDs, cuántos sincronizados y cuántos faltan (lista).
