# Training

Seguimiento personal de entrenamientos para Ironman 70.3.

Los entrenamientos se descargan desde Garmin Connect a través del servidor MCP
`garmin-connect-mcp` (local, stdio, basado en `python-garminconnect`) y se
guardan como JSON en `sessions/`.

## Requisitos

- opencode
- [uv](https://docs.astral.sh/uv/) (se usa `uvx` para instalar y ejecutar el MCP)
- Cuenta de Garmin Connect

## Setup inicial (una sola vez)

1. Autentica el MCP de Garmin (te pedirá email, contraseña y código MFA si lo
   tienes activado; guarda los tokens en `~/.garminconnect`):

   ```sh
   uvx garmin-connect-mcp auth
   ```

2. Verifica que el conector está disponible:

   ```sh
   opencode mcp list
   ```

3. Reinicia opencode para que cargue la config.

## Uso

Invoca `/sync` para descargar los entrenamientos nuevos y guardarlos en
`sessions/`. La sincronización es incremental: solo se guardan actividades que
aún no existan en `sessions/`.

## Estructura

- `opencode.json`: config de opencode (MCP local de Garmin Connect).
- `AGENTS.md`: workflow de sync y esquema JSON de sesión.
- `.opencode/command/sync.md`: definición del comando `/sync`.
- `sessions/`: entrenamientos guardados (un JSON por actividad).

## Nota

Garmin no publica una API oficial; este MCP usa la librería no oficial
`python-garminconnect`. Si Garmin cambia sus endpoints internos, algún dato
podría dejar de estar disponible temporalmente. Es de solo lectura.
