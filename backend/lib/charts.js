import { getSportCategory, getSessionTime, getWeekNumber, toLocalDateKey } from "./sessions.js";

function byWeekAggregate(sessions, keyFn) {
  const byWeek = {};
  for (const s of sessions) {
    if (!s.start_date_local) continue;
    const date = new Date(s.start_date_local);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    const key = toLocalDateKey(weekStart);
    byWeek[key] = (byWeek[key] ?? 0) + keyFn(s);
  }
  return Object.entries(byWeek)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([week, value]) => ({
      week: `W${getWeekNumber(new Date(week))}`,
      value: Math.round(value * 10) / 10,
    }));
}

export function buildCharts(completed, weekly) {
  const weeklyHours = byWeekAggregate(completed, (s) => getSessionTime(s) / 3600).map(
    ({ week, value }) => ({ week, hours: value })
  );

  const trainingLoad = byWeekAggregate(completed, (s) => getSessionTime(s) / 3600).map(
    ({ week, value }) => ({ week, load: value })
  );

  const sorted = [...completed]
    .filter((s) => s.start_date_local)
    .sort((a, b) => a.start_date_local.localeCompare(b.start_date_local));

  let cumulativeHours = 0;
  let cumulativeDist = 0;
  const volumeEvolution = sorted.map((s) => {
    cumulativeHours += getSessionTime(s) / 3600;
    cumulativeDist += (s.distance_m ?? 0) / 1000;
    return {
      date: s.start_date_local.slice(0, 10),
      hours: Math.round(cumulativeHours * 10) / 10,
      distance: Math.round(cumulativeDist * 10) / 10,
    };
  });

  let cumulative = 0;
  const cumulativeDistance = sorted.map((s) => {
    cumulative += (s.distance_m ?? 0) / 1000;
    return {
      date: s.start_date_local.slice(0, 10),
      cumulative: Math.round(cumulative * 10) / 10,
    };
  });

  const distByWeek = {};
  for (const s of completed) {
    if (!s.start_date_local) continue;
    const date = new Date(s.start_date_local);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    const key = toLocalDateKey(weekStart);
    if (!distByWeek[key]) distByWeek[key] = {};
    const sport = getSportCategory(s.sport);
    const dist = (s.distance_m ?? 0) / 1000;
    distByWeek[key][sport] = (distByWeek[key][sport] ?? 0) + dist;
  }
  const distanceBySport = Object.entries(distByWeek)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([week, sports]) => ({
      week: `W${getWeekNumber(new Date(week))}`,
      ...sports,
    }));

  const runningPaces = completed
    .filter((s) => getSportCategory(s.sport) === "running" && s.avg_pace_s_per_km && s.start_date_local)
    .sort((a, b) => a.start_date_local.localeCompare(b.start_date_local))
    .map((s) => ({
      date: s.start_date_local.slice(0, 10),
      pace: s.avg_pace_s_per_km,
    }));

  const cyclingSpeeds = completed
    .filter((s) => getSportCategory(s.sport) === "cycling" && s.avg_speed_ms && s.start_date_local)
    .sort((a, b) => a.start_date_local.localeCompare(b.start_date_local))
    .map((s) => ({
      date: s.start_date_local.slice(0, 10),
      speed: Math.round(s.avg_speed_ms * 3.6 * 10) / 10,
    }));

  const swimMinutes = completed
    .filter((s) => getSportCategory(s.sport) === "swimming" && s.moving_time_s && s.start_date_local)
    .sort((a, b) => a.start_date_local.localeCompare(b.start_date_local))
    .map((s) => ({
      date: s.start_date_local.slice(0, 10),
      minutes: Math.round((s.moving_time_s / 60) * 10) / 10,
    }));

  const weekChart = (weekly ?? []).map((w) => ({
    week: `W${w.weekNumber}`,
    hours: w.hours,
    distance: w.distance_km,
  }));

  const sportTotals = {};
  for (const w of weekly ?? []) {
    for (const [sport, count] of Object.entries(w.bySport)) {
      sportTotals[sport] = (sportTotals[sport] ?? 0) + count;
    }
  }
  const sportDistribution = Object.entries(sportTotals)
    .filter(([, v]) => v > 0)
    .map(([sport, value]) => ({
      sport,
      value: Math.round(value * 10) / 10,
    }));

  return {
    weeklyHours,
    trainingLoad,
    volumeEvolution,
    cumulativeDistance,
    distanceBySport,
    runningPaces,
    cyclingSpeeds,
    swimMinutes,
    weekChart,
    sportDistribution,
  };
}
