import { hashString } from "@/lib/dailySeed";

export type SimulationCandidate = { id: string; category?: string; qualityTier?: string; softTopic?: string };

export type SimulationResult = {
  gameId: string;
  days: number;
  exactRepeats: number;
  replenishments: number;
  initialInventory: number;
  finalInventory: number;
  finalUnused: number;
  selectedIds: string[];
  categoryDistribution: Record<string, number>;
  qualityTierDistribution: Record<string, number>;
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
  cooldownDays = 30,
  qualityTierWeights = {},
  preferredQualityTiers = [],
  challengeSelectionRate = 1,
  preferQualityOverCooldown = false
}: {
  gameId: string;
  candidates: SimulationCandidate[];
  days?: number;
  startDate?: string;
  replenishBelow?: number;
  replenish?: (round: number) => SimulationCandidate[];
  cooldownDays?: number;
  qualityTierWeights?: Record<string, number>;
  preferredQualityTiers?: string[];
  challengeSelectionRate?: number;
  preferQualityOverCooldown?: boolean;
}): SimulationResult {
  const pool = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const initialInventory = pool.size;
  const used = new Set<string>();
  const softUsed = new Map<string, number>();
  const selectedIds: string[] = [];
  let exactRepeats = 0;
  let replenishments = 0;
  const categoryDistribution: Record<string, number> = {};
  const qualityTierDistribution: Record<string, number> = {};

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
    let selectable = strict.length ? strict : unused;
    if (preferQualityOverCooldown && preferredQualityTiers.length &&
      !selectable.some((candidate) => preferredQualityTiers.includes(candidate.qualityTier ?? "")) &&
      unused.some((candidate) => preferredQualityTiers.includes(candidate.qualityTier ?? ""))) {
      selectable = unused;
    }
    const preferred = preferredQualityTiers.length
      ? selectable.filter((candidate) => preferredQualityTiers.includes(candidate.qualityTier ?? ""))
      : [];
    const challengeRoll = hashString(`${gameId}:${dateAt(startDate, day)}:quality-gate`) / 0x1_0000_0000;
    const qualitySelectable = preferred.length && challengeRoll >= challengeSelectionRate ? preferred : selectable;
    const ordered = qualitySelectable.sort((left, right) => left.id.localeCompare(right.id));
    const totalWeight = ordered.reduce((sum, candidate) => sum + Math.max(0, qualityTierWeights[candidate.qualityTier ?? ""] ?? 1), 0);
    let cursor = (hashString(`${gameId}:${dateAt(startDate, day)}`) / 0x1_0000_0000) * totalWeight;
    let selected = ordered[ordered.length - 1];
    for (const candidate of ordered) {
      cursor -= Math.max(0, qualityTierWeights[candidate.qualityTier ?? ""] ?? 1);
      if (cursor <= 0) {
        selected = candidate;
        break;
      }
    }
    if (used.has(selected.id)) exactRepeats += 1;
    used.add(selected.id);
    if (selected.softTopic) softUsed.set(selected.softTopic, day);
    selectedIds.push(selected.id);
    if (selected.category) categoryDistribution[selected.category] = (categoryDistribution[selected.category] ?? 0) + 1;
    if (selected.qualityTier) qualityTierDistribution[selected.qualityTier] = (qualityTierDistribution[selected.qualityTier] ?? 0) + 1;
  }
  return {
    gameId, days, exactRepeats, replenishments, initialInventory,
    finalInventory: pool.size, finalUnused: pool.size - used.size, selectedIds,
    categoryDistribution, qualityTierDistribution
  };
}
