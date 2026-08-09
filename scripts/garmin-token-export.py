#!/usr/bin/env python3
"""Genera los tokens de Garmin Connect en TU propia máquina.

Es el método recomendado para conectar Garmin sin compartir tu contraseña
con el servidor: ejecutas este script localmente, inicias sesión en Garmin
desde tu terminal y pegas el JSON resultante en Configuración → Sincronización.

Uso:
  uv run --with garminconnect==0.3.8 python scripts/garmin-token-export.py --email X [--password Y] [--mfa CODE]

  - Si no pasas --password, se pide por teclado (no se muestra ni se guarda).
  - Si Garmin pide MFA, repite con --mfa CODIGO.

Salida (stdout, JSON):
  {"tokens": "<json>"}      -> copia TODO este JSON y pégalo en la app.

Si prefieres que la contraseña no pase por esta terminal, puedes generarlos
desde el móvil con la app oficial de Garmin y extraerlos después; el formato
que espera la app es el tokenstore de `garminconnect` (g.client.dumps()).
"""

from __future__ import annotations

import argparse
import getpass
import json
import sys


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", default=None, help="Si no se indica, se pide por teclado.")
    parser.add_argument("--mfa", default=None)
    args = parser.parse_args()

    password = args.password
    if password is None:
        password = getpass.getpass("Contraseña de Garmin (no se muestra): ")

    try:
        from garminconnect import Garmin, GarminConnectAuthenticationError
    except ImportError:
        sys.exit("No está instalada la librería `garminconnect`.")

    try:
        if args.mfa:
            g = Garmin(email=args.email, password=password, prompt_mfa=lambda: args.mfa)
        else:
            g = Garmin(email=args.email, password=password, return_on_mfa=True)
        result = g.login()
        if result and result[0] == "needs_mfa":
            print(json.dumps({"mfa_required": True}))
            return
        tokens = g.client.dumps()
        print(json.dumps({"tokens": tokens}))
    except GarminConnectAuthenticationError as e:
        print(f"error: credenciales incorrectas o código MFA inválido: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:  # noqa: BLE001 - reportar cualquier fallo de red/Garmin
        print(f"error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
