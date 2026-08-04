#!/usr/bin/env python3
"""Fetch datos de Garmin Connect directamente (sin MCP).

Reutiliza los tokens guardados por `uvx garmin-connect-mcp auth` en
~/.garminconnect y la librería `garminconnect`.

Uso:
  python scripts/garmin-fetch.py list [--start N] [--limit N] [--min-date YYYY-MM-DD] [--out FILE]
  python scripts/garmin-fetch.py details <activity_id> [--list FILE] [--out FILE]
  python scripts/garmin-fetch.py ids [--start N] [--limit N] [--min-date YYYY-MM-DD] [--json]

El formato de salida de `list` y `details` es compatible con el que producía
el MCP de Garmin, para que `scripts/sync-sessions.mjs` funcione sin cambios.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime
from pathlib import Path

TOKENSTORE = str(Path.home() / ".garminconnect")
PAGE_SIZE = 50


def get_client():
    try:
        from garminconnect import Garmin
    except ImportError:
        sys.exit(
            "No está instalada la librería `garminconnect`. "
            "Ejecuta con: uv run --with garminconnect==0.3.8 python scripts/garmin-fetch.py ..."
        )
    g = Garmin()
    g.login(TOKENSTORE)
    return g


def write_json(obj, out: str | None) -> None:
    text = json.dumps(obj, ensure_ascii=False, indent=2) + "\n"
    if out:
        Path(out).parent.mkdir(parents=True, exist_ok=True)
        Path(out).write_text(text, encoding="utf-8")
    else:
        print(text)


# --- Formateo equivalente a response_builder.py del MCP ---------------------


def fmt_duration(seconds: float) -> str:
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    if hours > 0:
        return f"{hours}h {minutes}m {secs}s"
    elif minutes > 0:
        return f"{minutes}m {secs}s"
    return f"{secs}s"


def fmt_date(dt) -> dict:
    if isinstance(dt, str):
        dt = dt[:19]
        parsed = datetime.strptime(dt, "%Y-%m-%d %H:%M:%S")
    else:
        parsed = dt
        dt = dt.strftime("%Y-%m-%d %H:%M:%S")
    return {
        "datetime": dt,
        "date": parsed.strftime("%Y-%m-%d"),
        "day_of_week": parsed.strftime("%A"),
        "formatted": parsed.strftime("%A, %B %d, %Y at %I:%M %p"),
    }


def fmt_pace(mps: float) -> str:
    if mps == 0:
        return "N/A"
    seconds = 1000 / mps
    minutes = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{minutes}:{secs:02d} /km"


def format_activity(a: dict) -> dict:
    f = dict(a)
    if a.get("distance") is not None:
        f["distance"] = {"meters": a["distance"], "formatted": f"{a['distance'] / 1000:.2f} km"}
    if a.get("duration") is not None:
        f["duration"] = {"seconds": a["duration"], "formatted": fmt_duration(a["duration"])}
    if a.get("elevationGain") is not None:
        f["elevationGain"] = {"meters": a["elevationGain"], "formatted": f"{a['elevationGain']:.0f} m"}
    if a.get("averageSpeed") is not None:
        f["averageSpeed"] = {
            "mps": a["averageSpeed"],
            "formatted_speed": f"{a['averageSpeed'] * 3.6:.2f} km/h",
            "formatted_pace": fmt_pace(a["averageSpeed"]),
        }
    for df in ("startTimeLocal", "startTimeGMT", "endTimeLocal"):
        if a.get(df):
            f[df] = fmt_date(a[df])
    if a.get("averageHR") is not None:
        f["heart_rate"] = {"avg_bpm": round(a["averageHR"])}
    if a.get("maxHR") is not None:
        f.setdefault("heart_rate", {})["max_bpm"] = round(a["maxHR"])
    if a.get("avgPower") is not None:
        f["power"] = {"avg_watts": round(a["avgPower"])}
    if a.get("maxPower") is not None:
        f.setdefault("power", {})["max_watts"] = round(a["maxPower"])
    return f


# --- Subcomandos ------------------------------------------------------------


def fetch_activities(g, start: int, limit: int, min_date: str | None) -> list:
    activities: list = []
    cur = start
    while True:
        page = g.get_activities(cur, PAGE_SIZE)
        if isinstance(page, dict):
            page = page.get("activityList", []) or []
        page = list(page)
        if not page:
            break
        activities.extend(page)
        cur += len(page)
        last_date = (page[-1].get("startTimeLocal") or "")[:10]
        if min_date and last_date < min_date:
            break
        if len(page) < PAGE_SIZE:
            break
        time.sleep(0.5)
    if min_date:
        activities = [a for a in activities if (a.get("startTimeLocal") or "")[:10] >= min_date]
    return activities[:limit] if limit else activities


def cmd_list(args) -> None:
    g = get_client()
    acts = fetch_activities(g, args.start, args.limit, args.min_date)
    write_json({"data": {"activities": [format_activity(a) for a in acts]}}, args.out)


def cmd_ids(args) -> None:
    g = get_client()
    acts = fetch_activities(g, args.start, args.limit, args.min_date)
    ids = [str(a.get("activityId")) for a in acts if a.get("activityId") is not None]
    if args.json:
        print(json.dumps(ids, ensure_ascii=False, indent=2))
    else:
        print("\n".join(ids))


def cmd_details(args) -> None:
    g = get_client()
    activity = g.get_activity(args.activity_id)
    if not activity:
        sys.exit(f"Actividad {args.activity_id} no encontrada.")

    splits = None
    try:
        splits = g.get_activity_splits(args.activity_id)
    except Exception as e:
        print(f"aviso: no se pudieron obtener splits: {e}", file=sys.stderr)

    hr_zones = None
    try:
        hr_zones = g.get_activity_hr_in_timezones(args.activity_id)
    except Exception as e:
        print(f"aviso: no se pudieron obtener zonas FC: {e}", file=sys.stderr)

    if args.list:
        try:
            lst = json.loads(Path(args.list).read_text(encoding="utf-8"))
            for a in lst.get("data", {}).get("activities", []):
                if str(a.get("activityId")) == args.activity_id:
                    for k in ("hasIntensityIntervals", "lapCount", "hasSplits"):
                        if k in a and k not in activity:
                            activity[k] = a[k]
                    break
        except Exception as e:
            print(f"aviso: no se pudo leer --list {args.list}: {e}", file=sys.stderr)

    write_json(
        {
            "data": {
                "activity": format_activity(activity),
                "splits": splits,
                "hr_zones": hr_zones,
            }
        },
        args.out,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch directo de Garmin Connect (sin MCP).")
    sub = parser.add_subparsers(dest="command", required=True)

    p_list = sub.add_parser("list", help="Lista las actividades (formato compatible con sync-sessions).")
    p_list.add_argument("--start", type=int, default=0)
    p_list.add_argument("--limit", type=int, default=0, help="0 = sin límite (todas)")
    p_list.add_argument("--min-date", default=None, help="Solo actividades de esta fecha (YYYY-MM-DD) o posteriores")
    p_list.add_argument("--out", default=None, help="Fichero de salida; si no, stdout")
    p_list.set_defaults(func=cmd_list)

    p_ids = sub.add_parser("ids", help="Imprime los activity IDs.")
    p_ids.add_argument("--start", type=int, default=0)
    p_ids.add_argument("--limit", type=int, default=0, help="0 = sin límite (todas)")
    p_ids.add_argument("--min-date", default=None)
    p_ids.add_argument("--json", action="store_true", help="Salida como JSON array")
    p_ids.set_defaults(func=cmd_ids)

    p_det = sub.add_parser("details", help="Detalle completo de una actividad (splits + zonas FC + RPE/feel).")
    p_det.add_argument("activity_id", type=str)
    p_det.add_argument("--list", default=None, help="JSON del listado para enriquecer la actividad (hasIntensityIntervals, lapCount)")
    p_det.add_argument("--out", default=None, help="Fichero de salida; si no, stdout")
    p_det.set_defaults(func=cmd_details)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
