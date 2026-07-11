import "server-only";

import { SING_ALONG_CATALOG, type SingAlongCatalogEntry } from "@/data/singAlongCatalog";
import { discoverITunesTracks } from "@/lib/audioProvider";
import { validateOriginalRecordingMetadata, validateSingAlongTimingCandidate } from "@/lib/content/candidateValidation";
import { getPersistedCandidateInventory, savePersistedCandidates, type PersistedCandidate } from "@/lib/content/persistence";
import { createMusicUsedContentKey, createUniqueContentKey, normalizeUsedContentText } from "@/lib/content/usedContentRegistry";
import { createSeededRandom } from "@/lib/dailySeed";

export function singAlongCandidateId(entry: SingAlongCatalogEntry) {
  return createUniqueContentKey("sing-along", "song-lyric", [entry.artist, entry.title, entry.answerLyricExcerpt]);
}

export function singAlongHardKeys(entry: SingAlongCatalogEntry) {
  return [
    singAlongCandidateId(entry),
    createUniqueContentKey("singalong-song", "song", [entry.artist, entry.title]),
    createUniqueContentKey("singalong-lyric", "lyric", [entry.artist, entry.title, entry.answerLyricExcerpt]),
    createMusicUsedContentKey(entry.artist, entry.title)
  ];
}

export async function getValidatedSingAlongCandidates() {
  const persisted = await getPersistedCandidateInventory<SingAlongCatalogEntry>("sing-along");
  const persistedValidated = persisted.filter((record) => record.validationStatus === "validated").map((record) => record.payload);
  const candidates = [...persistedValidated, ...SING_ALONG_CATALOG];
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const id = singAlongCandidateId(candidate);
    if (seen.has(id) || !validateSingAlongTimingCandidate(candidate).valid) return false;
    seen.add(id);
    return true;
  });
}

const queryTaxonomy = [
  "1960s pop hits", "1970s rock hits", "1970s soul hits", "1980s pop hits", "1980s rock hits",
  "1990s pop hits", "1990s R&B hits", "2000s pop hits", "2000s rock hits", "2010s pop hits",
  "classic country hits", "dance hits", "alternative hits", "indie pop hits", "funk hits", "disco hits"
];

export async function discoverSingAlongMetadata(seed: string, queryCount = 4) {
  const queries = createSeededRandom(`${seed}:sing-along-discovery`).shuffle(queryTaxonomy).slice(0, queryCount);
  const discovery = await discoverITunesTracks(queries, 50);
  const now = new Date().toISOString();
  const records: Array<PersistedCandidate<Record<string, unknown>>> = discovery.tracks.flatMap((track) => {
    const title = track.trackName ?? "";
    const artist = track.artistName ?? "";
    const validation = validateOriginalRecordingMetadata({ title, artist, collectionName: track.collectionName, previewUrl: track.previewUrl });
    if (!validation.valid) return [];
    const candidateId = createUniqueContentKey("sing-along-discovery", "song", [artist, title]);
    return [{
      gameId: "sing-along",
      candidateId,
      normalizedContentKeys: [createMusicUsedContentKey(artist, title)],
      payload: {
        title, artist, previewUrl: track.previewUrl, trackId: track.trackId,
        collectionName: track.collectionName, artworkUrl: track.artworkUrl100,
        reviewRequirement: "Add sourced lyric cue, preview-relative timing, four choices, and reviewer approval before validation."
      },
      validationStatus: "pending-review",
      validationVersion: "sing-along-v3",
      sourceMetadata: { provider: "iTunes Search API", queries },
      createdAt: now,
      lastValidatedAt: now,
      invalidReason: "Reliable preview-relative lyric timing requires transcription/alignment and review.",
      qualityScore: 0.5,
      difficulty: "unrated",
      category: "music"
    }];
  });
  const saved = await savePersistedCandidates("sing-along", records);
  return { ...saved, discovered: discovery.tracks.length, pendingReview: records.length, apiCalls: discovery.apiCalls, errors: discovery.errors };
}

export function singAlongInventoryDiagnostics(candidates: SingAlongCatalogEntry[], persisted: number, invalid: number) {
  return {
    contentSource: "persisted reviewed lyric-timing inventory + staged music discovery",
    totalCandidates: candidates.length + invalid,
    validatedCandidateCount: candidates.length,
    playableCandidateCount: candidates.length,
    persistedCandidateCount: persisted,
    timingValidationExclusions: invalid,
    sourceStrategies: ["validated persisted pool", "reviewed seed records", "multi-decade iTunes discovery", "pending timing review queue"],
    candidateKeySample: candidates.slice(0, 3).map((entry) => normalizeUsedContentText(`${entry.artist} ${entry.title}`))
  };
}
