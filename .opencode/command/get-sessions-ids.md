---
description: Recupera todos los IDs de las sesiones de Garmin Connect (API directa, sin MCP).
agent: build
---

Recupera los IDs de todas mis sesiones de Garmin Connect usando la API directa (no MCP).

Pasos:
1. Ejecuta el fetch directo con la librería `garminconnect` (los tokens ya están en `~/.garminconnect`):
   ```
   uv run --with garminconnect==0.3.8 python scripts/garmin-fetch.py ids --min-date 2026-05-12
   ```
   `--min-date 2026-05-12` limita a las sesiones que entran en el rango de sincronización de `sync-sessions.mjs`.
2. Muestra el total de IDs y el listado ordenado (más reciente primero). Si son muchos, resúmelos de forma compacta.
3. No guardes ficheros: el objetivo es simplemente listar los IDs.
