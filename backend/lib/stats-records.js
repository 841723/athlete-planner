import { getSessionTime, getWeekNumber } from "./sessions.js";

function findRecord(sessions, field, comparator) {
  let best = null;
  for (const s of sessions) {
    const val = field ? s[field] : s;
    if (val == null) continue;
    if (!best || comparator(val, best.value)) {
      best = { value: val, session: s };
    }
  }
  return best;
}

function getSessionHour(s) {
  const time = s.start_date_local?.slice(11, 16);
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  return h + m / 60;
}

function spansTwoDays(s) {
  if (!s.start_date_local) return false;
  const start = new Date(s.start_date_local);
  const dur = getSessionTime(s);
  if (!dur) return false;
  const end = new Date(start.getTime() + dur * 1000);
  return start.getDate() !== end.getDate();
}

function formatDuration(sec) {
  if (!sec) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  if (h > 0) return `${h}h ${m}min`;
  if (m > 0) return `${m}min ${s}s`;
  return `${s}s`;
}

function formatPace(secPerKm) {
  if (!secPerKm) return "—";
  const min = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  return `${min}:${String(sec).padStart(2, "0")}`;
}

function formatPace100(secPer100m) {
  if (!secPer100m) return "—";
  const min = Math.floor(secPer100m / 60);
  const sec = Math.round(secPer100m % 60);
  return `${min}:${String(sec).padStart(2, "0")}`;
}

function sessionToRecord(session) {
  if (!session) return null;
  return {
    sessionId: session.id,
    sessionName: session.title ?? session.name,
    sessionDate: session.start_date_local?.slice(0, 10) ?? "",
  };
}

function findBestEffortsBySport(completed, sportCategory, sportLabel) {
  const sportSessions = completed.filter((s) => {
    const cat = s.category ?? s.sport;
    return cat === sportCategory;
  });

  const efforts = {};
  for (const s of sportSessions) {
    for (const e of s.best_efforts ?? []) {
      const key = e.name;
      if (!efforts[key] || e.elapsed_time_s < efforts[key].time_s) {
        efforts[key] = {
          name: e.name,
          distance_m: e.distance_m,
          time_s: e.elapsed_time_s,
          session: s,
        };
      }
    }
  }

  return Object.values(efforts)
    .sort((a, b) => a.distance_m - b.distance_m)
    .map((e) => ({
      name: e.name,
      distance_m: e.distance_m,
      time_s: e.time_s,
      ...sessionToRecord(e.session),
    }));
}

function findTopEffortsBySport(completed, sportCategory, limit = 3) {
  const sportSessions = completed.filter((s) => {
    const cat = s.category ?? s.sport;
    return cat === sportCategory;
  });

  const efforts = {};
  for (const s of sportSessions) {
    for (const e of s.best_efforts ?? []) {
      const key = e.name;
      if (!efforts[key]) efforts[key] = [];
      efforts[key].push({
        name: e.name,
        distance_m: e.distance_m,
        time_s: e.elapsed_time_s,
        session: s,
      });
    }
  }

  const result = {};
  for (const [name, list] of Object.entries(efforts)) {
    result[name] = list
      .sort((a, b) => a.time_s - b.time_s)
      .slice(0, limit)
      .map((e) => ({
        name: e.name,
        distance_m: e.distance_m,
        time_s: e.time_s,
        ...sessionToRecord(e.session),
      }));
  }
  return result;
}

function buildRecordCard(id, icon, label, record, type) {
  if (!record) return null;

  const base = {
    id,
    icon,
    label,
    ...sessionToRecord(record.session ?? record),
  };

  switch (type) {
    case "hr":
      return { ...base, display: `${Math.round(record.value)} ppm`, value: record.value };
    case "temp":
      return { ...base, display: `${record.value}°C`, value: record.value };
    case "duration":
      return { ...base, display: formatDuration(record.value), value: record.value };
    case "hour": {
      const h = Math.floor(record.value);
      const m = Math.round((record.value - h) * 60);
      return { ...base, display: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`, value: record.value };
    }
    case "distance":
      return { ...base, display: `${(record.value / 1000).toFixed(2)} km`, value: record.value };
    case "pace":
      return { ...base, display: `${formatPace(record.value)} /km`, value: record.value };
    case "pace100":
      return { ...base, display: `${formatPace100(record.value)} /100m`, value: record.value };
    case "watts":
      return { ...base, display: `${Math.round(record.value)} W`, value: record.value };
    case "te":
      return { ...base, display: record.value.toFixed(1), value: record.value };
    case "calories":
      return { ...base, display: `${Math.round(record.value)} kcal`, value: record.value };
    case "elevation":
      return { ...base, display: `${Math.round(record.value)} m`, value: record.value };
    case "count":
      return { ...base, display: String(record.value), value: record.value };
    default:
      return { ...base, display: String(record.value), value: record.value };
  }
}

export function buildStatsRecords(completed) {
  const withHr = completed.filter((s) => s.avg_heartrate != null);
  const withMaxHr = completed.filter((s) => s.max_heartrate != null);
  const withTemp = completed.filter((s) => s.average_temp_c != null);
  const withDuration = completed.filter((s) => getSessionTime(s) > 0);

  const highestAvgHr = findRecord(withHr, "avg_heartrate", (a, b) => a > b);
  const highestMaxHr = findRecord(withMaxHr, "max_heartrate", (a, b) => a > b);
  const lowestAvgHr = findRecord(withHr, "avg_heartrate", (a, b) => a < b);
  const lowestMaxHr = findRecord(withMaxHr, "max_heartrate", (a, b) => a < b);

  const hottest = findRecord(withTemp, "average_temp_c", (a, b) => a > b);
  const coldest = findRecord(withTemp, "average_temp_c", (a, b) => a < b);

  const longest = findRecord(withDuration, null, (a, b) => getSessionTime(a) > getSessionTime(b));
  const shortest = findRecord(withDuration, null, (a, b) => getSessionTime(a) < getSessionTime(b));

  const earliest = findRecord(completed, null, (a, b) => {
    const hA = getSessionHour(a);
    const hB = getSessionHour(b);
    if (hA == null || hB == null) return false;
    return hA < hB;
  });
  const earliestVal = earliest ? { value: getSessionHour(earliest.session), session: earliest.session } : null;

  const latest = findRecord(completed, null, (a, b) => {
    const hA = getSessionHour(a);
    const hB = getSessionHour(b);
    if (hA == null || hB == null) return false;
    return hA > hB;
  });
  const latestVal = latest ? { value: getSessionHour(latest.session), session: latest.session } : null;

  const twoDaySessions = completed.filter(spansTwoDays);

  const withCalories = completed.filter((s) => s.calories_kcal != null);
  const mostCalories = findRecord(withCalories, "calories_kcal", (a, b) => a > b);

  const withElevation = completed.filter((s) => s.total_elevation_gain_m != null);
  const mostElevation = findRecord(withElevation, "total_elevation_gain_m", (a, b) => a > b);

  const withDistance = completed.filter((s) => s.distance_m != null);
  const longestDistance = findRecord(withDistance, "distance_m", (a, b) => a > b);

  const withWatts = completed.filter((s) => s.avg_watts != null);
  const highestWatts = findRecord(withWatts, "avg_watts", (a, b) => a > b);

  const withTe = completed.filter((s) => s.training_effect != null);
  const highestTe = findRecord(withTe, "training_effect", (a, b) => a > b);

  const sportCounts = {};
  for (const s of completed) {
    const cat = s.category ?? s.sport;
    sportCounts[cat] = (sportCounts[cat] ?? 0) + 1;
  }
  const mostFrequentSport = Object.entries(sportCounts).sort(([, a], [, b]) => b - a)[0];

  const runningBestEfforts = findTopEffortsBySport(completed, "running");
  const cyclingBestEfforts = findTopEffortsBySport(completed, "cycling");
  const swimmingBestEfforts = findTopEffortsBySport(completed, "swimming");

  const records = [
    buildRecordCard("highest_avg_hr", "❤️‍🔥", "FC media más alta", highestAvgHr, "hr"),
    buildRecordCard("highest_max_hr", "💓", "FC máx más alta", highestMaxHr, "hr"),
    buildRecordCard("lowest_avg_hr", "💚", "FC media más baja", lowestAvgHr, "hr"),
    buildRecordCard("lowest_max_hr", "🫀", "FC máx más baja", lowestMaxHr, "hr"),
    buildRecordCard("hottest", "🌡️", "Más calor", hottest, "temp"),
    buildRecordCard("coldest", "❄️", "Más frío", coldest, "temp"),
    buildRecordCard("longest", "⏰", "Sesión más larga",
      longest ? { value: getSessionTime(longest.session), session: longest.session } : null, "duration"),
    buildRecordCard("shortest", "⚡", "Sesión más corta",
      shortest ? { value: getSessionTime(shortest.session), session: shortest.session } : null, "duration"),
    buildRecordCard("earliest", "🌅", "Más temprano", earliestVal, "hour"),
    buildRecordCard("latest", "🌙", "Más tarde", latestVal, "hour"),
    {
      id: "two_day_sessions",
      icon: "🕛",
      label: "Sesiones en 2 días",
      display: String(twoDaySessions.length),
      value: twoDaySessions.length,
    },
    buildRecordCard("most_calories", "🔥", "Más calorías", mostCalories, "calories"),
    buildRecordCard("most_elevation", "⛰️", "Más desnivel", mostElevation, "elevation"),
    buildRecordCard("longest_distance", "📏", "Distancia más larga", longestDistance, "distance"),
    buildRecordCard("highest_watts", "⚡", "Potencia más alta", highestWatts, "watts"),
    buildRecordCard("highest_te", "📈", "Mayor Training Effect", highestTe, "te"),
    {
      id: "most_frequent_sport",
      icon: "🏆",
      label: "Deporte más frecuente",
      display: mostFrequentSport ? `${mostFrequentSport[0]} (${mostFrequentSport[1]})` : null,
      value: mostFrequentSport?.[1],
    },
  ].filter((r) => r != null && r.display != null);

  return {
    records,
    bestEfforts: {
      running: runningBestEfforts,
      cycling: cyclingBestEfforts,
      swimming: swimmingBestEfforts,
    },
  };
}
