import assert from "node:assert/strict";
import test from "node:test";
import { chartIssueDeltaDays, historicalChartAnchorDate, isChartIssueAnchoredToDate } from "../lib/chartProvider";
import {
  aggregateRewindInventoryMetrics,
  assertRewindInventoryMetricInvariants,
  orderRewindCandidatesByRecognizability,
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
