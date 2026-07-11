import type { SingAlongCatalogEntry } from "@/data/singAlongCatalog";
import { normalizeUsedContentText } from "@/lib/content/usedContentRegistry";

export function validateSingAlongTimingCandidate(entry: SingAlongCatalogEntry) {
  const errors: string[] = [];
  const gap = entry.answerLyricStartTimeSeconds - entry.clipEndTimeSeconds;
  const clipLength = entry.clipEndTimeSeconds - entry.clipStartTimeSeconds;
  if (entry.choices.length !== 4 || entry.choices.filter((choice) => choice.isCorrect).length !== 1) errors.push("exactly four choices and one correct choice required");
  if (new Set(entry.choices.map((choice) => normalizeUsedContentText(choice.text))).size !== 4) errors.push("choices must be distinct");
  if (!(entry.clipStartTimeSeconds > 0)) errors.push("clip must not begin at an unrelated zero-second intro");
  if (!(entry.clipEndTimeSeconds < entry.answerLyricStartTimeSeconds)) errors.push("answer lyric must begin after clip ends");
  if (!(gap >= 0.25 && gap <= 1)) errors.push("clip must end 0.25-1.0 seconds before answer lyric");
  if (!(clipLength >= 8 && clipLength <= 15)) errors.push("clip must be 8-15 seconds");
  if (normalizeUsedContentText(entry.setupLyricExcerpt) === normalizeUsedContentText(entry.title)) errors.push("lyric prompt cannot be only the song title");
  if (normalizeUsedContentText(entry.setupLyricExcerpt) === normalizeUsedContentText(entry.answerLyricExcerpt)) errors.push("answer lyric cannot already appear in the prompt");
  if (!entry.sourceNote.trim()) errors.push("timing source/review note required");
  return { valid: errors.length === 0, errors };
}

export function validateOriginalRecordingMetadata(input: { title: string; artist: string; collectionName?: string; previewUrl?: string }) {
  const errors: string[] = [];
  const text = `${input.title} ${input.artist} ${input.collectionName ?? ""}`;
  if (!input.previewUrl) errors.push("preview unavailable");
  if (/\b(karaoke|tribute|in the style of|made famous by|cover version|live at|live from|remix|re-recorded|instrumental version)\b/i.test(text)) errors.push("alternate or mismatched recording");
  if (!input.title.trim() || !input.artist.trim()) errors.push("title and artist required");
  return { valid: errors.length === 0, errors };
}
