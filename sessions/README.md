# sessions/

Carpeta con los entrenamientos sincronizados desde Garmin Connect (API directa,
sin MCP).

- Un archivo JSON por actividad.
- Formato de nombre: `AAAAMMDD-<activity_id>-<slug>.json`.
- Se rellena con el comando `/sync-all` o `/sync-session <activity_id>` (nunca a mano).
- `all.json`: índice/resumen de todas las sesiones (lo genera `/sync-all`).
- `missing.json`: IDs pendientes de sincronizar (lo genera `/get-sessions-ids-missing`).
- No editar estos archivos manualmente.
