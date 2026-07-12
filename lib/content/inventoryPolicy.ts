export const CONTENT_INVENTORY_POLICY = {
  needledrop: { label: "Rewind", target: 3000, replenishBelow: 1200, batchSize: 200, cooldownDays: 45 },
  "odd-one-out": { label: "Odd One Out", target: 1000, replenishBelow: 300, batchSize: 200, cooldownDays: 21 },
  vaultbreak: { label: "Vaultbreak", target: 5040, replenishBelow: 0, batchSize: 0, cooldownDays: 30 },
  "sing-along": { label: "Sing Along", target: 1000, replenishBelow: 100, batchSize: 100, cooldownDays: 60 },
  "ranked-top-5": { label: "In Order", target: 600, replenishBelow: 200, batchSize: 100, cooldownDays: 45 },
  spelldrop: { label: "Buzzword", target: 4000, replenishBelow: 1500, batchSize: 250, cooldownDays: 90 },
  closer: { label: "In the Ballpark", target: 500, replenishBelow: 200, batchSize: 200, cooldownDays: 45 },
  "landmark-drop": { label: "On a Postcard", target: 500, replenishBelow: 200, batchSize: 100, cooldownDays: 60 },
  "meet-me-halfway": { label: "Meet Me Halfway", target: 5000, replenishBelow: 1000, batchSize: 200, cooldownDays: 30 }
} as const;

export type InventoryGameId = keyof typeof CONTENT_INVENTORY_POLICY;

export type ContentHealthStatus = "Healthy" | "Bounded snapshot (informational)" | "Low eligible inventory" | "Critically low eligible inventory" | "Exhausted" | "Provider unavailable" | "Quality gate failure" | "Infrastructure failure";

export function classifyInventoryHealth(validated: number, unused: number, target: number): ContentHealthStatus {
  if (validated <= 0 || unused <= 0) return "Exhausted";
  if (unused < Math.max(10, target * 0.05)) return "Critically low eligible inventory";
  if (unused < target * 0.4) return "Low eligible inventory";
  return "Healthy";
}
