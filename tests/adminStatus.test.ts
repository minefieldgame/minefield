import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  buildAdminStatusSummary,
  classifyAdminFailure,
  classifySelectedDateStatus
} from "../lib/content/adminStatus";
import { buildDailyBoardSeedManifest } from "../lib/dailySeed";

test("admin inventory health and selected-date status stay independent", () => {
  const summary = buildAdminStatusSummary({
    inventoryHealthStatus: "Healthy",
    ready: false,
    error: "iTunes preview provider unavailable"
  });
  assert.equal(summary.healthStatus, "Healthy");
  assert.equal(summary.inventoryHealthStatus, "Healthy");
  assert.equal(summary.selectedDateStatus, "Provider unavailable");
  assert.equal(summary.finalStatus, "Provider unavailable");
  assert.match(summary.actionableFailureReason, /iTunes/);
});

test("admin selected-date status distinguishes generated and cached puzzles", () => {
  assert.equal(classifySelectedDateStatus({ ready: true }), "Generated");
  assert.equal(classifySelectedDateStatus({ ready: true, cacheHit: true }), "Cached");
});

test("admin failure labels distinguish provider, infrastructure, and puzzle failures", () => {
  assert.equal(classifyAdminFailure("Billboard chart provider returned no preview"), "Provider unavailable");
  assert.equal(classifyAdminFailure("DynamoDB transaction rejected credentials"), "Infrastructure failure");
  assert.equal(classifyAdminFailure("Candidate pool exhausted after bounded retries"), "Failed");
});

test("failed daily-board rows never expose a hash or a passed duplicate check", () => {
  const manifest = buildDailyBoardSeedManifest(
    "2026-12-12",
    ["odd-one-out"],
    { "odd-one-out": "must-not-leak" },
    {},
    {},
    { "odd-one-out": "Failed" }
  );
  const [row] = manifest.games;
  assert.equal(row.puzzleHash, "");
  assert.equal(row.duplicateCheck.passed, false);
  assert.equal(row.duplicateCheck.duplicateDetected, false);
});

test("admin inventory and selected-date counts label their different scopes", () => {
  const dashboard = fs.readFileSync(new URL("../components/admin/AdminDashboard.tsx", import.meta.url), "utf8");
  const oddPreview = fs.readFileSync(new URL("../components/admin/AdminOddOneOutPreview.tsx", import.meta.url), "utf8");
  const geographyPreview = fs.readFileSync(new URL("../components/admin/AdminGeographyPreviews.tsx", import.meta.url), "utf8");
  const metrics = fs.readFileSync(new URL("../lib/content/inventoryMetrics.ts", import.meta.url), "utf8");

  assert.match(dashboard, /Metric scope:/);
  assert.match(metrics, /Unused eligible \(metric scope\)/);
  assert.match(oddPreview, /Unused eligible \(inventory-wide\)/);
  assert.match(geographyPreview, /Scope: this selected-date selection request/);
  assert.match(geographyPreview, /Remaining at selected-date stage/);
});
