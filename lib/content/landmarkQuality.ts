import type { Landmark } from "@/data/landmarks";
import { buildQualityEvaluation, type QualityEvaluation } from "@/lib/content/quality";

export type LandmarkRecognizabilityTier = "iconic" | "recognizable" | "challenging" | "archive-only";
export type LandmarkEligibilityStatus = "eligible" | "archive-only" | "rejected";

const EXCLUDED_ENTITY_IDS = new Map<string, string>([
  ["Q656765", "Demolished site; the available historic photograph is not valid for normal current-landmark play."],
  ["Q234364", "The Tuileries Palace was demolished; historical-only sites are archive-only."],
  ["Q202902", "The Crystal Palace was destroyed; historical-only sites are archive-only."]
]);

const historicalOrMisleading = /\b(?:demolished|destroyed|former|ruins? of|lost building|archaeological remains|memorial plaque|empty site)\b/i;
const unsuitableImage = /\b(?:interior|plaque|floor plan|map|rubble|ruins?)\b/i;

const iconicNames = /\b(?:eiffel tower|statue of liberty|taj mahal|colosseum|big ben|burj khalifa|golden gate bridge|sydney opera house|christ the redeemer|empire state building|tower bridge|hagia sophia|petronas towers|leaning tower|machu picchu|angkor wat|chich[eé]n itz[aá]|great pyramid of giza|sagrada fam[ií]lia)\b/i;
const iconicStadiumNames = /\b(?:wembley|camp nou|maracan[aã]|madison square garden|rose bowl|yankee stadium|beijing national stadium|melbourne cricket ground|old trafford)\b/i;
const strongCategories = new Set(["bridge", "castle", "mosque", "palace", "skyscraper", "stadium", "statue", "temple", "tower"]);

export type LandmarkQualityResult = {
  eligibilityStatus: LandmarkEligibilityStatus;
  exclusionReason: string;
  recognizabilityTier: LandmarkRecognizabilityTier;
  imageQualityScore: number;
  landmarkPlayabilityScore: number;
  qualityEvaluation: QualityEvaluation;
};

export function evaluateLandmarkQuality(input: Pick<Landmark,
  "id" | "name" | "city" | "country" | "category" | "imageFile" | "imageUrl" |
  "mimeType" | "width" | "height" | "attribution" | "license"
> & { sitelinks?: number }): LandmarkQualityResult {
  const rejectionReasons: string[] = [];
  const explicitExclusion = EXCLUDED_ENTITY_IDS.get(input.id);
  if (explicitExclusion) rejectionReasons.push(explicitExclusion);
  if (historicalOrMisleading.test(`${input.name} ${input.category}`)) rejectionReasons.push("Historical or substantially nonexistent site is excluded from normal play.");
  if (unsuitableImage.test(input.imageFile)) rejectionReasons.push("Image filename indicates a generic, interior, detail, aerial, construction, or ruins view.");
  if (!input.imageUrl || !input.mimeType.startsWith("image/") || input.mimeType === "image/svg+xml") rejectionReasons.push("A supported raster photograph is required.");
  if (input.width < 640 || input.height < 480) rejectionReasons.push("Photograph resolution is below the normal-play quality gate.");
  if (!input.attribution || !input.license) rejectionReasons.push("Image attribution and license are required.");
  if (!input.city || /unknown/i.test(input.city) || !input.country || /unknown/i.test(input.country)) rejectionReasons.push("Location confidence is insufficient.");

  const sitelinks = Math.max(0, input.sitelinks ?? 0);
  const stadium = input.category.toLowerCase() === "stadium";
  const stadiumHasStrongEvidence = iconicStadiumNames.test(input.name) || sitelinks >= 80;
  const nameIsIconic = iconicNames.test(input.name) || (stadium && stadiumHasStrongEvidence);
  const categorySignal = strongCategories.has(input.category.toLowerCase()) && !stadium ? 8 : 0;
  const recognizability = Math.min(100,
    (nameIsIconic ? 94 : stadium ? 60 : 68) + categorySignal + Math.min(24, Math.log2(Math.max(1, sitelinks)) * 3)
  );
  const imageQualityScore = Math.min(100,
    55 + Math.min(25, Math.log2(Math.max(1, input.width * input.height / 307_200)) * 7) +
    (unsuitableImage.test(input.imageFile) ? -45 : 12)
  );
  const qualityEvaluation = buildQualityEvaluation({
    factualConfidence: input.id.startsWith("Q") ? 95 : 80,
    recognizability,
    clarity: 92,
    fairness: nameIsIconic ? 96 : stadium ? 70 : strongCategories.has(input.category.toLowerCase()) ? 82 : 72,
    entertainmentValue: nameIsIconic ? 96 : stadium ? 68 : strongCategories.has(input.category.toLowerCase()) ? 84 : 74,
    difficulty: nameIsIconic ? "approachable" : recognizability >= 78 ? "standard" : "challenging",
    sourceQuality: 94,
    mediaQuality: imageQualityScore,
    rejectionReasons,
    minimumScore: 68,
    evaluationMethod: "source-backed",
    evaluationVersion: "postcard-quality-v1"
  });
  const recognizabilityTier: LandmarkRecognizabilityTier = rejectionReasons.length
    ? "archive-only"
    : stadium && !stadiumHasStrongEvidence
      ? "challenging"
    : nameIsIconic || recognizability >= 90
      ? "iconic"
      : recognizability >= 76
        ? "recognizable"
        : "challenging";
  return {
    eligibilityStatus: qualityEvaluation.finalEligibility ? "eligible" : rejectionReasons.length ? "archive-only" : "rejected",
    exclusionReason: qualityEvaluation.rejectionReasons.join(" "),
    recognizabilityTier,
    imageQualityScore,
    landmarkPlayabilityScore: Math.round((qualityEvaluation.overallScore * 0.6) + (recognizability * 0.4)),
    qualityEvaluation
  };
}

export function isLandmarkEligible(landmark: Pick<Landmark, "eligibilityStatus" | "qualityEvaluation">) {
  return landmark.eligibilityStatus === "eligible" && landmark.qualityEvaluation.finalEligibility;
}
