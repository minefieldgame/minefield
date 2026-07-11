import buzzwordData from "@/data/generated/buzzwords.json";
import countryFactData from "@/data/generated/countryFacts.json";
import manifestData from "@/data/generated/manifest.json";
import { hashString } from "@/lib/dailySeed";

export type BuzzwordCandidate = {
  id: string;
  word: string;
  definition: string;
  commonMisspellings: string[];
  pronunciationHint: string;
  difficulty: "easy" | "medium" | "hard";
  frequencyRank: number;
  sourceNote: string;
  validationVersion: string;
};

export type CountryFact = {
  id: string;
  name: string;
  population: number;
  area: number;
  borders: number;
  languages: number;
  capitals: number;
  timezones: number;
  currencies: number;
  callingCode: number | null;
  latitude: number;
  longitude: number;
  landlocked: boolean;
  region: string;
  subregion: string;
  snapshotDate: string;
  sourceNote: string;
};

export type NumericCandidate = {
  id: string;
  category: string;
  topic: string;
  prompt: string;
  answer: number;
  unit: string;
  alternateUnits: Array<{ unit: string; multiplier: number }>;
  displayAnswer: string;
  acceptableRangeNote: string;
  sourceNote: string;
  verifiedAt: string;
  difficulty: "easy" | "medium" | "hard";
};

export type InOrderCandidate = {
  id: string;
  title: string;
  playerPrompt: string;
  category: string;
  metric: string;
  semanticTopic: string;
  items: Array<[string, string]>;
  numericValues: number[];
  source: string;
  difficulty: "easy" | "medium" | "hard";
};

export const BUZZWORD_CANDIDATES = buzzwordData as BuzzwordCandidate[];
export const COUNTRY_FACTS = countryFactData as CountryFact[];
export const PREPARED_INVENTORY_MANIFEST = manifestData;

const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

const numericMetrics: Array<{
  id: string;
  category: string;
  unit: string;
  value: (country: CountryFact) => number | null;
  prompt: (country: CountryFact) => string;
  display?: (value: number) => string;
  alternateUnits?: Array<{ unit: string; multiplier: number }>;
}> = [
  { id: "population", category: "Population", unit: "people", value: (c) => c.population || null, prompt: (c) => `About how many people live in ${c.name}, using the ${c.snapshotDate} structured-data snapshot?` },
  { id: "area", category: "Geography", unit: "square kilometers", value: (c) => c.area, prompt: (c) => `What is the land area of ${c.name} in square kilometers?`, alternateUnits: [{ unit: "square miles", multiplier: 0.386102 }] },
  { id: "borders", category: "Geography", unit: "countries", value: (c) => c.borders, prompt: (c) => `How many countries share a land border with ${c.name}?` },
  { id: "languages", category: "Culture", unit: "official languages", value: (c) => c.languages, prompt: (c) => `How many official languages are listed for ${c.name}?` },
  { id: "timezones", category: "Geography", unit: "time zones", value: (c) => c.timezones, prompt: (c) => `How many time zones are listed for ${c.name}?` },
  { id: "currencies", category: "Economics", unit: "currencies", value: (c) => c.currencies, prompt: (c) => `How many official currencies are listed for ${c.name}?` },
  { id: "capitals", category: "Geography", unit: "capital cities", value: (c) => c.capitals, prompt: (c) => `How many official capital cities are listed for ${c.name}?` },
  { id: "latitude", category: "Geography", unit: "degrees", value: (c) => Math.abs(c.latitude) || null, prompt: (c) => `About how many degrees from the equator is the geographic center of ${c.name}?` },
  { id: "longitude", category: "Geography", unit: "degrees", value: (c) => Math.abs(c.longitude) || null, prompt: (c) => `About how many degrees from the prime meridian is the geographic center of ${c.name}?` },
  { id: "density", category: "Population", unit: "people per square kilometer", value: (c) => c.population && c.area ? Math.round(c.population / c.area) : null, prompt: (c) => `About how many people per square kilometer live in ${c.name}, using the snapshot population and area?` },
  { id: "calling-code", category: "Technology", unit: "country calling code", value: (c) => c.callingCode && c.callingCode < 1000 ? c.callingCode : null, prompt: (c) => `What is the international telephone calling code number for ${c.name}?` }
];

export function buildNumericCandidates(): NumericCandidate[] {
  return COUNTRY_FACTS.flatMap((country, countryIndex) => numericMetrics.flatMap((metric) => {
    const answer = metric.value(country);
    if (answer === null || !Number.isFinite(answer) || answer === 0) return [];
    const difficulty = countryIndex < 65 ? "easy" : countryIndex < 140 ? "medium" : "hard";
    return [{
      id: `country-${country.id}-${metric.id}`,
      category: metric.category,
      topic: `${country.id}:${metric.id}`,
      prompt: metric.prompt(country),
      answer,
      unit: metric.unit,
      alternateUnits: metric.alternateUnits ?? [],
      displayAnswer: `${metric.display?.(answer) ?? number.format(answer)} ${metric.unit}`,
      acceptableRangeNote: metric.id === "population" || metric.id === "density" ? `Snapshot dated ${country.snapshotDate}` : "Canonical structured value",
      sourceNote: `https://restcountries.com/ — ${country.sourceNote}, ${country.snapshotDate}`,
      verifiedAt: `${country.snapshotDate}T00:00:00.000Z`,
      difficulty
    }];
  }));
}

const orderMetrics = numericMetrics.filter((metric) => !["capitals", "currencies"].includes(metric.id));

function deterministicIndexes(seed: string, count: number, limit: number) {
  const values: number[] = [];
  let cursor = hashString(seed);
  while (values.length < count) {
    cursor = hashString(`${seed}:${cursor}:${values.length}`);
    const index = cursor % limit;
    if (!values.includes(index)) values.push(index);
  }
  return values;
}

export function buildInOrderCandidates(target = 600): InOrderCandidate[] {
  const candidates: InOrderCandidate[] = [];
  const seen = new Set<string>();
  for (let round = 0; candidates.length < target && round < 500; round += 1) {
    for (const metric of orderMetrics) {
      const eligible = COUNTRY_FACTS
        .map((country) => ({ country, value: metric.value(country) }))
        .filter((entry): entry is { country: CountryFact; value: number } => entry.value !== null && Number.isFinite(entry.value));
      const indexes = deterministicIndexes(`${metric.id}:${round}`, 8, eligible.length);
      const picked: Array<{ country: CountryFact; value: number }> = [];
      for (const index of indexes) {
        const entry = eligible[index];
        if (!picked.some((existing) => existing.value === entry.value)) picked.push(entry);
        if (picked.length === 5) break;
      }
      if (picked.length !== 5) continue;
      const identity = picked.map((entry) => entry.country.id).sort().join("-");
      const id = `countries-${metric.id}-${identity}`;
      if (seen.has(id)) continue;
      seen.add(id);
      picked.sort((left, right) => right.value - left.value);
      candidates.push({
        id,
        title: `Countries by ${metric.id.replace(/-/g, " ")}`,
        playerPrompt: `Rank these 5 countries by ${metric.id.replace(/-/g, " ")}, highest to lowest.`,
        category: metric.category,
        metric: metric.id,
        semanticTopic: `countries:${metric.id}`,
        items: picked.map(({ country, value }) => [country.name, `${number.format(value)} ${metric.unit}`]),
        numericValues: picked.map(({ value }) => value),
        source: `https://restcountries.com/ — versioned structured-data snapshot ${COUNTRY_FACTS[0]?.snapshotDate ?? "unknown"}`,
        difficulty: round < 20 ? "easy" : round < 45 ? "medium" : "hard"
      });
      if (candidates.length >= target) break;
    }
  }
  return candidates;
}

export const BALLPARK_CANDIDATES = buildNumericCandidates();
export const IN_ORDER_CANDIDATES = buildInOrderCandidates(600);

export function validateObjectiveOrdering(candidate: InOrderCandidate) {
  return candidate.items.length === 5 &&
    candidate.numericValues.length === 5 &&
    new Set(candidate.numericValues).size === 5 &&
    candidate.numericValues.every((value, index, values) => index === 0 || values[index - 1] > value) &&
    candidate.playerPrompt.length >= 20;
}

export function validateNumericCandidate(candidate: NumericCandidate) {
  return candidate.prompt.length >= 20 && candidate.prompt.length <= 220 &&
    Number.isFinite(candidate.answer) && candidate.answer !== 0 &&
    Boolean(candidate.unit.trim()) && Boolean(candidate.sourceNote.trim()) &&
    !/\b(?:roughly|somewhere|depends on|varies widely)\b/i.test(candidate.prompt);
}

export function validateBuzzwordCandidate(candidate: BuzzwordCandidate) {
  const normalizedMisspellings = candidate.commonMisspellings.map((word) => word.toLowerCase());
  return /^[a-z]{5,22}$/.test(candidate.word) && candidate.definition.length >= 12 &&
    candidate.pronunciationHint.length >= 3 && normalizedMisspellings.length >= 2 &&
    new Set(normalizedMisspellings).size === normalizedMisspellings.length &&
    !normalizedMisspellings.includes(candidate.word.toLowerCase());
}
