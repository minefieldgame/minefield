export const CONTENT_INVENTORY_POLICY = {
  needledrop: { label: "Rewind", target: 3000, replenishBelow: 1200, batchSize: 200, cooldownDays: 45 },
  "sing-along": { label: "Sing Along", target: 1000, replenishBelow: 400, batchSize: 100, cooldownDays: 60 },
  "ranked-top-5": { label: "In Order", target: 500, replenishBelow: 200, batchSize: 100, cooldownDays: 45 },
  spelldrop: { label: "Buzzword", target: 5000, replenishBelow: 2000, batchSize: 250, cooldownDays: 90 },
  closer: { label: "In the Ballpark", target: 2000, replenishBelow: 800, batchSize: 200, cooldownDays: 45 },
  "landmark-drop": { label: "On a Postcard", target: 500, replenishBelow: 200, batchSize: 100, cooldownDays: 60 },
  "meet-me-halfway": { label: "Meet Me Halfway", target: 5000, replenishBelow: 1000, batchSize: 200, cooldownDays: 30 }
} as const;

export type InventoryGameId = keyof typeof CONTENT_INVENTORY_POLICY;

export type ContentHealthStatus = "Healthy" | "Low inventory" | "Critically low" | "Exhausted" | "Provider unavailable" | "Validation failure" | "Infrastructure failure";

export function classifyInventoryHealth(validated: number, unused: number, target: number): ContentHealthStatus {
  if (validated <= 0 || unused <= 0) return "Exhausted";
  if (unused < Math.max(10, target * 0.05)) return "Critically low";
  if (unused < target * 0.4) return "Low inventory";
  return "Healthy";
}
