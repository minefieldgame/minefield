import "server-only";

import {
  AttributeValue,
  BatchGetItemCommand,
  BatchWriteItemCommand,
  ConditionalCheckFailedException,
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  TransactWriteItemsCommand,
  type WriteRequest
} from "@aws-sdk/client-dynamodb";
import type { UsedContentRecord } from "@/lib/content/usedContentRegistry";
import {
  CandidateContentCollisionError,
  dedupeItemKeys,
  dedupeKeyedItems,
  dedupeUsedContentRecords,
  usedContentReservationCondition
} from "@/lib/content/publishSemantics";

export { CandidateContentCollisionError, CandidatePoolExhaustedError, retryCandidateCollisions, usedContentReservationCondition } from "@/lib/content/publishSemantics";

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
const DAILY_CONTENT_TABLE = process.env.MINEFIELD_DAILY_CONTENT_TABLE || "MinefieldDailyContent";
const USED_CONTENT_TABLE = process.env.MINEFIELD_USED_CONTENT_TABLE || "MinefieldUsedContent";

const client = new DynamoDBClient({ region: REGION });
const ensuredTables = new Map<string, Promise<void>>();

export const puzzlePersistenceStatus = {
  provider: "dynamodb",
  durableAcrossDeployments: true,
  dailyContentTable: DAILY_CONTENT_TABLE,
  usedContentTable: USED_CONTENT_TABLE,
  region: REGION,
  note: "DynamoDB is authoritative. If a DynamoDB read/write fails, daily generation fails safely instead of using repeating fallback content."
};

export type PersistedCandidate<T = unknown> = {
  gameId: string;
  candidateId: string;
  normalizedContentKeys: string[];
  payload: T;
  validationStatus: "validated" | "pending-review" | "invalid";
  validationVersion: string;
  sourceMetadata: Record<string, unknown>;
  createdAt: string;
  lastValidatedAt: string;
  usedAt?: string;
  invalidReason?: string;
  qualityScore: number;
  difficulty: string;
  category: string;
};

export type AtomicPublishDiagnostics = {
  dateGameKey: string;
  dailyContentTable: string;
  usedContentTable: string;
  attemptedUsedContentKeys: number;
  attemptedPermanentKeys: number;
  attemptedCooldownKeys: number;
  dynamoDbWrite: "created" | "existing-daily-returned";
  conditionalConflict: boolean;
};


function s(value: string): AttributeValue {
  return { S: value };
}

function ss(values: string[]): AttributeValue {
  return values.length ? { SS: [...new Set(values)] } : { L: [] };
}

function bool(value: boolean): AttributeValue {
  return { BOOL: value };
}

function json(value: unknown) {
  return JSON.stringify(value);
}

function parseJson<T>(value?: AttributeValue): T | null {
  if (!value || !("S" in value) || !value.S) return null;
  return JSON.parse(value.S) as T;
}

function dateGameKey(gameId: string, dateKey: string) {
  return `${dateKey}#${gameId}`;
}

function inventoryManifestKey(gameId: string) {
  return `inventory#${gameId}#manifest`;
}

function inventoryCandidateKey(gameId: string, candidateId: string) {
  return `inventory#${gameId}#candidate#${candidateId}`;
}

function inventoryUsageKey(gameId: string) {
  return `inventory#${gameId}#usage`;
}

export function getDateGameKey(gameId: string, dateKey: string) {
  return dateGameKey(gameId, dateKey);
}

async function ensureTable(tableName: string, keyName: string) {
  const existing = ensuredTables.get(tableName);
  if (existing) return existing;

  const ensure = (async () => {
    try {
      await client.send(new DescribeTableCommand({ TableName: tableName }));
      return;
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      if (name !== "ResourceNotFoundException") throw error;
    }

    try {
      await client.send(new CreateTableCommand({
        TableName: tableName,
        BillingMode: "PAY_PER_REQUEST",
        AttributeDefinitions: [{ AttributeName: keyName, AttributeType: "S" }],
        KeySchema: [{ AttributeName: keyName, KeyType: "HASH" }]
      }));
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      if (name !== "ResourceInUseException") throw error;
    }

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const description = await client.send(new DescribeTableCommand({ TableName: tableName }));
      if (description.Table?.TableStatus === "ACTIVE") return;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`DynamoDB table ${tableName} was created but did not become ACTIVE in time.`);
  })();

  ensuredTables.set(tableName, ensure);
  return ensure;
}

export async function getPersistedPuzzle<T>(gameId: string, dateKey: string): Promise<T | null> {
  await ensureTable(DAILY_CONTENT_TABLE, "dateGameKey");
  const response = await client.send(new GetItemCommand({
    TableName: DAILY_CONTENT_TABLE,
    Key: { dateGameKey: s(dateGameKey(gameId, dateKey)) },
    ConsistentRead: true
  }));
  return parseJson<T>(response.Item?.puzzle);
}

export async function getPersistedCandidateInventory<T>(gameId: string): Promise<Array<PersistedCandidate<T>>> {
  await ensureTable(DAILY_CONTENT_TABLE, "dateGameKey");
  const manifestResponse = await client.send(new GetItemCommand({
    TableName: DAILY_CONTENT_TABLE,
    Key: { dateGameKey: s(inventoryManifestKey(gameId)) },
    ConsistentRead: true
  }));
  // Older manifests could contain the same candidate id more than once. DynamoDB
  // rejects a BatchGet request containing duplicate primary keys, so normalize the
  // manifest before constructing any request batches.
  const candidateIds = dedupeItemKeys(parseJson<string[]>(manifestResponse.Item?.candidateIds) ?? []);
  const candidates: Array<PersistedCandidate<T>> = [];
  for (let index = 0; index < candidateIds.length; index += 100) {
    let requestKeys: Record<string, AttributeValue>[] = candidateIds.slice(index, index + 100).map((candidateId) => ({
      dateGameKey: s(inventoryCandidateKey(gameId, candidateId))
    }));
    for (let attempt = 0; requestKeys.length && attempt < 5; attempt += 1) {
      const response = await client.send(new BatchGetItemCommand({
        RequestItems: { [DAILY_CONTENT_TABLE]: { Keys: requestKeys, ConsistentRead: true } }
      }));
      for (const item of response.Responses?.[DAILY_CONTENT_TABLE] ?? []) {
        const candidate = parseJson<PersistedCandidate<T>>(item.candidate);
        if (candidate) candidates.push(candidate);
      }
      requestKeys = response.UnprocessedKeys?.[DAILY_CONTENT_TABLE]?.Keys ?? [];
      if (requestKeys.length) await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
    }
    if (requestKeys.length) throw new Error(`Candidate inventory read left ${requestKeys.length} records unprocessed.`);
  }
  return candidates;
}

export async function savePersistedCandidates<T>(gameId: string, records: Array<PersistedCandidate<T>>) {
  if (!records.length) return { written: 0, total: (await getPersistedCandidateInventory<T>(gameId)).length };
  await ensureTable(DAILY_CONTENT_TABLE, "dateGameKey");
  // BatchWriteItem has the same duplicate-key restriction as BatchGetItem. Keep
  // the last copy so a revalidated candidate wins deterministically.
  const uniqueIncomingRecords = dedupeKeyedItems(records, (record) => record.candidateId);
  const existing = await getPersistedCandidateInventory<T>(gameId);
  const merged = new Map(existing.map((record) => [record.candidateId, record]));
  for (const record of uniqueIncomingRecords) merged.set(record.candidateId, record);
  const items = [...merged.values()];
  for (let index = 0; index < uniqueIncomingRecords.length; index += 25) {
    let requests: WriteRequest[] = uniqueIncomingRecords.slice(index, index + 25).map((record) => ({ PutRequest: { Item: {
      dateGameKey: s(inventoryCandidateKey(gameId, record.candidateId)),
      gameId: s(gameId),
      candidateId: s(record.candidateId),
      validationStatus: s(record.validationStatus),
      candidate: s(json(record)),
      updatedAt: s(new Date().toISOString())
    } } }));
    for (let attempt = 0; requests.length && attempt < 5; attempt += 1) {
      const response = await client.send(new BatchWriteItemCommand({ RequestItems: { [DAILY_CONTENT_TABLE]: requests } }));
      requests = response.UnprocessedItems?.[DAILY_CONTENT_TABLE] ?? [];
      if (requests.length) await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
    }
    if (requests.length) throw new Error(`Candidate inventory write left ${requests.length} records unprocessed.`);
  }
  await client.send(new PutItemCommand({
    TableName: DAILY_CONTENT_TABLE,
    Item: {
      dateGameKey: s(inventoryManifestKey(gameId)),
      gameId: s(gameId),
      candidateIds: s(json(items.map((record) => record.candidateId).sort())),
      validatedCount: { N: String(items.filter((record) => record.validationStatus === "validated").length) },
      pendingReviewCount: { N: String(items.filter((record) => record.validationStatus === "pending-review").length) },
      updatedAt: s(new Date().toISOString())
    }
  }));
  return { written: uniqueIncomingRecords.length, total: items.length };
}

export async function getInventoryUsageCounts(gameIds: string[]) {
  const counts = new Map<string, number>();
  if (!gameIds.length) return counts;
  await ensureTable(DAILY_CONTENT_TABLE, "dateGameKey");
  const response = await client.send(new BatchGetItemCommand({
    RequestItems: {
      [DAILY_CONTENT_TABLE]: {
        Keys: [...new Set(gameIds)].map((gameId) => ({ dateGameKey: s(inventoryUsageKey(gameId)) })),
        ConsistentRead: true
      }
    }
  }));
  for (const item of response.Responses?.[DAILY_CONTENT_TABLE] ?? []) {
    const gameId = item.gameId?.S;
    if (gameId) counts.set(gameId, Number(item.usedCount?.N ?? 0));
  }
  return counts;
}

export async function savePersistedPuzzle<T>(
  gameId: string,
  dateKey: string,
  puzzle: T,
  contentHash = ""
): Promise<T> {
  await ensureTable(DAILY_CONTENT_TABLE, "dateGameKey");
  const now = new Date().toISOString();
  try {
    await client.send(new PutItemCommand({
      TableName: DAILY_CONTENT_TABLE,
      Item: {
        dateGameKey: s(dateGameKey(gameId, dateKey)),
        date: s(dateKey),
        gameId: s(gameId),
        puzzle: s(json(puzzle)),
        contentHash: s(contentHash),
        createdAt: s(now),
        updatedAt: s(now)
      },
      ConditionExpression: "attribute_not_exists(dateGameKey)"
    }));
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException || error instanceof Error && error.name === "ConditionalCheckFailedException") {
      const winner = await getPersistedPuzzle<T>(gameId, dateKey);
      if (winner) return winner;
      throw new Error(`Daily puzzle race for ${gameId}:${dateKey} had no readable authoritative winner.`);
    }
    throw error;
  }
  return puzzle;
}

export async function hasUsedContentKey(uniqueContentKey: string) {
  await ensureTable(USED_CONTENT_TABLE, "uniqueContentKey");
  const response = await client.send(new GetItemCommand({
    TableName: USED_CONTENT_TABLE,
    Key: { uniqueContentKey: s(uniqueContentKey) },
    ConsistentRead: true
  }));
  return Boolean(response.Item);
}

export async function checkUsedContentKeys(keys: string[]) {
  const uniqueKeys = dedupeItemKeys(keys);
  if (!uniqueKeys.length) return [];
  await ensureTable(USED_CONTENT_TABLE, "uniqueContentKey");
  const existing: string[] = [];

  for (let index = 0; index < uniqueKeys.length; index += 100) {
    const batch = uniqueKeys.slice(index, index + 100);
    let requestKeys: Record<string, AttributeValue>[] = batch.map((key) => ({ uniqueContentKey: s(key) }));

    for (let attempt = 0; requestKeys.length && attempt < 5; attempt += 1) {
      const response = await client.send(new BatchGetItemCommand({
        RequestItems: {
          [USED_CONTENT_TABLE]: {
            Keys: requestKeys,
            ProjectionExpression: "uniqueContentKey",
            ConsistentRead: true
          }
        }
      }));
      const items = response.Responses?.[USED_CONTENT_TABLE] ?? [];
      existing.push(...items.map((item) => item.uniqueContentKey?.S).filter((key): key is string => Boolean(key)));
      requestKeys = response.UnprocessedKeys?.[USED_CONTENT_TABLE]?.Keys ?? [];
      if (requestKeys.length) await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
    }

    if (requestKeys.length) {
      throw new Error(`DynamoDB duplicate check left ${requestKeys.length} unprocessed used-content keys.`);
    }
  }

  return existing;
}

export async function getUsedContentKeyDates(keys: string[]) {
  const uniqueKeys = dedupeItemKeys(keys);
  const dates = new Map<string, string>();
  if (!uniqueKeys.length) return dates;
  await ensureTable(USED_CONTENT_TABLE, "uniqueContentKey");

  for (let index = 0; index < uniqueKeys.length; index += 100) {
    let requestKeys: Record<string, AttributeValue>[] = uniqueKeys
      .slice(index, index + 100)
      .map((key) => ({ uniqueContentKey: s(key) }));
    for (let attempt = 0; requestKeys.length && attempt < 5; attempt += 1) {
      const response = await client.send(new BatchGetItemCommand({
        RequestItems: {
          [USED_CONTENT_TABLE]: {
            Keys: requestKeys,
            ProjectionExpression: "uniqueContentKey, #usedDate",
            ExpressionAttributeNames: { "#usedDate": "date" },
            ConsistentRead: true
          }
        }
      }));
      for (const item of response.Responses?.[USED_CONTENT_TABLE] ?? []) {
        const key = item.uniqueContentKey?.S;
        if (key) dates.set(key, item.date?.S ?? "1970-01-01");
      }
      requestKeys = response.UnprocessedKeys?.[USED_CONTENT_TABLE]?.Keys ?? [];
      if (requestKeys.length) await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
    }
    if (requestKeys.length) throw new Error(`DynamoDB cooldown check left ${requestKeys.length} keys unprocessed.`);
  }
  return dates;
}

export async function saveUsedContentRecord(record: UsedContentRecord) {
  await ensureTable(USED_CONTENT_TABLE, "uniqueContentKey");
  await client.send(new PutItemCommand({
    TableName: USED_CONTENT_TABLE,
    Item: {
      uniqueContentKey: s(record.uniqueContentKey),
      gameId: s(record.gameId),
      contentType: s(record.contentType),
      date: s(record.date),
      prompt: s(record.sourceMetadata?.prompt ? String(record.sourceMetadata.prompt) : record.normalizedPrompt),
      answer: s(record.sourceMetadata?.answer ? String(record.sourceMetadata.answer) : record.normalizedAnswer),
      normalizedPrompt: s(record.normalizedPrompt),
      normalizedAnswer: s(record.normalizedAnswer),
      secondaryKeys: ss(Array.isArray(record.sourceMetadata?.secondaryKeys) ? record.sourceMetadata.secondaryKeys.map(String) : []),
      source: s(record.sourceMetadata?.source ? String(record.sourceMetadata.source) : "minefield"),
      sourceMetadata: s(json(record.sourceMetadata ?? {})),
      createdAt: s(record.createdAt),
      duplicateChecked: bool(record.reservationMode === "permanent"),
      reservationMode: s(record.reservationMode)
    },
    ...(usedContentReservationCondition(record)
      ? { ConditionExpression: usedContentReservationCondition(record) }
      : {})
  }));
  return record;
}

export async function saveUsedContentRecords(records: UsedContentRecord[]) {
  for (const record of records) {
    await saveUsedContentRecord(record);
  }
  return records;
}

function usedContentRecordItem(record: UsedContentRecord): Record<string, AttributeValue> {
  return {
    uniqueContentKey: s(record.uniqueContentKey),
    gameId: s(record.gameId),
    contentType: s(record.contentType),
    date: s(record.date),
    prompt: s(record.sourceMetadata?.prompt ? String(record.sourceMetadata.prompt) : record.normalizedPrompt),
    answer: s(record.sourceMetadata?.answer ? String(record.sourceMetadata.answer) : record.normalizedAnswer),
    normalizedPrompt: s(record.normalizedPrompt),
    normalizedAnswer: s(record.normalizedAnswer),
    secondaryKeys: ss(Array.isArray(record.sourceMetadata?.secondaryKeys) ? record.sourceMetadata.secondaryKeys.map(String) : []),
    source: s(record.sourceMetadata?.source ? String(record.sourceMetadata.source) : "minefield"),
    sourceMetadata: s(json(record.sourceMetadata ?? {})),
    createdAt: s(record.createdAt),
    duplicateChecked: bool(record.reservationMode === "permanent"),
    reservationMode: s(record.reservationMode)
  };
}

export async function publishDailyPuzzleWithUsedContent<T>({
  gameId,
  dateKey,
  puzzle,
  contentHash = "",
  usedContentRecords,
  conditionalAbsentUsedContentKeys = []
}: {
  gameId: string;
  dateKey: string;
  puzzle: T;
  contentHash?: string;
  usedContentRecords: UsedContentRecord[];
  /** Additional used-content keys that must still be absent when this transaction commits. */
  conditionalAbsentUsedContentKeys?: string[];
}): Promise<{ puzzle: T; created: boolean; diagnostics: AtomicPublishDiagnostics }> {
  await ensureTable(DAILY_CONTENT_TABLE, "dateGameKey");
  await ensureTable(USED_CONTENT_TABLE, "uniqueContentKey");

  const dailyKey = dateGameKey(gameId, dateKey);
  const permanentRecords = usedContentRecords.filter((record) => record.reservationMode === "permanent");
  const cooldownRecords = usedContentRecords.filter((record) => record.reservationMode === "cooldown");
  const uniqueRecords = dedupeUsedContentRecords(usedContentRecords);
  const writtenKeys = new Set(uniqueRecords.map((record) => record.uniqueContentKey));
  const conditionalAbsentKeys = dedupeItemKeys(conditionalAbsentUsedContentKeys)
    .filter((key) => !writtenKeys.has(key));
  const existing = await getPersistedPuzzle<T>(gameId, dateKey);
  if (existing) {
    return {
      puzzle: existing,
      created: false,
      diagnostics: {
        dateGameKey: dailyKey,
        dailyContentTable: DAILY_CONTENT_TABLE,
        usedContentTable: USED_CONTENT_TABLE,
        attemptedUsedContentKeys: uniqueRecords.length + conditionalAbsentKeys.length,
        attemptedPermanentKeys: permanentRecords.length,
        attemptedCooldownKeys: cooldownRecords.length,
        dynamoDbWrite: "existing-daily-returned",
        conditionalConflict: false
      }
    };
  }

  const now = new Date().toISOString();
  if (uniqueRecords.length + conditionalAbsentKeys.length > 98) {
    throw new Error(`Atomic publish for ${gameId} has ${uniqueRecords.length} used-content writes and ${conditionalAbsentKeys.length} conditional reservations; DynamoDB transactions allow at most 98 plus the daily puzzle and inventory counter.`);
  }

  try {
    await client.send(new TransactWriteItemsCommand({
      TransactItems: [
        {
          Put: {
            TableName: DAILY_CONTENT_TABLE,
            Item: {
              dateGameKey: s(dailyKey),
              date: s(dateKey),
              gameId: s(gameId),
              puzzle: s(json(puzzle)),
              contentHash: s(contentHash),
              createdAt: s(now),
              updatedAt: s(now),
              boardSchemaVersion: s("v3")
            },
            ConditionExpression: "attribute_not_exists(dateGameKey)"
          }
        },
        {
          Update: {
            TableName: DAILY_CONTENT_TABLE,
            Key: { dateGameKey: s(inventoryUsageKey(gameId)) },
            UpdateExpression: "SET gameId = :gameId, updatedAt = :updatedAt ADD usedCount :one",
            ExpressionAttributeValues: { ":gameId": s(gameId), ":updatedAt": s(now), ":one": { N: "1" } }
          }
        },
        ...conditionalAbsentKeys.map((uniqueContentKey) => ({
          ConditionCheck: {
            TableName: USED_CONTENT_TABLE,
            Key: { uniqueContentKey: s(uniqueContentKey) },
            ConditionExpression: "attribute_not_exists(uniqueContentKey)"
          }
        })),
        ...uniqueRecords.map((record) => ({
          Put: {
            TableName: USED_CONTENT_TABLE,
            Item: usedContentRecordItem(record),
            ...(usedContentReservationCondition(record)
              ? { ConditionExpression: usedContentReservationCondition(record) }
              : {})
          }
        }))
      ]
    }));
    return {
      puzzle,
      created: true,
      diagnostics: {
        dateGameKey: dailyKey,
        dailyContentTable: DAILY_CONTENT_TABLE,
        usedContentTable: USED_CONTENT_TABLE,
        attemptedUsedContentKeys: uniqueRecords.length + conditionalAbsentKeys.length,
        attemptedPermanentKeys: uniqueRecords.filter((record) => record.reservationMode === "permanent").length,
        attemptedCooldownKeys: uniqueRecords.filter((record) => record.reservationMode === "cooldown").length,
        dynamoDbWrite: "created",
        conditionalConflict: false
      }
    };
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "TransactionCanceledException" || error instanceof ConditionalCheckFailedException) {
      const racedPuzzle = await getPersistedPuzzle<T>(gameId, dateKey);
      if (racedPuzzle) {
        return {
          puzzle: racedPuzzle,
          created: false,
          diagnostics: {
            dateGameKey: dailyKey,
            dailyContentTable: DAILY_CONTENT_TABLE,
            usedContentTable: USED_CONTENT_TABLE,
            attemptedUsedContentKeys: uniqueRecords.length + conditionalAbsentKeys.length,
            attemptedPermanentKeys: uniqueRecords.filter((record) => record.reservationMode === "permanent").length,
            attemptedCooldownKeys: uniqueRecords.filter((record) => record.reservationMode === "cooldown").length,
            dynamoDbWrite: "existing-daily-returned",
            conditionalConflict: true
          }
        };
      }
      const permanentKeys = uniqueRecords
        .filter((record) => record.reservationMode === "permanent")
        .map((record) => record.uniqueContentKey);
      const conflictingKeys = await checkUsedContentKeys([...permanentKeys, ...conditionalAbsentKeys]);
      if (conflictingKeys.length) throw new CandidateContentCollisionError(gameId, dateKey, conflictingKeys);

      // A same-date transaction winner can become visible just after the first strongly consistent read.
      const secondWinnerRead = await getPersistedPuzzle<T>(gameId, dateKey);
      if (secondWinnerRead) {
        return {
          puzzle: secondWinnerRead,
          created: false,
          diagnostics: {
            dateGameKey: dailyKey,
            dailyContentTable: DAILY_CONTENT_TABLE,
            usedContentTable: USED_CONTENT_TABLE,
            attemptedUsedContentKeys: uniqueRecords.length + conditionalAbsentKeys.length,
            attemptedPermanentKeys: permanentKeys.length,
            attemptedCooldownKeys: uniqueRecords.length - permanentKeys.length,
            dynamoDbWrite: "existing-daily-returned",
            conditionalConflict: true
          }
        };
      }
      const cancellationReasons = (error as { CancellationReasons?: Array<{ Code?: string }> }).CancellationReasons ?? [];
      const reasonSummary = cancellationReasons.map((reason) => reason.Code).filter(Boolean).join(", ") || name;
      throw new Error(`DynamoDB atomic publication failed for ${gameId}:${dateKey} (${reasonSummary}); no daily winner or exact-key collision was found.`);
    }
    throw error;
  }
}

export async function getUsedContentRecords() {
  throw new Error("DynamoDB used-content scans are intentionally disabled in runtime paths. Use key-based duplicate checks.");
}
