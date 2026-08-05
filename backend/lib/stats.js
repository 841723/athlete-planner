import { getSportCategory, getSessionTime, getWeekNumber, toLocalDateKey } from "./sessions.js";

const SPORT_CATEGORY_KEYS = [
  "running",
  "cycling",
  "swimming",
  "strength",
  "hiking",
  "walking",
  "padel",
  "other",
];

function avg(list) {
  if (list.length === 0) return null;
  return list.reduce((a, b) => a + b, 0) / list.length;
}

function buildSportStats(cat, list, all, speedMaxSessions) {
  const dist = list.reduce((sum, s) => sum + (s.distance_m ?? 0), 0);
  const hours = list.reduce((sum, s) => sum + getSessionTime(s) / 3600, 0);
  const durations = list.map((s) => getSessionTime(s));
  const avgDur = avg(durations);
  const maxDur = durations.length > 0 ? Math.max(...durations) : null;
  const hrList = list.filter((s) => s.avg_heartrate).map((s) => s.avg_heartrate);
  const maxHrList = list.filter((s) => s.max_heartrate).map((s) => s.max_heartrate);

  const withDist = list.filter((s) => s.distance_m && s.moving_time_s);
  const distances = withDist.map((s) => s.distance_m / 1000);
  const paces = withDist.map((s) => (s.moving_time_s / s.distance_m) * 1000);
  const speeds = withDist.map((s) => (s.distance_m / s.moving_time_s) * 3.6);
  const paces100 = withDist.map((s) => (s.moving_time_s / s.distance_m) * 100);

  const speedMaxPool = speedMaxSessions ?? list;
  const speedMaxList = speedMaxPool
    .filter((s) => s.max_speed_ms != null && s.max_speed_ms > 0)
    .map((s) => s.max_speed_ms * 3.6);

  const wattsList = list.filter((s) => s.avg_watts).map((s) => s.avg_watts);
  const maxWatts = list.reduce((m, s) => Math.max(m, s.max_watts ?? 0), 0);

  const elevList = list
    .filter((s) => s.total_elevation_gain_m)
    .map((s) => s.total_elevation_gain_m);

  const totalHours = Math.max(
    0.0001,
    all.reduce((sum, s) => sum + getSessionTime(s) / 3600, 0)
  );

  return {
    cat,
    sessions: list.length,
    sessionsPct: all.length > 0 ? (list.length / all.length) * 100 : 0,
    hours,
    hoursPct: (hours / totalHours) * 100,
    distanceKm: dist / 1000,
    avgDistanceKm: withDist.length > 0 ? dist / 1000 / withDist.length : null,
    maxDistanceKm: distances.length > 0 ? Math.max(...distances) : null,
    avgDurationSec: avgDur,
    maxDurationSec: maxDur,
    avgHr: avg(hrList),
    maxHr: maxHrList.length > 0 ? Math.max(...maxHrList) : null,
    avgPaceSecPerKm: avg(paces),
    bestPaceSecPerKm: paces.length > 0 ? Math.min(...paces) : null,
    avgSpeedKmh: avg(speeds),
    maxSpeedKmh: speedMaxList.length > 0 ? Math.max(...speedMaxList) : null,
    avgWatts: avg(wattsList),
    maxWatts: maxWatts > 0 ? maxWatts : null,
    avgPace100: avg(paces100),
    bestPace100: paces100.length > 0 ? Math.min(...paces100) : null,
    avgElevationGain: avg(elevList),
    maxElevationGain: elevList.length > 0 ? Math.max(...elevList) : null,
  };
}

const RODILLO_SPORTS = new Set(["virtual_ride", "indoor_cycling"]);

export function buildStats(completed) {
  const all = [...completed];

  const sportSessions = {};
  for (const cat of SPORT_CATEGORY_KEYS) sportSessions[cat] = [];
  for (const s of all) {
    sportSessions[getSportCategory(s.sport)].push(s);
  }

  const cyclingOutdoor = sportSessions.cycling.filter((s) => !RODILLO_SPORTS.has(s.sport));

  const totalDistance = all.reduce((sum, s) => sum + (s.distance_m ?? 0), 0);
  const totalHours = all.reduce((sum, s) => sum + getSessionTime(s) / 3600, 0);
  const totalElevation = all.reduce((sum, s) => sum + (s.total_elevation_gain_m ?? 0), 0);
  const totalCalories = all.reduce((sum, s) => sum + (s.calories_kcal ?? 0), 0);
  const totalMovingSec = all.reduce((sum, s) => sum + getSessionTime(s), 0);

  const bySport = {};
  for (const cat of SPORT_CATEGORY_KEYS) {
    bySport[cat] = buildSportStats(cat, sportSessions[cat], all);
  }
  bySport.cycling = buildSportStats("cycling", sportSessions.cycling, all, cyclingOutdoor);

  const hrZoneSeconds = {};
  for (const s of all) {
    for (const z of s.hr_zones ?? []) {
      hrZoneSeconds[z.zoneNumber] = (hrZoneSeconds[z.zoneNumber] ?? 0) + z.secsInZone;
    }
  }
  const dominantZone = Object.entries(hrZoneSeconds).sort(([, a], [, b]) => b - a)[0];

  const bestEfforts = {};
  for (const s of all) {
    for (const e of s.best_efforts ?? []) {
      const key = e.name;
      if (!bestEfforts[key] || e.elapsed_time_s < bestEfforts[key].time_s) {
        bestEfforts[key] = { name: e.name, time_s: e.elapsed_time_s };
      }
    }
  }

  const dates = new Set(all.map((s) => s.start_date_local?.slice(0, 10)).filter(Boolean));
  const sortedDates = [...dates].sort();
  const firstDate = sortedDates[0];
  const lastDate = sortedDates[sortedDates.length - 1];

  const todayKey = toLocalDateKey(new Date());
  const streakActive = dates.has(todayKey);
  let streak = 0;
  let cursor = streakActive ? new Date() : new Date(Date.now() - 86400000);
  while (dates.has(toLocalDateKey(cursor))) {
    streak++;
    cursor = new Date(cursor.getTime() - 86400000);
  }

  let longestStreak = 0;
  let run = 0;
  let prev = null;
  for (const d of sortedDates) {
    const date = new Date(`${d}T00:00:00`);
    if (prev && Math.round((date.getTime() - prev.getTime()) / 86400000) === 1) {
      run++;
    } else {
      run = 1;
    }
    longestStreak = Math.max(longestStreak, run);
    prev = date;
  }

  const weeksSet = new Set();
  for (const s of all) {
    if (s.start_date_local) weeksSet.add(getWeekNumber(new Date(s.start_date_local)));
  }
  const activeWeeks = weeksSet.size;

  const tempList = all.filter((s) => s.average_temp_c).map((s) => s.average_temp_c);
  const avgTemp = avg(tempList);
  const teList = all.filter((s) => s.training_effect != null).map((s) => s.training_effect);
  const avgTe = avg(teList);
  const totalTe = teList.reduce((a, b) => a + b, 0);
  const avgRpe = avg(all.filter((s) => s.rpe != null).map((s) => s.rpe));
  const avgFeel = avg(all.filter((s) => s.feel != null).map((s) => s.feel));
  const rpeCount = all.filter((s) => s.rpe != null).length;

  return {
    totals: {
      totalDistance,
      totalHours,
      totalElevation,
      totalCalories,
      totalMovingSec,
      totalSessions: all.length,
      distPerSession: all.length > 0 ? totalDistance / 1000 / all.length : null,
      kcalPerSession: all.length > 0 ? totalCalories / all.length : null,
    },
    bySport,
    global: {
      dominantZone,
      bestEfforts,
      avgTemp,
      avgTe,
      totalTe,
      avgRpe,
      avgFeel,
      rpeCount,
      streak,
      streakActive,
      longestStreak,
      activeWeeks,
      avgHr: avg(all.filter((s) => s.avg_heartrate).map((s) => s.avg_heartrate)),
      maxHr: (() => { const vals = all.map((s) => s.max_heartrate).filter((v) => v != null); return vals.length > 0 ? Math.max(...vals) : null; })(),
      maxWatts: (() => { const vals = all.map((s) => s.max_watts).filter((v) => v != null && v > 0); return vals.length > 0 ? Math.max(...vals) : null; })(),
      avgSessionsPerWeek: activeWeeks > 0 ? all.length / activeWeeks : null,
      avgHoursPerWeek: activeWeeks > 0 ? totalHours / activeWeeks : null,
      avgDistancePerWeek: activeWeeks > 0 ? totalDistance / 1000 / activeWeeks : null,
    },
    dates: { firstDate, lastDate },
  };
}
