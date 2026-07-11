import assert from "node:assert/strict";
import { LANDMARKS } from "../data/landmarks";
import { SING_ALONG_CATALOG } from "../data/singAlongCatalog";
import { BALLPARK_CANDIDATES, BUZZWORD_CANDIDATES, IN_ORDER_CANDIDATES, validateBuzzwordCandidate, validateNumericCandidate, validateObjectiveOrdering } from "../lib/content/preparedInventories";
import { validateSingAlongTimingCandidate } from "../lib/content/candidateValidation";
import { createMusicUsedContentKey, createUniqueContentKey, normalizeUsedContentText } from "../lib/content/usedContentRegistry";

function unique(values: string[], label: string) {
  assert.equal(new Set(values).size, values.length, `${label} contains duplicate normalized keys`);
}

assert.ok(BUZZWORD_CANDIDATES.length >= 5000);
assert.ok(BUZZWORD_CANDIDATES.every(validateBuzzwordCandidate));
unique(BUZZWORD_CANDIDATES.map((item) => normalizeUsedContentText(item.word)), "Buzzword inventory");
unique(BUZZWORD_CANDIDATES.map((item) => createUniqueContentKey("spelldrop", "definition", [item.definition])), "Buzzword definitions");

assert.ok(BALLPARK_CANDIDATES.length >= 2000);
assert.ok(BALLPARK_CANDIDATES.every(validateNumericCandidate));
unique(BALLPARK_CANDIDATES.map((item) => createUniqueContentKey("closer", "question", [item.prompt])), "Ballpark questions");

assert.ok(IN_ORDER_CANDIDATES.length >= 500);
assert.ok(IN_ORDER_CANDIDATES.every(validateObjectiveOrdering));
unique(IN_ORDER_CANDIDATES.map((item) => createUniqueContentKey("ranked-top-5", "list", [item.metric, ...item.items.map(([name]) => name).sort()])), "In Order lists");

assert.ok(LANDMARKS.length >= 500);
unique(LANDMARKS.map((item) => item.id), "Landmark IDs");
unique(LANDMARKS.map((item) => normalizeUsedContentText(item.name)), "Landmark names");
unique(LANDMARKS.map((item) => item.imageFile.toLowerCase()), "Landmark source files");
unique(LANDMARKS.map((item) => `${item.latitude.toFixed(5)},${item.longitude.toFixed(5)}`), "Landmark coordinates");
assert.ok(LANDMARKS.every((item) => Number.isFinite(item.latitude) && Math.abs(item.latitude) <= 90 && Number.isFinite(item.longitude) && Math.abs(item.longitude) <= 180));
assert.ok(LANDMARKS.every((item) => item.mimeType.startsWith("image/") && item.mimeType !== "image/svg+xml" && item.width >= 640 && item.height >= 480 && item.attribution && item.license));

assert.ok(SING_ALONG_CATALOG.every((item) => validateSingAlongTimingCandidate(item).valid));
unique(SING_ALONG_CATALOG.map((item) => createMusicUsedContentKey(item.artist, item.title)), "Sing Along songs");

const continents = Object.fromEntries([...new Set(LANDMARKS.map((item) => item.continent))].map((continent) => [continent, LANDMARKS.filter((item) => item.continent === continent).length]));
const categories = Object.fromEntries([...new Set(LANDMARKS.map((item) => item.category))].map((category) => [category, LANDMARKS.filter((item) => item.category === category).length]));
assert.ok(Math.max(...Object.values(continents)) < LANDMARKS.length * 0.5, "No continent may dominate half of the landmark catalog");
console.log(JSON.stringify({ buzzwords: BUZZWORD_CANDIDATES.length, ballpark: BALLPARK_CANDIDATES.length, inOrder: IN_ORDER_CANDIDATES.length, singAlongReviewed: SING_ALONG_CATALOG.length, landmarks: LANDMARKS.length, continents, categories }, null, 2));
