#!/usr/bin/env python3
"""Fetch datos de Garmin Connect directamente (sin MCP).

Reutiliza los tokens guardados por `uvx garmin-connect-mcp auth` en
~/.garminconnect y la librería `garminconnect`.

Uso:
  python scripts/garmin-fetch.py list [--start N] [--limit N] [--min-date YYYY-MM-DD] [--out FILE]
  python scripts/garmin-fetch.py details <activity_id> [--list FILE] [--out FILE]
  python scripts/garmin-fetch.py track <activity_id> [--out FILE]
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
    for loc in ("locationName", "locationNameFull"):
        if a.get(loc):
            f[loc] = a[loc]
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


def extract_polyline(details: dict) -> list:
    points: list = []

    def point_from(p: dict) -> list | None:
        lat = p.get("lat")
        lon = p.get("lon")
        if lat is None or lon is None:
            return None
        alt = p.get("altitude", p.get("alt"))
        return [lat, lon, alt]

    dtos = details.get("geoPolylineDTO")
    if isinstance(dtos, dict):
        dtos = [dtos]
    if not isinstance(dtos, list):
        dtos = details.get("geoPolylineDTOs") or []

    for dto in dtos:
        if not isinstance(dto, dict):
            continue
        for pt in dto.get("polyline") or []:
            point = point_from(pt)
            if point is not None:
                points.append(point)
        for key in ("startPoint", "endPoint"):
            point = point_from(dto.get(key) or {})
            if point is not None:
                points.append(point)

    if not points:
        return []

    deduped: list = []
    prev = None
    for p in points:
        if p != prev:
            deduped.append(p)
        prev = p

    if len(deduped) > 1500:
        step = len(deduped) / 1500
        sampled = [deduped[int(i * step)] for i in range(1500)]
        if sampled[-1] != deduped[-1]:
            sampled.append(deduped[-1])
        deduped = sampled

    return deduped


def extract_samples(details: dict) -> list:
    try:
        from garminconnect.activity_details import parse_activity_detail_metrics
    except ImportError:
        return []

    try:
        parsed = parse_activity_detail_metrics(details)
    except Exception:
        return []

    keys = {
        "directTimestamp": "t",
        "directHeartRate": "hr",
        "directSpeed": "speed",
        "directPower": "power",
        "directCadence": "cadence",
        "sumDistance": "distance",
        "directElevation": "elevation",
    }
    target = 600
    step = max(1, len(parsed) // target)
    samples: list = []
    for i in range(0, len(parsed), step):
        m = parsed[i]
        sample = {}
        for k, newk in keys.items():
            v = m.get(k)
            if v is not None:
                sample[newk] = v
        if sample:
            samples.append(sample)
    return samples


def cmd_track(args) -> None:
    g = get_client()
    activity = g.get_activity(args.activity_id)
    if not activity:
        sys.exit(f"Actividad {args.activity_id} no encontrada.")

    atype = activity.get("activityType") or {}
    sport = atype.get("typeKey") if isinstance(atype, dict) else None

    polyline: list = []
    samples: list = []
    try:
        details = g.get_activity_details(args.activity_id, maxchart=1000, maxpoly=1500)
    except Exception as e:
        print(f"aviso: no se pudieron obtener detalles del track: {e}", file=sys.stderr)
        details = None

    if details:
        polyline = extract_polyline(details)
        samples = extract_samples(details)

    write_json({"sport": sport, "polyline": polyline, "samples": samples}, args.out)


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

    p_track = sub.add_parser("track", help="Track GPS + métricas por punto de una actividad.")
    p_track.add_argument("activity_id", type=str)
    p_track.add_argument("--out", default=None, help="Fichero de salida; si no, stdout")
    p_track.set_defaults(func=cmd_track)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
