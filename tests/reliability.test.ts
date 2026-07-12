import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { SING_ALONG_CATALOG } from "../data/singAlongCatalog";
import { calculateProjectedMidpoint } from "../games/geography/logic";
import { createMusicUsedContentKey, createUniqueContentKey, normalizeUsedContentText } from "../lib/content/usedContentRegistry";
import { getPacificDateKey } from "../lib/date";
import { ACTIVE_GAME_IDS } from "../lib/gameDisplay";

test("Pacific date does not roll over at UTC midnight before Pacific midnight", () => {
  assert.equal(getPacificDateKey(new Date("2026-06-22T06:59:00Z")), "2026-06-21");
  assert.equal(getPacificDateKey(new Date("2026-06-22T07:01:00Z")), "2026-06-22");
});

test("Pacific date handles daylight-saving boundaries", () => {
  assert.equal(getPacificDateKey(new Date("2026-03-08T07:59:00Z")), "2026-03-07");
  assert.equal(getPacificDateKey(new Date("2026-03-08T08:01:00Z")), "2026-03-08");
  assert.equal(getPacificDateKey(new Date("2026-11-01T06:59:00Z")), "2026-10-31");
  assert.equal(getPacificDateKey(new Date("2026-11-01T07:01:00Z")), "2026-11-01");
});

test("projected midpoint uses the visually shortest wrapped longitude path", () => {
  const midpoint = calculateProjectedMidpoint(
    { latitude: 35.6895, longitude: 139.6917 },
    { latitude: 37.7749, longitude: -122.4194 }
  );
  assert.ok(midpoint.longitude > 170 || midpoint.longitude < -170, `Expected antimeridian midpoint, got ${midpoint.longitude}`);
});

test("retired Sing Along records stay archive-only and safe for legacy puzzle reads", () => {
  assert.ok(SING_ALONG_CATALOG.length > 0);
  assert.equal(new Set<string>(ACTIVE_GAME_IDS).has("sing-along"), false);
  for (const entry of SING_ALONG_CATALOG) {
    assert.equal(entry.eligibilityState, "archive-only", `${entry.artist} - ${entry.title} must not return to active eligibility`);
    assert.equal(entry.choices.length, 4, `${entry.artist} - ${entry.title} must have four choices`);
    assert.equal(entry.choices.filter((choice) => choice.isCorrect).length, 1, `${entry.artist} - ${entry.title} must have one correct choice`);
    assert.ok(entry.clipStartTimeSeconds > 0, `${entry.artist} - ${entry.title} must not start from an unrelated intro`);
    assert.ok(entry.clipEndTimeSeconds < entry.answerLyricStartTimeSeconds, `${entry.artist} - ${entry.title} clip must stop before answer lyric`);
    const gap = entry.answerLyricStartTimeSeconds - entry.clipEndTimeSeconds;
    assert.ok(gap >= 0.25 && gap <= 1, `${entry.artist} - ${entry.title} stop gap must be 0.25-1.0 seconds`);
    const clipLength = entry.clipEndTimeSeconds - entry.clipStartTimeSeconds;
    assert.ok(clipLength >= 8 && clipLength <= 15, `${entry.artist} - ${entry.title} clip length must be 8-15 seconds`);
    assert.equal(new Set(entry.choices.map((choice) => normalizeUsedContentText(choice.text))).size, 4, `${entry.artist} - ${entry.title} choices must be distinct`);
  }
});

test("admin header and active game labels contain no known mojibake sequences", () => {
  const adminSource = fs.readFileSync(new URL("../components/admin/AdminDashboard.tsx", import.meta.url), "utf8");
  const displaySource = fs.readFileSync(new URL("../lib/gameDisplay.ts", import.meta.url), "utf8");
  for (const [label, source] of [["admin", adminSource], ["game display", displaySource]] as const) {
    assert.doesNotMatch(source, /\u00C3\u201A|\u00C3\u00A2|\u00EF\u00BF\u00BD|\uFFFD/, `${label} source contains a known double-encoding marker`);
  }
  assert.match(adminSource, /\{environment\} \/ Pacific \{pacific\.dateKey\}/);
  assert.match(adminSource, /\{dark \? "Light" : "Dark"\}/);
});

test("duplicate keys normalize punctuation, articles, and shared music identity", () => {
  assert.equal(
    createMusicUsedContentKey("Beyoncé", "Crazy in Love"),
    createMusicUsedContentKey("Beyonce", "The Crazy in Love")
  );
  assert.equal(
    createUniqueContentKey("ranked-top-5", "answer-set", ["The Beatles|Jay-Z"]),
    createUniqueContentKey("ranked-top-5", "answer-set", ["Beatles|Jay Z"])
  );
});
