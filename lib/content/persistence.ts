import "server-only";

import {
  AttributeValue,
  ConditionalCheckFailedException,
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand
} from "@aws-sdk/client-dynamodb";
import type { UsedContentRecord } from "@/lib/content/usedContentRegistry";

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

export async function savePersistedPuzzle<T>(
  gameId: string,
  dateKey: string,
  puzzle: T,
  contentHash = ""
): Promise<T> {
  await ensureTable(DAILY_CONTENT_TABLE, "dateGameKey");
  const now = new Date().toISOString();
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
  })).catch(async (error) => {
    if (error instanceof ConditionalCheckFailedException || error instanceof Error && error.name === "ConditionalCheckFailedException") {
      return;
    }
    throw error;
  });
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
  const uniqueKeys = [...new Set(keys.filter(Boolean))];
  const existing: string[] = [];
  for (const key of uniqueKeys) {
    if (await hasUsedContentKey(key)) existing.push(key);
  }
  return existing;
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
      duplicateChecked: bool(true)
    },
    ConditionExpression: "attribute_not_exists(uniqueContentKey)"
  }));
  return record;
}

export async function saveUsedContentRecords(records: UsedContentRecord[]) {
  for (const record of records) {
    await saveUsedContentRecord(record);
  }
  return records;
}

export async function getUsedContentRecords() {
  throw new Error("DynamoDB used-content scans are intentionally disabled in runtime paths. Use key-based duplicate checks.");
}
