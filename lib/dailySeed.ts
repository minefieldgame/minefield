export function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export const DAILY_SEED_VERSION = "v1";

export const GAME_VERSIONS = {
  needledrop: "v1",
  "odd-one-out": "v1",
  vaultbreak: "v1",
  "sing-along": "v2",
  "ranked-top-5": "v2",
  spelldrop: "v1",
  closer: "v1",
  "meet-me-halfway": "v1",
  "landmark-drop": "v1",
  minefield: "v2"
} as const;

export type SeededGameId = keyof typeof GAME_VERSIONS;

function hashHex(value: string) {
  const parts = [0, 1, 2, 3].map((index) =>
    hashString(`${value}:${index.toString(16)}`).toString(16).padStart(8, "0")
  );
  return parts.join("");
}

export function getDailyMasterSeed(dateKey: string, version = DAILY_SEED_VERSION) {
  const compactDate = dateKey.replace(/-/g, "");
  return `mf_${compactDate}_${hashHex(`minefield:${dateKey}:${version}`)}`;
}

export function getGameSeed(masterSeed: string, gameId: SeededGameId) {
  return hashString(`${masterSeed}:${gameId}:${GAME_VERSIONS[gameId]}`);
}

export function getGameSeedForDate(dateKey: string, gameId: SeededGameId) {
  return getGameSeed(getDailyMasterSeed(dateKey), gameId);
}

export function createSeededRandom(seed: number | string) {
  const random = seededRandom(typeof seed === "number" ? seed : hashString(seed));
  return {
    random,
    int(min: number, max: number) {
      const low = Math.ceil(min);
      const high = Math.floor(max);
      return Math.floor(random() * (high - low + 1)) + low;
    },
    choice<T>(items: readonly T[]): T {
      if (!items.length) throw new Error("Cannot choose from an empty array.");
      return items[Math.floor(random() * items.length)];
    },
    shuffle<T>(items: readonly T[]): T[] {
      const result = [...items];
      for (let i = result.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
      }
      return result;
    },
    weightedChoice<T>(options: Array<{ value: T; weight: number }>): T {
      const total = options.reduce((sum, option) => sum + Math.max(0, option.weight), 0);
      if (total <= 0) throw new Error("Weighted choice requires a positive total weight.");
      let cursor = random() * total;
      for (const option of options) {
        cursor -= Math.max(0, option.weight);
        if (cursor <= 0) return option.value;
      }
      return options[options.length - 1].value;
    }
  };
}

export function seededRandom(seed: number) {
  let state = seed || 1;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(items: T[], seed: number): T[] {
  const result = [...items];
  const random = seededRandom(seed);
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function buildDailyBoardSeedManifest(
  dateKey: string,
  gameIds: readonly SeededGameId[],
  puzzleHashes: Partial<Record<SeededGameId, string>> = {},
  sources: Partial<Record<SeededGameId, string>> = {},
  duplicateChecks: Partial<Record<SeededGameId, { passed: boolean; duplicateDetected: boolean; retryCount?: number; warning?: string }>> = {},
  statuses: Partial<Record<SeededGameId, "Ready" | "Cached" | "Generated" | "Failed" | "Low inventory warning">> = {}
) {
  const masterSeed = getDailyMasterSeed(dateKey);
  const games = gameIds.map((gameId) => {
    const gameSeed = getGameSeed(masterSeed, gameId);
    const gameVersion = GAME_VERSIONS[gameId];
    const status = statuses[gameId] ?? (puzzleHashes[gameId] ? "Ready" : "Failed");
    const puzzleHash = status === "Failed" ? "" : puzzleHashes[gameId] ?? "";
    return {
      gameId,
      gameVersion,
      gameSeed,
      cacheKey: `${gameId}:${dateKey}:${gameVersion}`,
      puzzleHash,
      generatedAt: `${dateKey}T12:00:00.000Z`,
      source: sources[gameId] ?? "deterministic",
      status,
      duplicateCheck: duplicateChecks[gameId] ?? { passed: status !== "Failed", duplicateDetected: false, retryCount: 0, warning: status === "Failed" ? "Route failed to produce a playable puzzle." : undefined }
    };
  });
  const boardHash = hashHex(JSON.stringify({ dateKey, masterSeed, games: games.map(({ gameId, gameSeed, puzzleHash }) => ({ gameId, gameSeed, puzzleHash })) }));
  return {
    dateKey,
    pacificDate: dateKey,
    masterSeed,
    boardHash,
    games
  };
}
