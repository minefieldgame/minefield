import { hashString } from "@/lib/dailySeed";

export type SimulationCandidate = { id: string; category?: string; softTopic?: string };

export type SimulationResult = {
  gameId: string;
  days: number;
  exactRepeats: number;
  replenishments: number;
  initialInventory: number;
  finalInventory: number;
  finalUnused: number;
  selectedIds: string[];
};

function dateAt(startDate: string, offset: number) {
  const date = new Date(`${startDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function simulateDailyInventory({
  gameId,
  candidates,
  days = 365,
  startDate = "2027-01-01",
  replenishBelow = 0,
  replenish = () => [],
  cooldownDays = 30
}: {
  gameId: string;
  candidates: SimulationCandidate[];
  days?: number;
  startDate?: string;
  replenishBelow?: number;
  replenish?: (round: number) => SimulationCandidate[];
  cooldownDays?: number;
}): SimulationResult {
  const pool = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const initialInventory = pool.size;
  const used = new Set<string>();
  const softUsed = new Map<string, number>();
  const selectedIds: string[] = [];
  let exactRepeats = 0;
  let replenishments = 0;

  for (let day = 0; day < days; day += 1) {
    let unused = [...pool.values()].filter((candidate) => !used.has(candidate.id));
    if (unused.length < replenishBelow) {
      const additions = replenish(replenishments);
      for (const candidate of additions) if (!used.has(candidate.id)) pool.set(candidate.id, candidate);
      replenishments += 1;
      unused = [...pool.values()].filter((candidate) => !used.has(candidate.id));
    }
    if (!unused.length) throw new Error(`${gameId} exhausted on ${dateAt(startDate, day)} after every replenishment strategy.`);
    const strict = unused.filter((candidate) => !candidate.softTopic || day - (softUsed.get(candidate.softTopic) ?? -cooldownDays) >= cooldownDays);
    const selectable = strict.length ? strict : unused;
    const ordered = selectable.sort((left, right) => left.id.localeCompare(right.id));
    const selected = ordered[hashString(`${gameId}:${dateAt(startDate, day)}`) % ordered.length];
    if (used.has(selected.id)) exactRepeats += 1;
    used.add(selected.id);
    if (selected.softTopic) softUsed.set(selected.softTopic, day);
    selectedIds.push(selected.id);
  }
  return {
    gameId, days, exactRepeats, replenishments, initialInventory,
    finalInventory: pool.size, finalUnused: pool.size - used.size, selectedIds
  };
}
