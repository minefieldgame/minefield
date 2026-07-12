import "server-only";

import { LANDMARKS, type Landmark } from "@/data/landmarks";
import { getPersistedCandidateInventory, savePersistedCandidates, type PersistedCandidate } from "@/lib/content/persistence";
import { hashString, seededShuffle } from "@/lib/dailySeed";
import { normalizeUsedContentText } from "@/lib/content/usedContentRegistry";
import { evaluateLandmarkQuality, isLandmarkEligible } from "@/lib/content/landmarkQuality";

const continents = ["Q15", "Q48", "Q46", "Q49", "Q18", "Q55643"];

function point(value: string) {
  const match = /^Point\(([-\d.]+) ([-\d.]+)\)$/.exec(value);
  return match ? { longitude: Number(match[1]), latitude: Number(match[2]) } : null;
}

function cleanHtml(value = "") {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export async function getAllLandmarkCandidates() {
  const persisted = await getPersistedCandidateInventory<Landmark>("landmark-drop");
  return [...new Map([
    ...LANDMARKS.map((item) => [item.id, item] as const),
    ...persisted.filter((record) => record.validationStatus === "validated" && isLandmarkEligible(record.payload)).map((record) => [record.payload.id, record.payload] as const)
  ]).values()];
}

export async function replenishLandmarkCandidates(seed: string, target = 100) {
  const continent = continents[hashString(seed) % continents.length];
  const query = `SELECT DISTINCT ?item ?itemLabel ?image ?coord ?countryLabel ?continentLabel ?locationLabel ?classLabel ?sitelinks WHERE {
    ?item wdt:P31/wdt:P279* wd:Q570116; wdt:P18 ?image; wdt:P625 ?coord; wdt:P17 ?country; wdt:P31 ?class; wikibase:sitelinks ?sitelinks.
    ?country wdt:P30 ?continent. FILTER(?continent = wd:${continent})
    OPTIONAL { ?item wdt:P131 ?location. }
    FILTER(?sitelinks >= 8)
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  } ORDER BY DESC(?sitelinks) LIMIT ${Math.max(150, target * 2)}`;
  const response = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`, { headers: { Accept: "application/sparql-results+json", "User-Agent": "MinefieldDaily/2.0 (content inventory maintainer)" }, cache: "no-store" });
  if (!response.ok) throw new Error(`Wikidata landmark provider returned ${response.status}.`);
  const payload = await response.json() as { results?: { bindings?: Array<Record<string, { value: string }>> } };
  const existing = await getAllLandmarkCandidates();
  const usedIds = new Set(existing.map((item) => item.id));
  const usedNames = new Set(existing.map((item) => normalizeUsedContentText(item.name)));
  const usedFiles = new Set(existing.map((item) => item.imageFile.toLowerCase()));
  const usedCoordinates = new Set(existing.map((item) => `${item.latitude.toFixed(5)},${item.longitude.toFixed(5)}`));
  const raw = seededShuffle(payload.results?.bindings ?? [], hashString(`${seed}:wikidata`)).flatMap((row) => {
    const coordinates = point(row.coord?.value ?? "");
    const id = row.item?.value?.split("/").pop() ?? "";
    const name = row.itemLabel?.value ?? "";
    const imageFile = decodeURIComponent((row.image?.value ?? "").split("/Special:FilePath/")[1] ?? "").replace(/_/g, " ");
    const coordinateKey = coordinates ? `${coordinates.latitude.toFixed(5)},${coordinates.longitude.toFixed(5)}` : "";
    if (!coordinates || !id || !name || !imageFile || /\.(svg|pdf|djvu)$/i.test(imageFile) || usedIds.has(id) || usedNames.has(normalizeUsedContentText(name)) || usedFiles.has(imageFile.toLowerCase()) || usedCoordinates.has(coordinateKey)) return [];
    return [{ row, coordinates, id, name, imageFile }];
  });
  const records: Array<PersistedCandidate<Landmark>> = [];
  let eligibleCount = 0;
  for (let index = 0; index < raw.length && eligibleCount < target; index += 50) {
    const batch = raw.slice(index, index + 50);
    const params = new URLSearchParams({ action: "query", format: "json", formatversion: "2", titles: batch.map((item) => `File:${item.imageFile}`).join("|"), prop: "imageinfo", iiprop: "url|mime|size|extmetadata" });
    const commonsResponse = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, { headers: { "User-Agent": "MinefieldDaily/2.0" }, cache: "no-store" });
    if (!commonsResponse.ok) continue;
    const commons = await commonsResponse.json() as { query?: { pages?: Array<{ title?: string; imageinfo?: Array<{ mime?: string; width?: number; height?: number; extmetadata?: Record<string, { value?: string }> }> }> } };
    const infoByFile = new Map((commons.query?.pages ?? []).map((page) => [page.title?.replace(/^File:/, ""), page.imageinfo?.[0]]));
    for (const item of batch) {
      const info = infoByFile.get(item.imageFile);
      if (!info?.mime?.startsWith("image/") || info.mime === "image/svg+xml" || (info.width ?? 0) < 640 || (info.height ?? 0) < 480) continue;
      const ext = info.extmetadata ?? {};
      const now = new Date().toISOString();
      const base = {
        id: item.id, name: item.name,
        city: item.row.locationLabel?.value ?? item.row.countryLabel?.value ?? "Unknown region",
        country: item.row.countryLabel?.value ?? "Unknown country",
        continent: item.row.continentLabel?.value ?? "Other",
        category: item.row.classLabel?.value ?? "tourist attraction",
        latitude: item.coordinates.latitude, longitude: item.coordinates.longitude,
        imageFile: item.imageFile,
        imageUrl: `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(item.imageFile)}?width=1200`,
        imageAlt: `${item.name} in ${item.row.locationLabel?.value ?? item.row.countryLabel?.value ?? "its region"}`,
        sourceNote: `${item.row.item?.value}; https://commons.wikimedia.org/wiki/File:${encodeURIComponent(item.imageFile.replace(/ /g, "_"))}`,
        attribution: cleanHtml(ext.Artist?.value ?? "Wikimedia Commons contributor").slice(0, 240),
        license: ext.LicenseShortName?.value ?? ext.UsageTerms?.value ?? "See Commons file page",
        mimeType: info.mime, width: info.width ?? 0, height: info.height ?? 0,
        aliases: [item.name], validationVersion: "postcard-v4",
        sitelinks: Number(item.row.sitelinks?.value ?? 0),
        region: item.row.continentLabel?.value ?? "Other",
        imageValidation: `Verified Commons ${info.mime} photograph (${info.width}x${info.height}).`
      };
      const quality = evaluateLandmarkQuality(base);
      const landmark: Landmark = { ...base, ...quality };
      if (quality.eligibilityStatus === "eligible") eligibleCount += 1;
      records.push({
        gameId: "landmark-drop",
        candidateId: landmark.id,
        normalizedContentKeys: [normalizeUsedContentText(landmark.name), landmark.imageFile.toLowerCase(), `${landmark.latitude.toFixed(5)},${landmark.longitude.toFixed(5)}`],
        payload: landmark,
        validationStatus: quality.eligibilityStatus === "eligible" ? "validated" : "invalid",
        validationVersion: "postcard-v4",
        sourceMetadata: { provider: "Wikidata + Wikimedia Commons", qualityEvaluation: quality.qualityEvaluation },
        createdAt: now,
        lastValidatedAt: now,
        invalidReason: quality.exclusionReason || undefined,
        qualityScore: quality.qualityEvaluation.overallScore / 100,
        difficulty: quality.qualityEvaluation.difficulty,
        category: landmark.category
      });
      if (eligibleCount >= target) break;
    }
  }
  const saved = await savePersistedCandidates("landmark-drop", records);
  return {
    discovered: raw.length,
    generated: raw.length,
    technicallyValidated: records.length,
    qualityReviewed: records.length,
    fullyEligible: eligibleCount,
    validated: eligibleCount,
    rejected: records.filter((record) => record.validationStatus === "invalid").length + Math.max(0, raw.length - records.length),
    pendingExternalProviderData: 0,
    providerUnavailable: false,
    apiCalls: 2 + Math.ceil(raw.length / 50),
    ...saved
  };
}
