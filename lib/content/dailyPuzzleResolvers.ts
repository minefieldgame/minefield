import "server-only";

import { validateTopTenPuzzle } from "@/games/top-ten/providers";
import { validateSpellDropPuzzle } from "@/games/spelldrop/providers";
import { inferCloserScoringProfile, validateCloserPuzzle } from "@/games/closer/providers";
import { resolveNeedleDropDiagnostic } from "@/lib/needledropResolver";
import type { RankedTopTenPuzzle } from "@/games/top-ten/types";
import type { SpellDropPuzzle } from "@/games/spelldrop/types";
import type { CloserPuzzle } from "@/games/closer/types";
import type { GeneratedContentEnvelope } from "@/lib/content/dailyContentEngine";
import { createSeededRandom, getDailyMasterSeed, getGameSeedForDate } from "@/lib/dailySeed";
import { deterministicEnvelope } from "@/lib/content/deterministicEnvelope";
import {
  BALLPARK_CANDIDATES,
  BUZZWORD_CANDIDATES,
  IN_ORDER_CANDIDATES,
  validateBuzzwordCandidate,
  validateNumericCandidate,
  validateObjectiveOrdering
} from "@/lib/content/preparedInventories";
import { searchTrackPreview } from "@/lib/audioProvider";
import type { SingAlongPuzzle } from "@/games/sing-along/types";
import { selectFromContentUniverse, seededUniverseSelector } from "@/lib/content/contentUniverse";
import {
  contentHashFromKey,
  createMusicUsedContentKey,
  createUsedContentRecord,
  createUniqueContentKey
} from "@/lib/content/usedContentRegistry";
import {
  getInventoryUsageCounts,
  getPersistedCandidateInventory,
  getPersistedPuzzle,
  publishDailyPuzzleWithUsedContent
} from "@/lib/content/persistence";
import { CONTENT_INVENTORY_POLICY } from "@/lib/content/inventoryPolicy";
import { discoverSingAlongMetadata, getValidatedSingAlongCandidates, singAlongCandidateId, singAlongHardKeys } from "@/lib/content/singAlongInventory";
import { validateSingAlongTimingCandidate } from "@/lib/content/candidateValidation";
import { replenishModelCandidates } from "@/lib/content/modelReplenishment";

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

async function loadReplenishableInventory<T>({
  gameId,
  prepared,
  candidateId,
  validate,
  seed
}: {
  gameId: "spelldrop" | "closer" | "ranked-top-5";
  prepared: readonly T[];
  candidateId: (candidate: T) => string;
  validate: (candidate: T) => boolean;
  seed: string;
}) {
  let persisted = await getPersistedCandidateInventory<T>(gameId);
  const usage = await getInventoryUsageCounts([gameId]);
  let generated = 0;
  let rejected = 0;
  const merge = () => [...new Map([
    ...prepared.map((candidate) => [candidateId(candidate), candidate] as const),
    ...persisted.filter((record) => record.validationStatus === "validated" && validate(record.payload)).map((record) => [candidateId(record.payload), record.payload] as const)
  ]).values()];
  let candidates = merge();
  if (candidates.length - (usage.get(gameId) ?? 0) < CONTENT_INVENTORY_POLICY[gameId].replenishBelow) {
    const replenished = await replenishModelCandidates(gameId, seed).catch(() => null);
    generated = replenished?.generated ?? 0;
    rejected = replenished?.rejected ?? 0;
    if (replenished?.validated) {
      persisted = await getPersistedCandidateInventory<T>(gameId);
      candidates = merge();
    }
  }
  return { candidates, generated, rejected };
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
  const candidateKey = (entry: typeof IN_ORDER_CANDIDATES[number]) => createUniqueContentKey("ranked-top-5", "ranking", [
    entry.metric,
    entry.items.map(([answer]) => answer).sort().join("|")
  ]);
  const answerSetKey = (entry: typeof IN_ORDER_CANDIDATES[number]) =>
    createUniqueContentKey("ranked-top-5", "answer-set", [entry.items.map(([answer]) => answer).sort().join("|")]);
  const topicKey = (entry: typeof IN_ORDER_CANDIDATES[number]) =>
    createUniqueContentKey("ranked-top-5", "topic-soft", [entry.semanticTopic]);
  const inventory = await loadReplenishableInventory({
    gameId: "ranked-top-5", prepared: IN_ORDER_CANDIDATES, candidateId: candidateKey,
    validate: validateObjectiveOrdering, seed: `${date}:${seed}:in-order-replenishment`
  });
  const selected = await selectFromContentUniverse({
    gameSeed: `${seed}:${options.retryOffset ?? 0}`,
    contentSource: "versioned-in-order-reference-universe",
    softCooldownLabel: "recent In Order category cooldown",
    dateKey: date,
    cooldownDays: CONTENT_INVENTORY_POLICY["ranked-top-5"].cooldownDays,
    batchSizes: [200, 400, 600],
    universe: {
      getAllCandidates: () => inventory.candidates,
      getCandidateId: candidateKey,
      getHardKeys: (entry) => [candidateKey(entry), answerSetKey(entry)],
      getSoftKeys: (entry) => [topicKey(entry)],
      validateCandidate: (entry) => ({ valid: validateObjectiveOrdering(entry), reason: "Exactly five uniquely ordered factual values required" }),
      selectCandidate: seededUniverseSelector(candidateKey)
    }
  });
  selected.diagnostics.candidatesGeneratedCurrentRequest = inventory.generated;
  selected.diagnostics.warnings.push(...(inventory.rejected ? [`Model replenishment rejected ${inventory.rejected} invalid candidates.`] : []));
  const entry = selected.selected;
  if (!entry) throw new Error(`In Order could not generate non-repeating content: ${selected.diagnostics.warnings.join(" ")}`);
  const uniqueContentKey = createUniqueContentKey("ranked-top-5", "ranking", [
    entry.category,
    entry.metric,
    entry.items.map(([answer]) => answer).join("|")
  ]);
  const secondaryKeys = [answerSetKey(entry), topicKey(entry)];
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
    generator: "Prepared structured-data inventory + model-assisted replenishment",
    cacheHit: false,
    masterSeed,
    gameSeed: seed,
    deterministicSelectors: {
      topicArea: entry.category,
      rankingType: entry.metric,
      difficulty: entry.difficulty,
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
      source: "prepared-structured-data-inventory"
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
  const wordKey = (entry: typeof BUZZWORD_CANDIDATES[number]) => createUniqueContentKey("spelldrop", "word", [entry.word]);
  const definitionKey = (entry: typeof BUZZWORD_CANDIDATES[number]) => createUniqueContentKey("spelldrop", "definition", [entry.definition]);
  const difficultyKey = (entry: typeof BUZZWORD_CANDIDATES[number]) => createUniqueContentKey("spelldrop", "difficulty-soft", [entry.difficulty]);
  const inventory = await loadReplenishableInventory({
    gameId: "spelldrop", prepared: BUZZWORD_CANDIDATES, candidateId: wordKey,
    validate: validateBuzzwordCandidate, seed: `${date}:${seed}:buzzword-replenishment`
  });
  const selection = await selectFromContentUniverse({
    gameSeed: String(seed),
    contentSource: "prepared-wordnet-subtlex-cmudict-inventory",
    softCooldownLabel: "recent Buzzword difficulty cooldown",
    dateKey: date,
    cooldownDays: CONTENT_INVENTORY_POLICY.spelldrop.cooldownDays,
    batchSizes: [250, 750, 2000, 5000],
    universe: {
      getAllCandidates: () => inventory.candidates,
      getCandidateId: wordKey,
      getHardKeys: (entry) => [wordKey(entry), createUniqueContentKey("spelldrop", "answer", [entry.word]), definitionKey(entry)],
      getSoftKeys: (entry) => [difficultyKey(entry)],
      validateCandidate: (entry) => ({ valid: validateBuzzwordCandidate(entry), reason: "Lexical candidate validation failed" }),
      selectCandidate: seededUniverseSelector(wordKey)
    }
  });
  selection.diagnostics.candidatesGeneratedCurrentRequest = inventory.generated;
  selection.diagnostics.warnings.push(...(inventory.rejected ? [`Model replenishment rejected ${inventory.rejected} invalid candidates.`] : []));
  const entry = selection.selected;
  if (!entry) throw new Error(`Buzzword exhausted every configured strategy. Prepared inventory: ${BUZZWORD_CANDIDATES.length}; ${selection.diagnostics.warnings.join(" ")}`);
  const uniqueContentKey = wordKey(entry);
  const secondaryKeys = [createUniqueContentKey("spelldrop", "answer", [entry.word]), definitionKey(entry), difficultyKey(entry)];
  const existingKeys: string[] = [];
  const puzzle: SpellDropPuzzle = {
    gameId: "spelldrop", date, seed,
    word: entry.word,
    definition: entry.definition,
    commonMisspellings: entry.commonMisspellings,
    difficulty: entry.difficulty,
    pronunciationHint: entry.pronunciationHint,
    masterSeed,
    gameSeed: seed,
    deterministicSelectors: {
      difficulty: entry.difficulty,
      wordPattern: "frequency-ranked orthographic-trap word",
      lengthBucket: entry.word.length <= 7 ? "short" : entry.word.length <= 12 ? "8-12 letters" : "long"
    },
    promptConstraints: `Select one ${entry.difficulty} commonly misspelled everyday word.`,
    uniqueContentKey,
    secondaryKeys,
    duplicateCheck: duplicateCheck({ uniqueContentKey, existingKeys, retryCount: 0 }),
    repeatStatus: {
      checked: true,
      passed: true,
      duplicateDetected: false,
      retryCount: 0,
      provider: "dynamodb-used-content-registry"
    }
  } as SpellDropPuzzle;
  const envelope = deterministicEnvelope({
    gameId: "spelldrop", date, puzzle, validation: validateSpellDropPuzzle(puzzle),
    topic: "commonly misspelled English words", answer: puzzle.word,
    sourceNotes: [entry.sourceNote],
    generator: "Prepared WordNet + SUBTLEX + CMUdict inventory; model-assisted batch replenishment",
    contentUniverse: selection.diagnostics
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
      source: "prepared-validated-word-inventory"
    }
  });
  return accepted;
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
  const questionKey = (entry: typeof BALLPARK_CANDIDATES[number]) => createUniqueContentKey("closer", "question-answer", [entry.prompt, entry.answer, entry.unit]);
  const topicAnswerKey = (entry: typeof BALLPARK_CANDIDATES[number]) => createUniqueContentKey("closer", "answer-topic", [entry.topic, entry.answer, entry.unit]);
  const categoryKey = (entry: typeof BALLPARK_CANDIDATES[number]) => createUniqueContentKey("closer", "category-soft", [entry.category]);
  const inventory = await loadReplenishableInventory({
    gameId: "closer", prepared: BALLPARK_CANDIDATES, candidateId: questionKey,
    validate: validateNumericCandidate, seed: `${date}:${seed}:ballpark-replenishment`
  });
  const selection = await selectFromContentUniverse({
    gameSeed: String(seed),
    contentSource: "verified-structured-numeric-inventory",
    softCooldownLabel: "recent numeric-trivia category cooldown",
    dateKey: date,
    cooldownDays: CONTENT_INVENTORY_POLICY.closer.cooldownDays,
    batchSizes: [250, 750, 1500, BALLPARK_CANDIDATES.length],
    universe: {
      getAllCandidates: () => inventory.candidates,
      getCandidateId: questionKey,
      getHardKeys: (entry) => [questionKey(entry), topicAnswerKey(entry)],
      getSoftKeys: (entry) => [categoryKey(entry)],
      validateCandidate: (entry) => ({ valid: validateNumericCandidate(entry), reason: "Numeric fact validation failed" }),
      selectCandidate: seededUniverseSelector(questionKey)
    }
  });
  selection.diagnostics.candidatesGeneratedCurrentRequest = inventory.generated;
  selection.diagnostics.warnings.push(...(inventory.rejected ? [`Model replenishment rejected ${inventory.rejected} invalid candidates.`] : []));
  const entry = selection.selected;
  if (!entry) throw new Error(`In the Ballpark exhausted every configured strategy. Prepared structured candidates: ${BALLPARK_CANDIDATES.length}; ${selection.diagnostics.warnings.join(" ")}`);
  const uniqueContentKey = questionKey(entry);
  const secondaryKeys = [topicAnswerKey(entry), categoryKey(entry)];
  const existingKeys: string[] = [];
  const scoringProfile = inferCloserScoringProfile(entry);
  const puzzle: CloserPuzzle = {
    gameId: "closer", date, seed,
    id: entry.id,
    category: entry.category,
    prompt: entry.prompt,
    answer: entry.answer,
    unit: entry.unit,
    displayAnswer: entry.displayAnswer,
    acceptableRangeNote: entry.acceptableRangeNote,
    sourceNote: entry.sourceNote,
    difficulty: entry.difficulty,
    scoringProfile,
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
    duplicateCheck: duplicateCheck({ uniqueContentKey, existingKeys, retryCount: 0 }),
    repeatStatus: {
      checked: true,
      passed: true,
      duplicateDetected: false,
      retryCount: 0,
      provider: "dynamodb-used-content-registry"
    }
  });
  const envelope = deterministicEnvelope({
    gameId: "closer", date, puzzle, validation: validateCloserPuzzle(puzzle),
    topic: puzzle.category, answer: String(puzzle.answer), sourceNotes: [puzzle.sourceNote],
    generator: "Prepared verified structured-data inventory; model-assisted batch replenishment",
    contentUniverse: selection.diagnostics
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
      source: "prepared-verified-numeric-inventory"
    }
  });
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
  if (persisted) return { ...persisted, contentUniverse: { ...(persisted.contentUniverse ?? {}), cacheStatus: "Cached" } };
  const masterSeed = getDailyMasterSeed(date);
  const seed = getGameSeedForDate(date, "sing-along");
  const allEntries = await getValidatedSingAlongCandidates();
  const timedValid = allEntries.filter((entry) => validateSingAlongTimingCandidate(entry).valid);
  const trackByCandidate = new Map<string, NonNullable<Awaited<ReturnType<typeof searchTrackPreview>>>>();
  let providerApiCalls = 0;
  let previewRejected = 0;
  const orderedForMedia = createSeededRandom(`${seed}:sing-along-media`).shuffle(timedValid).slice(0, 200);
  for (let index = 0; index < orderedForMedia.length; index += 10) {
    const batch = orderedForMedia.slice(index, index + 10);
    providerApiCalls += batch.length;
    const tracks = await Promise.all(batch.map((entry) => searchTrackPreview(entry.title, entry.artist).catch(() => null)));
    tracks.forEach((track, trackIndex) => {
      if (track?.previewUrl) trackByCandidate.set(singAlongCandidateId(batch[trackIndex]), track);
      else previewRejected += 1;
    });
  }
  const playable = timedValid.filter((entry) => trackByCandidate.has(singAlongCandidateId(entry)));
  const artistSoftKey = (entry: typeof playable[number]) => createUniqueContentKey("sing-along", "artist-soft", [entry.artist]);
  const selection = await selectFromContentUniverse({
    gameSeed: String(seed),
    contentSource: "persisted-reviewed-timing-pool + iTunes preview validation",
    softCooldownLabel: "recent Sing Along artist cooldown",
    dateKey: date,
    cooldownDays: CONTENT_INVENTORY_POLICY["sing-along"].cooldownDays,
    batchSizes: [50, 100, 200],
    universe: {
      getAllCandidates: () => playable,
      getCandidateId: singAlongCandidateId,
      getHardKeys: singAlongHardKeys,
      getSoftKeys: (entry) => [artistSoftKey(entry)],
      validateCandidate: (entry) => ({ valid: validateSingAlongTimingCandidate(entry).valid, reason: validateSingAlongTimingCandidate(entry).errors.join("; ") }),
      selectCandidate: seededUniverseSelector(singAlongCandidateId)
    }
  });
  const entry = selection.selected;
  if (!entry) {
    const discovery = await discoverSingAlongMetadata(`${date}:${seed}`, 4).catch((error) => ({ discovered: 0, pendingReview: 0, apiCalls: 4, errors: [error instanceof Error ? error.message : "discovery failed"] }));
    throw new Error(`Sing Along exhausted every configured strategy. Reviewed timing records: ${timedValid.length}; playable previews: ${playable.length}; preview rejected: ${previewRejected}; duplicate/cooldown remaining: ${selection.diagnostics.remainingCandidates}; expanded discovery: ${discovery.discovered}; queued for timing review: ${discovery.pendingReview}; provider errors: ${discovery.errors.join(" | ") || "none"}. Exact song and lyric duplicates were not relaxed.`);
  }
  const track = trackByCandidate.get(singAlongCandidateId(entry));
  if (!track) throw new Error("Sing Along selected a candidate whose preview disappeared after validation.");
  const [uniqueContentKey, ...hardSecondaryKeys] = singAlongHardKeys(entry);
  const musicUsedContentKey = createMusicUsedContentKey(entry.artist, entry.title);
  const secondaryKeys = [...hardSecondaryKeys, artistSoftKey(entry)];
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
        source: "persisted reviewed lyric-timing inventory",
        chartEra: String(entry.chartYear),
        cueType: "recognizable hook"
      },
      promptConstraints: "Pick a stable Billboard song cue with exactly four short lyric choices and one correct answer.",
      validation: validateSingAlongTimingCandidate(entry),
      uniqueContentKey,
      secondaryKeys,
      musicUsedContentKey,
      duplicateCheck: duplicateCheck({ uniqueContentKey, existingKeys: [], retryCount: 0 }),
      repeatStatus: {
        checked: true,
        passed: true,
        duplicateDetected: false,
        retryCount: 0,
        provider: "dynamodb-used-content-registry"
      },
      contentHash: contentHashFromKey(uniqueContentKey),
      contentUniverse: {
        ...selection.diagnostics,
        totalCandidates: timedValid.length,
        playableCandidateCount: playable.length,
        previewAvailabilityRejectionCount: previewRejected,
        timingValidationExclusions: allEntries.length - timedValid.length,
        providerApiCalls,
        sourceStrategies: ["validated persisted pool", "reviewed seed records", "multi-decade discovery", "timing-review queue"]
      }
    };
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
