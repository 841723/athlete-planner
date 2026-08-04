import { getSessionTime } from "./sessions.js";

const DISTANCE_TITLES = {
  "5K": 5000,
  "10K": 10000,
  "21K": 21097,
  "MEDIO MARATÓN": 21097,
  "MEDIO MARATON": 21097,
  "MARATÓN": 42195,
  "MARATON": 42195,
};

function isZ2Title(title) {
  const m = title.match(/Z([1-5])/i);
  return m ? `Z${m[1]}` : null;
}

function parseDistanceFromTitle(title) {
  const upper = title.toUpperCase();
  for (const [key, dist] of Object.entries(DISTANCE_TITLES)) {
    if (upper.includes(key)) return dist;
  }
  return null;
}

function formatDuration(seconds) {
  if (seconds == null) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatPaceShort(secPerKm) {
  const min = Math.floor(secPerKm / 60);
  const sec = Math.floor(secPerKm % 60);
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

function formatWorkoutBlock(block, sport) {
  const isSwim = sport.includes("swimming");
  if (block.type === "intervals" || block.repeat) {
    const repeat = block.repeat ?? 1;
    const dist = block.distance_m;
    const time = block.time_s;
    const pace = block.pace_s_per_km;

    let part = `${repeat}×`;
    if (dist) {
      part += isSwim
        ? `${(dist / 100).toFixed(0)}×100m`
        : dist >= 1000
          ? `${(dist / 1000).toFixed(1)}km`
          : `${dist}m`;
    } else if (time) {
      part += formatDuration(time);
    }

    if (pace) part += ` @ ${formatPaceShort(pace)}/km`;
    if (block.hr_from && block.hr_to) part += ` · FC ${block.hr_from}-${block.hr_to}`;
    if (block.rest_s) part += ` + ${formatDuration(block.rest_s)} descanso`;
    return part;
  }

  if (block.type === "steady" || block.time_s) {
    const dur = block.time_s ? formatDuration(block.time_s) : null;
    const pace = block.pace_s_per_km ? ` @ ${formatPaceShort(block.pace_s_per_km)}/km` : "";
    const hr = block.hr_from && block.hr_to ? ` · FC ${block.hr_from}-${block.hr_to}` : "";
    return [dur, pace, hr].filter(Boolean).join("") || null;
  }

  return null;
}

export function buildObjectives(session) {
  const objectives = [];
  const workout = session.workout;
  const title = session.title ?? session.name;
  const sport = session.sport;
  const timeSec = getSessionTime(session);

  if (workout) {
    if (workout.warmup_s) {
      objectives.push({ label: "Calentamiento", text: formatDuration(workout.warmup_s) });
    }
    for (const block of workout.blocks ?? []) {
      const label = block.type === "intervals" ? "Series" : "Fondo";
      const text = formatWorkoutBlock(block, sport);
      if (text) objectives.push({ label, text });
    }
    if (workout.cooldown_s) {
      objectives.push({ label: "Enfriamiento", text: formatDuration(workout.cooldown_s) });
    }
    return objectives;
  }

  const distFromTitle = parseDistanceFromTitle(title);
  const zone = isZ2Title(title);

  if (distFromTitle) {
    objectives.push({
      label: "Distancia objetivo",
      text: `${(distFromTitle / 1000).toFixed(distFromTitle % 1000 === 0 ? 0 : 1)} km`,
    });
    if (session.avg_pace_s_per_km) {
      objectives.push({
        label: "Ritmo objetivo",
        text: `${formatPaceShort(session.avg_pace_s_per_km)}/km`,
      });
    }
    return objectives;
  }

  if (zone) {
    if (timeSec > 0) {
      objectives.push({ label: "Tiempo objetivo", text: formatDuration(timeSec) });
    }
    if (session.hr_from && session.hr_to) {
      objectives.push({ label: "FC objetivo", text: `${session.hr_from}-${session.hr_to} ppm` });
    } else {
      objectives.push({ label: "FC objetivo", text: `Zona ${zone}` });
    }
    return objectives;
  }

  if (session.distance_m && session.distance_m > 100) {
    objectives.push({
      label: "Distancia",
      text:
        session.distance_m >= 1000
          ? `${(session.distance_m / 1000).toFixed(1)} km`
          : `${Math.round(session.distance_m)} m`,
    });
  }
  if (session.avg_pace_s_per_km) {
    objectives.push({
      label: "Ritmo",
      text: `${formatPaceShort(session.avg_pace_s_per_km)}/km`,
    });
  }
  if (timeSec > 0) {
    objectives.push({ label: "Tiempo", text: formatDuration(timeSec) });
  }
  if (session.avg_heartrate) {
    objectives.push({ label: "FC media", text: `${session.avg_heartrate} ppm` });
  }
  return objectives;
}
