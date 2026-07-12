import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { chartIssueDeltaDays, historicalChartAnchorDate, isChartIssueAnchoredToDate } from "../lib/chartProvider";
import {
  aggregateRewindInventoryMetrics,
  assertRewindInventoryMetricInvariants,
  isRewindSeasonalCooldownActive,
  isRewindSeasonalHolidaySong,
  orderRewindCandidatesByRecognizability,
  REWIND_HOLIDAY_COOLDOWN_DAYS,
  resolveRewindOriginalReleaseProvenance,
  scoreRewindRecognizability,
  summarizeRewindRecognizabilityTiers,
  validateRewindOriginalRecording
} from "../lib/content/rewindQuality";

test("Rewind historical anchors preserve the selected month and day", () => {
  assert.equal(historicalChartAnchorDate("2026-12-12", 1990), "1990-12-12");
  assert.equal(historicalChartAnchorDate("2028-02-29", 1991), "1991-02-28");
  assert.equal(historicalChartAnchorDate("2028-02-29", 1992), "1992-02-29");
});

test("Rewind accepts only nearby weekly chart issues and forbids unrelated months", () => {
  assert.equal(chartIssueDeltaDays("1990-12-12", "1990-12-15"), 3);
  assert.equal(isChartIssueAnchoredToDate("1990-12-12", "1990-12-15", 14), true);
  assert.equal(isChartIssueAnchoredToDate("1990-12-12", "1990-12-26", 14), true);
  assert.equal(isChartIssueAnchoredToDate("1990-12-12", "1990-12-27", 14), false);
  assert.equal(isChartIssueAnchoredToDate("1990-12-12", "1990-05-12", 14), false);
});

test("Rewind recognizability scoring creates useful deterministic tiers", () => {
  const iconic = scoreRewindRecognizability({
    chartPosition: 1,
    chartAppearances: 6,
    distinctChartIssues: 6,
    artistDistinctHits: 6,
    artistChartAppearances: 18,
    chartYear: 1984,
    currentYear: 2026,
    previewAvailable: true,
    originalRecordingConfidence: 0.98
  });
  const mainstream = scoreRewindRecognizability({ chartPosition: 3, chartYear: 2005, currentYear: 2026 });
  const challenging = scoreRewindRecognizability({ chartPosition: 35, chartYear: 1999, currentYear: 2026 });
  const rejected = scoreRewindRecognizability({ chartPosition: 88, chartYear: 2024, currentYear: 2026 });
  assert.equal(iconic.tier, "iconic");
  assert.equal(mainstream.tier, "mainstream");
  assert.equal(challenging.tier, "challenging");
  assert.equal(rejected.tier, "reject");
  assert.match(rejected.rejectionReasons.join(" "), /lacks recurrence or artist-familiarity/i);
  assert.deepEqual(scoreRewindRecognizability({ chartPosition: 3, chartYear: 2005, currentYear: 2026 }), mainstream);
});

test("low-chart Rewind songs require meaningful additional popularity evidence", () => {
  const unsupported = scoreRewindRecognizability({ chartPosition: 80, chartAppearances: 1, artistDistinctHits: 1, chartYear: 1990, currentYear: 2026 });
  const supported = scoreRewindRecognizability({
    chartPosition: 80,
    chartAppearances: 5,
    distinctChartIssues: 5,
    artistDistinctHits: 5,
    artistChartAppearances: 12,
    chartYear: 1990,
    currentYear: 2026,
    previewAvailable: true,
    originalRecordingConfidence: 1
  });
  assert.equal(unsupported.tier, "reject");
  assert.notEqual(supported.tier, "reject");
  assert.ok(supported.score > unsupported.score);
});

test("tier ordering strongly favors mainstream inventory and bounds challenge-first selection", () => {
  const iconic = { id: "iconic", recognizability: scoreRewindRecognizability({ chartPosition: 1, chartAppearances: 5, artistDistinctHits: 5, chartYear: 1985, currentYear: 2026 }) };
  const mainstream = { id: "mainstream", recognizability: scoreRewindRecognizability({ chartPosition: 2, chartYear: 2000, currentYear: 2026 }) };
  const challenging = { id: "challenging", recognizability: scoreRewindRecognizability({ chartPosition: 35, chartYear: 2000, currentYear: 2026 }) };
  const rejected = { id: "reject", recognizability: scoreRewindRecognizability({ chartPosition: 95, chartYear: 2025, currentYear: 2026 }) };
  const normalOrder = orderRewindCandidatesByRecognizability([iconic, mainstream, challenging, rejected], "stable", 0);
  const challengeOrder = orderRewindCandidatesByRecognizability([iconic, mainstream, challenging, rejected], "stable", 1);
  assert.notEqual(normalOrder[0].recognizability.tier, "challenging");
  assert.equal(challengeOrder[0].recognizability.tier, "challenging");
  assert.ok(normalOrder.every((item) => item.id !== "reject"));
});

test("original-recording validation rejects altered, cover, live, karaoke, and tribute results", () => {
  const rejected = [
    { title: "Famous Song (Sped Up)", artist: "Artist" },
    { title: "Famous Song - Slowed + Reverb", artist: "Artist" },
    { title: "Famous Song (Live at Wembley)", artist: "Artist" },
    { title: "Famous Song (Club Remix)", artist: "Artist" },
    { title: "Famous Song (Cover Version)", artist: "Artist" },
    { title: "Famous Song", artist: "Artist Tribute Band" },
    { title: "Famous Song", artist: "Karaoke All-Stars" },
    { title: "Famous Song (Taylor's Version)", artist: "Artist" },
    { title: "Famous Song (Instrumental Version)", artist: "Artist" }
  ];
  for (const candidate of rejected) {
    const validation = validateRewindOriginalRecording(candidate);
    assert.equal(validation.valid, false, `${candidate.title} / ${candidate.artist} should be rejected`);
    assert.ok(validation.alternateRecordingSignals.length > 0);
  }
});

test("Rewind rejects the Beach Boys 1991 Remixes collection scenario", () => {
  const validation = validateRewindOriginalRecording({
    title: "Little Saint Nick",
    artist: "The Beach Boys",
    collectionName: "Christmas with The Beach Boys (1991 Remixes)",
    previewUrl: "https://example.test/little-saint-nick.m4a",
    expectedTitle: "Little Saint Nick",
    expectedArtist: "The Beach Boys",
    requirePreview: true
  });
  assert.equal(validation.valid, false);
  assert.ok(validation.alternateRecordingSignals.includes("remix"));
  assert.match(validation.rejectionReasons.join(" "), /alternate recording marker/i);
});

test("Rewind classifies seasonal songs and applies a bounded holiday cadence", () => {
  assert.equal(isRewindSeasonalHolidaySong("Little Saint Nick"), true);
  assert.equal(isRewindSeasonalHolidaySong("Last Christmas"), true);
  assert.equal(isRewindSeasonalHolidaySong("Dreams", "Rumours"), false);
  assert.equal(REWIND_HOLIDAY_COOLDOWN_DAYS, 7);
  assert.equal(isRewindSeasonalCooldownActive("2026-12-04", "2026-12-09"), true);
  assert.equal(isRewindSeasonalCooldownActive("2026-12-02", "2026-12-09"), false);
  assert.equal(isRewindSeasonalCooldownActive("2026-12-10", "2026-12-09"), false);

  const resolverSource = fs.readFileSync(new URL("../lib/needledropResolver.ts", import.meta.url), "utf8");
  const persistenceSource = fs.readFileSync(new URL("../lib/content/dailyPuzzleResolvers.ts", import.meta.url), "utf8");
  assert.match(resolverSource, /needledrop", "seasonal-soft"/);
  assert.match(resolverSource, /seasonalCooldownRejectionCount/);
  assert.match(persistenceSource, /needledrop:seasonal-soft:/);
});

test("Rewind never substitutes a provider catalog date for an original release year", () => {
  const reissueOnly = resolveRewindOriginalReleaseProvenance({ providerReleaseDate: "1991-11-19T12:00:00Z" });
  assert.equal(reissueOnly.year, null);
  assert.match(reissueOnly.status, /original release year unavailable/i);
  assert.match(reissueOnly.status, /provider catalog date.*not used as substitutes/i);

  const sourcedOriginal = resolveRewindOriginalReleaseProvenance({
    originalReleaseYear: 1963,
    originalReleaseYearSource: "recording-level release registry",
    providerReleaseDate: "1991-11-19T12:00:00Z"
  });
  assert.equal(sourcedOriginal.year, 1963);
  assert.equal(sourcedOriginal.source, "recording-level release registry");
  assert.match(sourcedOriginal.status, /1963/);
});

test("recording validation checks provider identity without rejecting legitimate titles or artist names", () => {
  assert.equal(validateRewindOriginalRecording({ title: "Cover Me Up", artist: "Jason Isbell" }).valid, true);
  assert.equal(validateRewindOriginalRecording({ title: "Lightning Crashes", artist: "Live" }).valid, true);
  const original = validateRewindOriginalRecording({
    title: "Dreams",
    artist: "Fleetwood Mac",
    collectionName: "Rumours",
    previewUrl: "https://example.test/original.m4a",
    expectedTitle: "Dreams",
    expectedArtist: "Fleetwood Mac",
    requirePreview: true
  });
  const mismatch = validateRewindOriginalRecording({
    title: "Dreams",
    artist: "A Tribute to Fleetwood Mac",
    previewUrl: "https://example.test/tribute.m4a",
    expectedTitle: "Dreams",
    expectedArtist: "Fleetwood Mac",
    requirePreview: true
  });
  assert.equal(original.valid, true);
  assert.equal(original.confidence, 1);
  assert.equal(mismatch.valid, false);
});

test("Rewind inventory aggregation collapses aliases and preserves count invariants", () => {
  const metrics = aggregateRewindInventoryMetrics({
    discoveryProviderResponsesExamined: 7,
    previewProviderResponsesExamined: 2,
    discoveredTrackKeys: ["a", "a", "b", "c", "d"],
    metadataValidTrackKeys: ["a", "b", "c"],
    qualityApprovedTrackKeys: ["a"],
    previewPlayableTrackKeys: ["a", "b", "a"],
    previouslyUsedTrackKeys: ["d"],
    unusedEligibleTrackKeys: ["a"],
    rejectedProviderResponses: 3,
    duplicateAliasesCollapsed: 3
  });
  assert.deepEqual(metrics, {
    discoveredUniqueTracks: 4,
    providerResponsesExamined: 9,
    metadataValidUniqueTracks: 3,
    qualityApprovedUniqueTracks: 1,
    previewPlayableUniqueTracks: 2,
    previouslyUsedUniqueTracks: 1,
    unusedEligibleUniqueTracks: 1,
    rejectedProviderResponses: 3,
    duplicateAliasesCollapsed: 3
  });
  assert.equal(assertRewindInventoryMetricInvariants(metrics), metrics);
});

test("Rewind metric assertions reject impossible inventory counts", () => {
  assert.throws(() => assertRewindInventoryMetricInvariants({
    discoveredUniqueTracks: 5,
    providerResponsesExamined: 5,
    metadataValidUniqueTracks: 4,
    qualityApprovedUniqueTracks: 4,
    previewPlayableUniqueTracks: 6,
    previouslyUsedUniqueTracks: 0,
    unusedEligibleUniqueTracks: 6,
    rejectedProviderResponses: 0,
    duplicateAliasesCollapsed: 0
  }), /preview-playable exceeds metadata-valid/i);
  assert.throws(() => aggregateRewindInventoryMetrics({
    discoveryProviderResponsesExamined: 2,
    discoveredTrackKeys: ["a"],
    metadataValidTrackKeys: ["missing"],
    qualityApprovedTrackKeys: [],
    previewPlayableTrackKeys: [],
    previouslyUsedTrackKeys: [],
    unusedEligibleTrackKeys: [],
    rejectedProviderResponses: 0
  }), /outside its parent set/i);
});

test("Rewind tier distribution reports every tier with coherent totals", () => {
  const items = [
    scoreRewindRecognizability({ chartPosition: 1, chartAppearances: 5, artistDistinctHits: 5, chartYear: 1980, currentYear: 2026 }),
    scoreRewindRecognizability({ chartPosition: 3, chartYear: 2000, currentYear: 2026 }),
    scoreRewindRecognizability({ chartPosition: 35, chartYear: 2000, currentYear: 2026 }),
    scoreRewindRecognizability({ chartPosition: 99, chartYear: 2025, currentYear: 2026 })
  ].map((recognizability) => ({ recognizability }));
  const distribution = summarizeRewindRecognizabilityTiers(items);
  assert.equal(Object.values(distribution).reduce((sum, value) => sum + value, 0), items.length);
  assert.equal(distribution.iconic, 1);
  assert.equal(distribution.mainstream, 1);
  assert.equal(distribution.challenging, 1);
  assert.equal(distribution.reject, 1);
});

test("Rewind admin surfaces the historical anchor and recognizability evidence", () => {
  const source = fs.readFileSync(new URL("../components/admin/AdminNeedleDropPreview.tsx", import.meta.url), "utf8");
  for (const label of [
    "Target historical month/day",
    "Historical year selected",
    "Requested historical chart date",
    "Resolved Billboard issue date",
    "Issue date delta",
    "Fallback window used",
    "Recognizability score",
    "Recognizability tier",
    "Chart appearance year",
    "Original release year",
    "Provider catalog date, not original release",
    "Recording match confidence",
    "Version rejection reason",
    "Holiday cooldown",
    "Why eligible"
  ]) assert.match(source, new RegExp(label));
  assert.match(source, /Not recorded on legacy cached puzzle/);
  assert.match(source, /Legacy cached puzzle predates the Rewind quality-evidence diagnostics/);
});

test("Rewind player copy separates chart appearance from original release provenance", () => {
  const source = fs.readFileSync(new URL("../components/GameShell.tsx", import.meta.url), "utf8");
  assert.match(source, /Appeared on the Billboard Hot 100 during this week in/);
  assert.match(source, /Original release year unavailable/);
  assert.doesNotMatch(source, /track was .*years ago/);
});

test("Rewind health treats provider validation counts as an informational bounded snapshot", () => {
  const healthSource = fs.readFileSync(new URL("../lib/content/inventoryHealth.ts", import.meta.url), "utf8");
  const dashboardSource = fs.readFileSync(new URL("../components/admin/AdminDashboard.tsx", import.meta.url), "utf8");
  assert.match(healthSource, /not the full reusable Rewind inventory/);
  assert.match(healthSource, /healthOverride: "Bounded snapshot \(informational\)"/);
  assert.match(dashboardSource, /Selected-date inventory sample/);
});

test("Rewind holiday cooldown uses dated history and atomic window reservations", () => {
  const resolver = fs.readFileSync(new URL("../lib/needledropResolver.ts", import.meta.url), "utf8");
  const dailyResolver = fs.readFileSync(new URL("../lib/content/dailyPuzzleResolvers.ts", import.meta.url), "utf8");
  assert.match(resolver, /buildCooldownWindowKeys\(seasonalCooldownKey, puzzleDate, REWIND_HOLIDAY_COOLDOWN_DAYS\)/);
  assert.match(dailyResolver, /datedCooldownKey\(seasonalBaseKey, date\)/);
  assert.match(dailyResolver, /conditionalAbsentUsedContentKeys: seasonalReservationChecks/);
});
