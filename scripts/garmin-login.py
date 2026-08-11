#!/usr/bin/env python3
"""Login de Garmin Connect desde el backend.

Emite el tokenstore como JSON para guardarlo en la BD (no se usa ~/.garminconnect).

Uso:
  python scripts/garmin-login.py --email X --password Y [--mfa CODE]

Salida (stdout, JSON):
  {"tokens": "<json>"}      -> login correcto
  {"mfa_required": true}    -> hace falta el código MFA
Errores: mensaje en stderr y código de salida != 0.
"""

from __future__ import annotations

import argparse
import json
import os
import sys


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", default=None)
    parser.add_argument("--mfa", default=None)
    args = parser.parse_args()
    password = args.password or os.environ.get("GARMIN_PASSWORD")
    mfa = args.mfa or os.environ.get("GARMIN_MFA")
    if not password:
        parser.error("falta la contraseña")

    try:
        from garminconnect import Garmin, GarminConnectAuthenticationError
    except ImportError:
        sys.exit("No está instalada la librería `garminconnect`.")

    try:
        if mfa:
            g = Garmin(email=args.email, password=password, prompt_mfa=lambda: mfa)
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
