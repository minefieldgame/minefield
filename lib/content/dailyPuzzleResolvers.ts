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
import {
  contentHashFromKey,
  createMusicUsedContentKey,
  createUniqueContentKey,
  selectNonRepeatingDailyCandidate
} from "@/lib/content/usedContentRegistry";

export async function resolveRankedTop5ForDate(
  date: string,
  options: { force?: boolean; retryOffset?: number } = {}
): Promise<RankedTopTenPuzzle> {
  const masterSeed = getDailyMasterSeed(date);
  const seed = getGameSeedForDate(date, "ranked-top-5");
  const selected = selectNonRepeatingDailyCandidate({
    gameId: "ranked-top-5",
    dateKey: date,
    candidates: IN_ORDER_CATALOG,
    contentKey: (candidate) => createUniqueContentKey("ranked-top-5", "ranking", [
      candidate.category,
      candidate.metric,
      candidate.items.map(([answer]) => answer).join("|")
    ])
  });
  const entry = selected.selected;
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
    contentHash: selected.check.uniqueContentKey,
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
    uniqueContentKey: selected.check.uniqueContentKey,
    duplicateCheck: selected.check,
    repeatStatus: {
      checked: true,
      passed: selected.check.passed,
      duplicateDetected: selected.check.duplicateDetected,
      retryCount: selected.check.retryCount + (options.retryOffset ?? 0),
      provider: "deterministic-used-content-registry",
      warning: selected.check.warning
    },
    generationDurationMs: 0,
    validation: { valid: false, checks: {} as RankedTopTenPuzzle["validation"]["checks"], errors: [] },
    rawAIResponse: null
  };
  const validation = validateTopTenPuzzle(base);
  return { ...base, validation, contentHash: contentHashFromKey(selected.check.uniqueContentKey) };
}

export async function resolveSpellDropForDate(
  date: string,
  _force = false
): Promise<GeneratedContentEnvelope<SpellDropPuzzle>> {
  const masterSeed = getDailyMasterSeed(date);
  const seed = getGameSeedForDate(date, "spelldrop");
  const selected = selectNonRepeatingDailyCandidate({
    gameId: "spelldrop",
    dateKey: date,
    candidates: BUZZWORD_CATALOG,
    contentKey: (candidate) => createUniqueContentKey("spelldrop", "word", [candidate.word])
  });
  const entry = selected.selected;
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
    uniqueContentKey: selected.check.uniqueContentKey,
    duplicateCheck: selected.check,
    repeatStatus: {
      checked: true,
      passed: selected.check.passed,
      duplicateDetected: selected.check.duplicateDetected,
      retryCount: selected.check.retryCount,
      provider: "deterministic-used-content-registry",
      warning: selected.check.warning
    }
  } as SpellDropPuzzle;
  return deterministicEnvelope({
    gameId: "spelldrop", date, puzzle, validation: validateSpellDropPuzzle(puzzle),
    topic: "commonly misspelled English words", answer: puzzle.word,
    sourceNotes: ["Versioned Minefield lexical catalog"]
  });
}

export async function resolveCloserForDate(
  date: string,
  _force = false
): Promise<GeneratedContentEnvelope<CloserPuzzle>> {
  const masterSeed = getDailyMasterSeed(date);
  const seed = getGameSeedForDate(date, "closer");
  const selected = selectNonRepeatingDailyCandidate({
    gameId: "closer",
    dateKey: date,
    candidates: BALLPARK_CATALOG,
    contentKey: (candidate) => createUniqueContentKey("closer", "question-answer", [candidate.prompt, candidate.answer, candidate.unit])
  });
  const entry = selected.selected;
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
    uniqueContentKey: selected.check.uniqueContentKey,
    duplicateCheck: selected.check,
    repeatStatus: {
      checked: true,
      passed: selected.check.passed,
      duplicateDetected: selected.check.duplicateDetected,
      retryCount: selected.check.retryCount,
      provider: "deterministic-used-content-registry",
      warning: selected.check.warning
    }
  });
  return deterministicEnvelope({
    gameId: "closer", date, puzzle, validation: validateCloserPuzzle(puzzle),
    topic: puzzle.category, answer: String(puzzle.answer), sourceNotes: [puzzle.sourceNote]
  });
}

export async function resolveNeedleDropForDate(date: string) {
  return resolveNeedleDropDiagnostic(date);
}

export async function resolveSingAlongForDate(date: string): Promise<SingAlongPuzzle> {
  const masterSeed = getDailyMasterSeed(date);
  const seed = getGameSeedForDate(date, "sing-along");
  const selected = selectNonRepeatingDailyCandidate({
    gameId: "sing-along",
    dateKey: date,
    candidates: SING_ALONG_CATALOG,
    contentKey: (candidate) => createUniqueContentKey("sing-along", "song-lyric", [
      candidate.artist,
      candidate.title,
      candidate.lyricExcerpt
    ])
  });
  const entries = [
    selected.selected,
    ...createSeededRandom(seed).shuffle(SING_ALONG_CATALOG.filter((entry) => entry !== selected.selected))
  ];

  for (const entry of entries) {
    const track = await searchTrackPreview(entry.title, entry.artist).catch(() => null);
    if (!track?.previewUrl) continue;
    const allAccepted = [entry.acceptedLyric, ...entry.alternateAcceptedLyrics];
    return {
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
      acceptedLyric: entry.acceptedLyric,
      lyricExcerpt: entry.lyricExcerpt,
      lyricStartTimeSeconds: entry.lyricStartTimeSeconds,
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
          entry.clipStartTimeSeconds < entry.lyricStartTimeSeconds &&
          entry.clipEndTimeSeconds > entry.lyricStartTimeSeconds &&
          entry.clipStartTimeSeconds > 0,
        errors: []
      },
      uniqueContentKey: selected.check.uniqueContentKey,
      musicUsedContentKey: createMusicUsedContentKey(entry.artist, entry.title),
      duplicateCheck: selected.check,
      repeatStatus: {
        checked: true,
        passed: selected.check.passed,
        duplicateDetected: selected.check.duplicateDetected,
        retryCount: selected.check.retryCount,
        provider: "deterministic-used-content-registry",
        warning: selected.check.warning
      },
      contentHash: contentHashFromKey(selected.check.uniqueContentKey)
    };
  }

  throw new Error("No playable Sing Along preview was available.");
}
