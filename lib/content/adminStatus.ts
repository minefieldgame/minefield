export type AdminSelectedDateStatus =
  | "Ready"
  | "Cached"
  | "Generated"
  | "Failed"
  | "Provider unavailable"
  | "Infrastructure failure";

export function classifyAdminFailure(error: string): Exclude<AdminSelectedDateStatus, "Ready" | "Cached" | "Generated"> {
  if (/DynamoDB|transaction|credential|table|persistence|ECONN|network|timeout|fetch failed/i.test(error)) {
    return "Infrastructure failure";
  }
  if (/provider|preview|chart|iTunes|Billboard|OpenAI|Wikimedia|Wikidata/i.test(error)) {
    return "Provider unavailable";
  }
  return "Failed";
}

export function classifySelectedDateStatus({
  ready,
  cacheHit = false,
  error = ""
}: {
  ready: boolean;
  cacheHit?: boolean;
  error?: string;
}): AdminSelectedDateStatus {
  if (!ready) return classifyAdminFailure(error);
  return cacheHit ? "Cached" : "Generated";
}

export function buildAdminStatusSummary({
  inventoryHealthStatus,
  ready,
  cacheHit = false,
  error = ""
}: {
  inventoryHealthStatus: string;
  ready: boolean;
  cacheHit?: boolean;
  error?: string;
}) {
  const selectedDateStatus = classifySelectedDateStatus({ ready, cacheHit, error });
  return {
    // Keep the legacy healthStatus field coherent with the explicitly named
    // inventory status. A selected-date failure must never rewrite inventory.
    healthStatus: inventoryHealthStatus,
    inventoryHealthStatus,
    selectedDateStatus,
    finalStatus: selectedDateStatus,
    actionableFailureReason: ready ? "" : error
  };
}
