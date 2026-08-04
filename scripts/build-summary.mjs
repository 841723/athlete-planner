#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

// Genera sessions/all.json con un resumen de todas las sesiones de sessions/.
const sessionsDir = process.argv[2] ?? "sessions";

const all = [];
for (const file of fs.readdirSync(sessionsDir)) {
  if (!file.endsWith(".json")) continue;
  const full = path.join(sessionsDir, file);
  if (fs.statSync(full).isDirectory()) continue;
  try {
    const s = JSON.parse(fs.readFileSync(full, "utf8"));
    all.push({
      id: s.id,
      date: (s.start_date_local ?? "").slice(0, 10),
      sport: s.sport,
      name: s.name,
      title: s.title,
      distance_m: s.distance_m,
      moving_time_s: s.moving_time_s,
      avg_heartrate: s.avg_heartrate,
      avg_pace_s_per_km: s.avg_pace_s_per_km,
      rpe: s.rpe,
      feel: s.feel,
      segments: (s.segments ?? []).length,
    });
  } catch {
    /* ignorar JSON inválido */
  }
}

all.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
const out = {
  generated_at: new Date().toISOString(),
  count: all.length,
  sessions: all,
};
fs.writeFileSync(path.join(sessionsDir, "all.json"), JSON.stringify(out, null, 2) + "\n");
console.log(`Resumen generado: ${all.length} sesiones -> ${path.join(sessionsDir, "all.json")}`);
