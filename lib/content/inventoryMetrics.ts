export type InventoryMetrics = {
  discoveredUnique: number;
  providerResponsesExamined: number;
  technicallyValidUnique: number;
  qualityApproved: number;
  playableEligible: number;
  previouslyUsed: number;
  unusedEligible: number;
  cooldown: number;
  pendingExternalProviderData: number;
  invalid: number;
  rejectedQuality: number;
  duplicateAliasesCollapsed: number;
};

export const INVENTORY_METRIC_LABELS: Record<keyof InventoryMetrics, { label: string; description: string }> = {
  discoveredUnique: { label: "Discovered unique", description: "Unique candidate identities found before technical and quality gates." },
  providerResponsesExamined: { label: "Provider responses", description: "Raw provider rows examined; aliases and duplicate responses can exceed unique candidates." },
  technicallyValidUnique: { label: "Technically valid", description: "Unique candidates passing deterministic schema, factual, timing, or media checks." },
  qualityApproved: { label: "Quality approved", description: "Technically valid candidates passing recognizability, clarity, fairness, and entertainment gates." },
  playableEligible: { label: "Playable eligible", description: "Quality-approved candidates with every required playable asset available." },
  previouslyUsed: { label: "Used", description: "Permanently reserved exact candidate identities already published for this game." },
  unusedEligible: { label: "Unused eligible", description: "Playable candidates still available after permanent duplicate exclusion; this drives health." },
  cooldown: { label: "Cooldown", description: "Otherwise eligible candidates temporarily deprioritized by a dated semantic cooldown." },
  pendingExternalProviderData: { label: "Pending provider data", description: "Discovered candidates missing required licensed provider timing, factual, or media data." },
  invalid: { label: "Invalid", description: "Candidates failing deterministic technical or factual checks." },
  rejectedQuality: { label: "Rejected for quality", description: "Technically valid candidates excluded by the player-content quality gate." },
  duplicateAliasesCollapsed: { label: "Aliases collapsed", description: "Duplicate provider names, recordings, files, or coordinates merged into canonical identities." }
};

function count(value: number) {
  return Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
}

export function normalizeInventoryMetrics(metrics: InventoryMetrics): InventoryMetrics {
  return Object.fromEntries(Object.entries(metrics).map(([key, value]) => [key, count(value)])) as InventoryMetrics;
}

export function inventoryMetricErrors(input: InventoryMetrics) {
  const metrics = normalizeInventoryMetrics(input);
  const errors: string[] = [];
  if (metrics.technicallyValidUnique > metrics.discoveredUnique) errors.push("technically valid unique exceeds discovered unique");
  if (metrics.qualityApproved > metrics.technicallyValidUnique) errors.push("quality approved exceeds technically valid unique");
  if (metrics.playableEligible > metrics.qualityApproved) errors.push("playable eligible exceeds quality approved");
  if (metrics.unusedEligible > metrics.playableEligible) errors.push("unused eligible exceeds playable eligible");
  if (metrics.providerResponsesExamined + metrics.duplicateAliasesCollapsed < metrics.discoveredUnique) errors.push("provider response accounting cannot explain discovered unique candidates");
  return errors;
}

export function assertInventoryMetrics(metrics: InventoryMetrics, label = "inventory") {
  const errors = inventoryMetricErrors(metrics);
  if (errors.length) throw new Error(`${label} metrics are inconsistent: ${errors.join("; ")}.`);
  return metrics;
}

export function buildInventoryMetrics(input: Partial<InventoryMetrics> & Pick<InventoryMetrics, "discoveredUnique" | "technicallyValidUnique" | "qualityApproved" | "playableEligible" | "unusedEligible">) {
  return assertInventoryMetrics(normalizeInventoryMetrics({
    discoveredUnique: input.discoveredUnique,
    providerResponsesExamined: input.providerResponsesExamined ?? input.discoveredUnique,
    technicallyValidUnique: input.technicallyValidUnique,
    qualityApproved: input.qualityApproved,
    playableEligible: input.playableEligible,
    previouslyUsed: input.previouslyUsed ?? Math.max(0, input.playableEligible - input.unusedEligible),
    unusedEligible: input.unusedEligible,
    cooldown: input.cooldown ?? 0,
    pendingExternalProviderData: input.pendingExternalProviderData ?? 0,
    invalid: input.invalid ?? Math.max(0, input.discoveredUnique - input.technicallyValidUnique),
    rejectedQuality: input.rejectedQuality ?? Math.max(0, input.technicallyValidUnique - input.qualityApproved),
    duplicateAliasesCollapsed: input.duplicateAliasesCollapsed ?? 0
  }));
}
