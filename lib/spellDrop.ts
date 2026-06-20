import { SPELLDROP_WORDS } from "@/data/spellDropWords";
import { hashString } from "@/lib/dailySeed";

export const SPELLDROP_REPLAY_LIMIT = 2;

export function normalizeSpelling(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z]/g, "")
    .toLowerCase();
}

export function getSpellDropWord(date: string) {
  const seed = hashString(`spelldrop:${date}`);
  return {
    word: SPELLDROP_WORDS[seed % SPELLDROP_WORDS.length],
    seed,
    replayLimit: SPELLDROP_REPLAY_LIMIT,
    wordCount: SPELLDROP_WORDS.length
  };
}

export function checkSpelling(guess: string, word: string) {
  return normalizeSpelling(guess) === normalizeSpelling(word);
}
