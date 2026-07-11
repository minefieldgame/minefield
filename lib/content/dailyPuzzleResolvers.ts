import "server-only";

import { validateTopTenPuzzle } from "@/games/top-ten/providers";
import { validateSpellDropPuzzle } from "@/games/spelldrop/providers";
import { inferCloserScoringProfile, validateCloserPuzzle } from "@/games/closer/providers";
import { resolveNeedleDropDiagnostic } from "@/lib/needledropResolver";
import type { RankedTopTenPuzzle } from "@/games/top-ten/types";
import type { SpellDropPuzzle } from "@/games/spelldrop/types";
import type { CloserPuzzle } from "@/games/closer/types";
import type { GeneratedContentEnvelope } from "@/lib/content/dailyContentEngine";
import { createSeededRandom, getDailyMasterSeed, getGameSeedForDate, hashString } from "@/lib/dailySeed";
import { generateContentHash } from "@/lib/content/repeatPrevention";
import { deterministicEnvelope } from "@/lib/content/deterministicEnvelope";
import { BALLPARK_CATALOG, BUZZWORD_CATALOG, IN_ORDER_CATALOG } from "@/data/dailyPuzzleCatalogs";
import { SING_ALONG_CATALOG } from "@/data/singAlongCatalog";
import { searchTrackPreview } from "@/lib/audioProvider";
import type { SingAlongPuzzle } from "@/games/sing-along/types";
import { selectFromContentUniverse, seededUniverseSelector } from "@/lib/content/contentUniverse";
import {
  contentHashFromKey,
  createMusicUsedContentKey,
  createUsedContentRecord,
  createUniqueContentKey,
  selectNonRepeatingDailyCandidate
} from "@/lib/content/usedContentRegistry";
import {
  checkUsedContentKeys,
  getPersistedPuzzle,
  publishDailyPuzzleWithUsedContent
} from "@/lib/content/persistence";

type DuplicateMeta = {
  uniqueContentKey: string;
  secondaryKeys: string[];
  prompt: string;
  answer: string;
  contentType: string;
  source: string;
};

function duplicateCheck({
  uniqueContentKey,
  existingKeys,
  retryCount
}: {
  uniqueContentKey: string;
  existingKeys: string[];
  retryCount: number;
}) {
  return {
    uniqueContentKey,
    duplicateDetected: existingKeys.length > 0,
    passed: existingKeys.length === 0,
    regenerationCount: retryCount,
    retryCount,
    exhaustedCandidatePool: false,
    checkedAgainstCount: existingKeys.length,
    recentlyUsedKeys: existingKeys,
    dynamoDbWriteSucceeded: existingKeys.length === 0,
    warning: existingKeys.length ? `Rejected duplicate keys: ${existingKeys.join(", ")}` : undefined
  };
}

async function persistAcceptedPuzzle<TPuzzle>({
  gameId,
  date,
  puzzle,
  meta,
  contentHash
}: {
  gameId: string;
  date: string;
  puzzle: TPuzzle;
  meta: DuplicateMeta;
  contentHash: string;
}) {
  const keys = [meta.uniqueContentKey, ...meta.secondaryKeys];
  const records = keys.map((key) => createUsedContentRecord({
    gameId,
    date,
    contentType: meta.contentType,
    prompt: meta.prompt,
    answer: meta.answer,
    uniqueContentKey: key,
    sourceMetadata: {
      prompt: meta.prompt,
      answer: meta.answer,
      primaryContentKey: meta.uniqueContentKey,
      secondaryKeys: meta.secondaryKeys,
      source: meta.source
    }
  }));
  const published = await publishDailyPuzzleWithUsedContent({
    gameId,
    dateKey: date,
    puzzle,
    contentHash,
    usedContentRecords: records
  });
  return published.created
    ? puzzle
    : ({ ...(published.puzzle as Record<string, unknown>), cacheHit: true } as TPuzzle);
}

export async function resolveRankedTop5ForDate(
  date: string,
  options: { force?: boolean; retryOffset?: number } = {}
): Promise<RankedTopTenPuzzle> {
  if (!options.force) {
    const persisted = await getPersistedPuzzle<RankedTopTenPuzzle>("ranked-top-5", date);
    if (persisted) return { ...persisted, cacheHit: true };
  }
  const masterSeed = getDailyMasterSeed(date);
  const seed = getGameSeedForDate(date, "ranked-top-5");
  const candidateKey = (entry: typeof IN_ORDER_CATALOG[number]) => createUniqueContentKey("ranked-top-5", "ranking", [
    entry.category,
    entry.metric,
    entry.items.map(([answer]) => answer).join("|")
  ]);
  const candidateSecondaryKeys = (entry: typeof IN_ORDER_CATALOG[number]) => [
    createUniqueContentKey("ranked-top-5", "category", [entry.category, entry.metric]),
    createUniqueContentKey("ranked-top-5", "answer-set", [entry.items.map(([answer]) => answer).sort().join("|")])
  ];
  const selected = await selectFromContentUniverse({
    gameSeed: `${seed}:${options.retryOffset ?? 0}`,
    contentSource: "versioned-in-order-reference-universe",
    softCooldownLabel: "recent In Order category cooldown",
    universe: {
      getAllCandidates: () => IN_ORDER_CATALOG,
      getCandidateId: candidateKey,
      getHardKeys: (entry) => [candidateKey(entry), ...candidateSecondaryKeys(entry)],
      validateCandidate: (entry) => ({ valid: entry.items.length === 5 && Boolean(entry.playerPrompt), reason: "Exactly five ranked items required" }),
      selectCandidate: seededUniverseSelector(candidateKey)
    }
  });
  const entry = selected.selected;
  if (!entry) throw new Error(`In Order could not generate non-repeating content: ${selected.diagnostics.warnings.join(" ")}`);
  const uniqueContentKey = createUniqueContentKey("ranked-top-5", "ranking", [
    entry.category,
    entry.metric,
    entry.items.map(([answer]) => answer).join("|")
  ]);
  const secondaryKeys = candidateSecondaryKeys(entry);
  const existingKeys: string[] = [];
  const answers = entry.items.map(([answer, value], index) => ({
    rank: index + 1,
    answer,
    displayAnswer: answer,
    aliases: [],
    value,
    sourceNote: entry.source
  }));
  const base = {
    gameId: "ranked-top-5" as const,
    id: `ranked-top-5:${date}`,
    date,
    title: entry.title,
    playerPrompt: entry.playerPrompt,
    adminPrompt: `${entry.playerPrompt} Metric: ${entry.metric}. Source: ${entry.source}`,
    category: entry.category,
    rankingMetric: entry.metric,
    direction: "highest-to-lowest" as const,
    answers,
    sources: [entry.source],
    confidence: 1,
    contentHash: uniqueContentKey,
    generatedAt: `${date}T12:00:00.000Z`,
    generator: "Versioned deterministic daily catalog",
    cacheHit: true,
    masterSeed,
    gameSeed: seed,
    deterministicSelectors: {
      topicArea: entry.category,
      rankingType: entry.metric,
      difficulty: "general-audience",
      itemCount: 5,
      retryOffset: options.retryOffset ?? 0
    },
    promptConstraints: `Generate/select one general-audience ${entry.category} ranking by ${entry.metric} with exactly 5 widely known items.`,
    uniqueContentKey,
    secondaryKeys,
    duplicateCheck: duplicateCheck({ uniqueContentKey, existingKeys, retryCount: 0 }),
    repeatStatus: {
      checked: true,
      passed: true,
      duplicateDetected: false,
      retryCount: options.retryOffset ?? 0,
      provider: "dynamodb-used-content-registry"
    },
    generationDurationMs: 0,
    contentUniverse: selected.diagnostics,
    validation: { valid: false, checks: {} as RankedTopTenPuzzle["validation"]["checks"], errors: [] },
    rawAIResponse: null
  };
  const validation = validateTopTenPuzzle(base);
  const puzzle = { ...base, validation, contentHash: contentHashFromKey(uniqueContentKey) };
  return persistAcceptedPuzzle({
    gameId: "ranked-top-5",
    date,
    puzzle,
    contentHash: puzzle.contentHash,
    meta: {
      uniqueContentKey,
      secondaryKeys,
      prompt: entry.playerPrompt,
      answer: entry.items.map(([answer]) => answer).join("|"),
      contentType: "ranking",
      source: "deterministic-catalog"
    }
  });
}

export async function resolveSpellDropForDate(
  date: string,
  force = false
): Promise<GeneratedContentEnvelope<SpellDropPuzzle>> {
  if (!force) {
    const persisted = await getPersistedPuzzle<GeneratedContentEnvelope<SpellDropPuzzle>>("spelldrop", date);
    if (persisted) return { ...persisted, cacheHit: true };
  }
  const masterSeed = getDailyMasterSeed(date);
  const seed = getGameSeedForDate(date, "spelldrop");
  const candidates = createSeededRandom(seed).shuffle(BUZZWORD_CATALOG).slice(0, 20);
  const duplicateFailures: string[] = [];
  for (let attempt = 0; attempt < candidates.length; attempt += 1) {
  const entry = candidates[attempt];
  const uniqueContentKey = createUniqueContentKey("spelldrop", "word", [entry.word]);
  const secondaryKeys = [createUniqueContentKey("spelldrop", "answer", [entry.word])];
  const existingKeys = await checkUsedContentKeys([uniqueContentKey, ...secondaryKeys]);
  if (existingKeys.length) {
    duplicateFailures.push(`${uniqueContentKey} -> ${existingKeys.join(",")}`);
    continue;
  }
  const puzzle: SpellDropPuzzle = {
    gameId: "spelldrop", date, seed, ...entry,
    masterSeed,
    gameSeed: seed,
    deterministicSelectors: {
      difficulty: entry.difficulty,
      wordPattern: "commonly misspelled everyday word",
      lengthBucket: entry.word.length <= 7 ? "short" : entry.word.length <= 12 ? "8-12 letters" : "long"
    },
    promptConstraints: `Select one ${entry.difficulty} commonly misspelled everyday word.`,
    uniqueContentKey,
    secondaryKeys,
    duplicateCheck: duplicateCheck({ uniqueContentKey, existingKeys, retryCount: attempt }),
    repeatStatus: {
      checked: true,
      passed: true,
      duplicateDetected: false,
      retryCount: attempt,
      provider: "dynamodb-used-content-registry"
    }
  } as SpellDropPuzzle;
  const envelope = deterministicEnvelope({
    gameId: "spelldrop", date, puzzle, validation: validateSpellDropPuzzle(puzzle),
    topic: "commonly misspelled English words", answer: puzzle.word,
    sourceNotes: ["Versioned Minefield lexical catalog"]
  });
  const accepted = await persistAcceptedPuzzle({
    gameId: "spelldrop",
    date,
    puzzle: envelope,
    contentHash: envelope.contentHash,
    meta: {
      uniqueContentKey,
      secondaryKeys,
      prompt: puzzle.definition,
      answer: puzzle.word,
      contentType: "spelling-word",
      source: "deterministic-catalog"
    }
  });
  return accepted;
  }
  throw new Error(`Buzzword could not generate non-repeating content after ${candidates.length} attempts: ${duplicateFailures.join(" | ")}`);
}

export async function resolveCloserForDate(
  date: string,
  force = false
): Promise<GeneratedContentEnvelope<CloserPuzzle>> {
  if (!force) {
    const persisted = await getPersistedPuzzle<GeneratedContentEnvelope<CloserPuzzle>>("closer", date);
    if (persisted) return { ...persisted, cacheHit: true };
  }
  const masterSeed = getDailyMasterSeed(date);
  const seed = getGameSeedForDate(date, "closer");
  const candidates = createSeededRandom(seed).shuffle(BALLPARK_CATALOG).slice(0, 20);
  const duplicateFailures: string[] = [];
  for (let attempt = 0; attempt < candidates.length; attempt += 1) {
  const entry = candidates[attempt];
  const uniqueContentKey = createUniqueContentKey("closer", "question-answer", [entry.prompt, entry.answer, entry.unit]);
  const secondaryKeys = [
    createUniqueContentKey("closer", "answer", [entry.answer, entry.unit]),
    createUniqueContentKey("closer", "fact", [entry.category, entry.answer, entry.unit])
  ];
  const existingKeys = await checkUsedContentKeys([uniqueContentKey, ...secondaryKeys]);
  if (existingKeys.length) {
    duplicateFailures.push(`${uniqueContentKey} -> ${existingKeys.join(",")}`);
    continue;
  }
  const scoringProfile = inferCloserScoringProfile(entry);
  const puzzle: CloserPuzzle = {
    gameId: "closer", date, seed, ...entry, scoringProfile,
    toleranceType: scoringProfile === "small-integer" || scoringProfile === "year" || scoringProfile === "percentage" ? "absolute" : "percent"
  } as CloserPuzzle;
  Object.assign(puzzle, {
    masterSeed,
    gameSeed: seed,
    deterministicSelectors: {
      category: entry.category,
      questionType: entry.unit,
      scoringProfile,
      difficulty: entry.difficulty
    },
    promptConstraints: `Generate/select one ${entry.difficulty} ${entry.category} numeric question using ${scoringProfile} scoring.`
    ,
    uniqueContentKey,
    secondaryKeys,
    duplicateCheck: duplicateCheck({ uniqueContentKey, existingKeys, retryCount: attempt }),
    repeatStatus: {
      checked: true,
      passed: true,
      duplicateDetected: false,
      retryCount: attempt,
      provider: "dynamodb-used-content-registry"
    }
  });
  const envelope = deterministicEnvelope({
    gameId: "closer", date, puzzle, validation: validateCloserPuzzle(puzzle),
    topic: puzzle.category, answer: String(puzzle.answer), sourceNotes: [puzzle.sourceNote]
  });
  return persistAcceptedPuzzle({
    gameId: "closer",
    date,
    puzzle: envelope,
    contentHash: envelope.contentHash,
    meta: {
      uniqueContentKey,
      secondaryKeys,
      prompt: puzzle.prompt,
      answer: `${puzzle.answer} ${puzzle.unit}`,
      contentType: "numeric-trivia",
      source: "deterministic-catalog"
    }
  });
  }
  throw new Error(`In the Ballpark could not generate non-repeating content after ${candidates.length} attempts: ${duplicateFailures.join(" | ")}`);
}

export async function resolveNeedleDropForDate(date: string) {
  const persisted = await getPersistedPuzzle<Awaited<ReturnType<typeof resolveNeedleDropDiagnostic>>>("needledrop", date);
  if (persisted) return persisted;
  const result = await resolveNeedleDropDiagnostic(date);
  const puzzle = result.puzzle;
  if (!puzzle.uniqueContentKey) throw new Error("Rewind did not produce a content key.");
  return persistAcceptedPuzzle({
    gameId: "needledrop",
    date,
    puzzle: result,
    contentHash: contentHashFromKey(puzzle.uniqueContentKey),
    meta: {
      uniqueContentKey: puzzle.uniqueContentKey,
      secondaryKeys: puzzle.secondaryKeys ?? (puzzle.musicUsedContentKey ? [puzzle.musicUsedContentKey] : []),
      prompt: `${puzzle.title} — ${puzzle.artist}`,
      answer: `${puzzle.title} — ${puzzle.artist}`,
      contentType: "song",
      source: "Billboard archive + iTunes Search API"
    }
  });
}

export async function resolveSingAlongForDate(date: string): Promise<SingAlongPuzzle> {
  const persisted = await getPersistedPuzzle<SingAlongPuzzle>("sing-along", date);
  if (persisted) return persisted;
  const masterSeed = getDailyMasterSeed(date);
  const seed = getGameSeedForDate(date, "sing-along");
  const entries = createSeededRandom(seed).shuffle(SING_ALONG_CATALOG).slice(0, 20);
  const duplicateFailures: string[] = [];

  for (let attempt = 0; attempt < entries.length; attempt += 1) {
    const entry = entries[attempt];
    const uniqueContentKey = createUniqueContentKey("sing-along", "song-lyric", [
      entry.artist,
      entry.title,
      entry.answerLyricExcerpt
    ]);
    const musicUsedContentKey = createMusicUsedContentKey(entry.artist, entry.title);
    const secondaryKeys = [
      createUniqueContentKey("singalong-song", "song", [entry.artist, entry.title]),
      createUniqueContentKey("singalong-lyric", "lyric", [entry.artist, entry.title, entry.answerLyricExcerpt]),
      musicUsedContentKey
    ];
    const existingKeys = await checkUsedContentKeys([uniqueContentKey, ...secondaryKeys]);
    if (existingKeys.length) {
      duplicateFailures.push(`${uniqueContentKey} -> ${existingKeys.join(",")}`);
      continue;
    }
    const track = await searchTrackPreview(entry.title, entry.artist).catch(() => null);
    if (!track?.previewUrl) continue;
    const allAccepted = [entry.acceptedLyric, ...entry.alternateAcceptedLyrics];
    const puzzle: SingAlongPuzzle = {
      gameId: "sing-along",
      gameVersion: "v2",
      id: `sing-along:${date}`,
      date,
      dateKey: date,
      masterSeed,
      gameSeed: seed,
      seed,
      title: entry.title,
      songTitle: entry.title,
      artist: entry.artist,
      previewUrl: track.previewUrl,
      chartDate: entry.chartDate,
      chartYear: entry.chartYear,
      chartPosition: entry.chartPosition,
      track,
      playbackStart: entry.clipStartTimeSeconds,
      playbackStop: entry.clipEndTimeSeconds,
      stopTimestamp: entry.clipEndTimeSeconds,
      chorusTimestamp: entry.chorusTimestamp,
      cueDescription: entry.cueDescription,
      setupLyricExcerpt: entry.setupLyricExcerpt,
      answerLyricExcerpt: entry.answerLyricExcerpt,
      acceptedLyric: entry.answerLyricExcerpt,
      lyricExcerpt: entry.answerLyricExcerpt,
      lyricStartTimeSeconds: entry.answerLyricStartTimeSeconds,
      answerLyricStartTimeSeconds: entry.answerLyricStartTimeSeconds,
      clipStartTimeSeconds: entry.clipStartTimeSeconds,
      clipEndTimeSeconds: entry.clipEndTimeSeconds,
      alternateAcceptedLyrics: [...new Set(allAccepted)],
      correctChoiceId: entry.correctChoiceId,
      choices: entry.choices,
      sourceNote: entry.sourceNote,
      generatedAt: `${date}T12:00:00.000Z`,
      deterministicSelectors: {
        source: "manual Billboard lyric-cue catalog",
        chartEra: String(entry.chartYear),
        cueType: "recognizable hook"
      },
      promptConstraints: "Pick a stable Billboard song cue with exactly four short lyric choices and one correct answer.",
      validation: {
        valid:
          entry.choices.length === 4 &&
          entry.choices.filter((choice) => choice.isCorrect).length === 1 &&
          entry.clipEndTimeSeconds < entry.answerLyricStartTimeSeconds &&
          entry.answerLyricStartTimeSeconds - entry.clipEndTimeSeconds >= 0.25 &&
          entry.answerLyricStartTimeSeconds - entry.clipEndTimeSeconds <= 1 &&
          entry.clipEndTimeSeconds - entry.clipStartTimeSeconds >= 8 &&
          entry.clipEndTimeSeconds - entry.clipStartTimeSeconds <= 15 &&
          entry.clipStartTimeSeconds > 0,
        errors: []
      },
      uniqueContentKey,
      secondaryKeys,
      musicUsedContentKey,
      duplicateCheck: duplicateCheck({ uniqueContentKey, existingKeys, retryCount: attempt }),
      repeatStatus: {
        checked: true,
        passed: true,
        duplicateDetected: false,
        retryCount: attempt,
        provider: "dynamodb-used-content-registry"
      },
      contentHash: contentHashFromKey(uniqueContentKey)
    };
    if (!puzzle.validation.valid) continue;
    return persistAcceptedPuzzle({
      gameId: "sing-along",
      date,
      puzzle,
      contentHash: puzzle.contentHash,
      meta: {
        uniqueContentKey,
        secondaryKeys,
        prompt: entry.setupLyricExcerpt,
        answer: entry.answerLyricExcerpt,
        contentType: "song-lyric",
        source: "verified-timing-catalog"
      }
    });
  }

  throw new Error(`No playable non-repeating Sing Along preview was available after ${entries.length} attempts: ${duplicateFailures.join(" | ")}`);
}
