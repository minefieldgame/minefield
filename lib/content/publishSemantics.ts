import type { UsedContentRecord } from "@/lib/content/usedContentRegistry";

export class CandidateContentCollisionError extends Error {
  readonly gameId: string;
  readonly dateKey: string;
  readonly conflictingKeys: string[];

  constructor(gameId: string, dateKey: string, conflictingKeys: string[]) {
    super(`Candidate duplicate collision for ${gameId}:${dateKey}; retry with another eligible candidate.`);
    this.name = "CandidateContentCollisionError";
    this.gameId = gameId;
    this.dateKey = dateKey;
    this.conflictingKeys = dedupeItemKeys(conflictingKeys);
  }
}

export class CandidatePoolExhaustedError extends Error {
  constructor(gameId: string, dateKey: string, attempts: number) {
    super(`${gameId} exhausted its eligible candidate strategy for ${dateKey} after ${attempts} collision retries.`);
    this.name = "CandidatePoolExhaustedError";
  }
}

export function dedupeItemKeys(keys: readonly string[]) {
  return [...new Set(keys.map((key) => key.trim()).filter(Boolean))];
}

function shiftDateKey(dateKey: string, offset: number) {
  const value = new Date(`${dateKey}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

export function datedCooldownKey(baseKey: string, dateKey: string) {
  return `${baseKey}:date:${dateKey}`;
}

/** Includes both sides so out-of-order admin generation obeys the same cooldown. */
export function buildCooldownWindowKeys(baseKey: string, dateKey: string, cooldownDays: number) {
  const radius = Math.max(0, Math.floor(cooldownDays) - 1);
  return Array.from({ length: radius * 2 + 1 }, (_, index) =>
    datedCooldownKey(baseKey, shiftDateKey(dateKey, index - radius))
  );
}

export function dedupeKeyedItems<T>(items: readonly T[], getKey: (item: T) => string) {
  const byKey = new Map<string, T>();
  for (const item of items) {
    const key = getKey(item).trim();
    if (key) byKey.set(key, item);
  }
  return [...byKey.values()];
}

export function dedupeUsedContentRecords(records: readonly UsedContentRecord[]) {
  const recordsByKey = new Map<string, UsedContentRecord>();
  for (const record of records) {
    const existing = recordsByKey.get(record.uniqueContentKey);
    if (!existing || record.reservationMode === "permanent") recordsByKey.set(record.uniqueContentKey, record);
  }
  return [...recordsByKey.values()];
}

export function usedContentReservationCondition(record: Pick<UsedContentRecord, "reservationMode">) {
  return record.reservationMode === "permanent" ? "attribute_not_exists(uniqueContentKey)" : undefined;
}

export async function retryCandidateCollisions<T>({
  gameId,
  dateKey,
  operation,
  maxAttempts = 4,
  onCollision
}: {
  gameId: string;
  dateKey: string;
  operation: (attempt: number) => Promise<T>;
  maxAttempts?: number;
  onCollision?: (error: CandidateContentCollisionError, attempt: number) => void | Promise<void>;
}) {
  const attempts = Math.max(1, Math.min(8, Math.floor(maxAttempts)));
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      if (!(error instanceof CandidateContentCollisionError)) throw error;
      await onCollision?.(error, attempt);
      if (attempt === attempts - 1) throw new CandidatePoolExhaustedError(gameId, dateKey, attempts);
    }
  }
  throw new CandidatePoolExhaustedError(gameId, dateKey, attempts);
}
