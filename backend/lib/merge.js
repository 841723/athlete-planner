import { getSportCategory, loadPlannedSessions, loadCompletedSessions, updateSession } from "./sessions.js";

export function mergePlannedWithCompleted() {
  const planned = loadPlannedSessions().filter((s) => !s.merged_with);
  if (!planned.length) return 0;
  const completed = loadCompletedSessions();
  const used = new Set();
  let merged = 0;
  const now = new Date().toISOString();

  for (const p of planned) {
    const date = (p.start_date_local ?? "").slice(0, 10);
    if (!date) continue;
    const pCat = getSportCategory(p.sport);
    const candidates = completed.filter(
      (c) =>
        !used.has(String(c.id)) &&
        getSportCategory(c.sport) === pCat &&
        (c.start_date_local ?? "").slice(0, 10) === date
    );
    if (!candidates.length) continue;
    const sameSport = candidates.filter((c) => c.sport === p.sport);
    const pool = sameSport.length ? sameSport : candidates;
    pool.sort((a, b) => {
      const ta = Math.abs(new Date(a.start_date_local).getTime() - new Date(p.start_date_local).getTime());
      const tb = Math.abs(new Date(b.start_date_local).getTime() - new Date(p.start_date_local).getTime());
      return ta - tb;
    });
    const best = pool[0];
    used.add(String(best.id));
    updateSession(p.id, { merged_with: String(best.id), merged_at: now });
    merged++;
  }

  return merged;
}
