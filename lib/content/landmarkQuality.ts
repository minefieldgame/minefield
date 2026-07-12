import type { Landmark } from "@/data/landmarks";
import { buildQualityEvaluation, type QualityEvaluation } from "@/lib/content/quality";

export type LandmarkRecognizabilityTier = "iconic" | "recognizable" | "challenging" | "archive-only";
export type LandmarkEligibilityStatus = "eligible" | "archive-only" | "rejected";
export type LandmarkImageFraming = "subject-dominant" | "subject-in-context" | "incidental-or-unclear";

const EXCLUDED_ENTITY_IDS = new Map<string, string>([
  ["Q656765", "Demolished site; the available historic photograph is not valid for normal current-landmark play."],
  ["Q234364", "The Tuileries Palace was demolished; historical-only sites are archive-only."],
  ["Q202902", "The Crystal Palace was destroyed; historical-only sites are archive-only."]
]);

const historicalOrMisleading = /\b(?:demolished|destroyed|former|ruins? of|lost building|archaeological remains|memorial plaque|empty site)\b/i;
const unsuitableImage = /\b(?:interior|plaque|floor plan|map|rubble|ruins?)\b/i;
const incidentalFilename = /\b(?:botanical garden|garden grounds?|unrelated park|street scene|general cityscape)\b/i;

const iconicNames = /\b(?:eiffel tower|statue of liberty|taj mahal|colosseum|big ben|burj khalifa|golden gate bridge|sydney opera house|christ the redeemer|empire state building|tower bridge|hagia sophia|petronas towers|leaning tower|machu picchu|angkor wat|chich[eé]n itz[aá]|great pyramid of giza|sagrada fam[ií]lia)\b/i;
const iconicStadiumNames = /\b(?:wembley|camp nou|maracan[aã]|madison square garden|rose bowl|yankee stadium|beijing national stadium|melbourne cricket ground|old trafford)\b/i;
const strongCategories = new Set(["bridge", "castle", "mosque", "palace", "skyscraper", "stadium", "statue", "temple", "tower"]);

export type LandmarkQualityResult = {
  eligibilityStatus: LandmarkEligibilityStatus;
  exclusionReason: string;
  recognizabilityTier: LandmarkRecognizabilityTier;
  imageQualityScore: number;
  focalSubjectQuality: number;
  subjectDominance: number;
  imageFraming: LandmarkImageFraming;
  focalSubjectReason: string;
  landmarkPlayabilityScore: number;
  qualityEvaluation: QualityEvaluation;
};

function normalizedWords(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function evaluateFocalSubject(input: Pick<Landmark, "name" | "city" | "country" | "category" | "imageFile">) {
  const fileWords = new Set(normalizedWords(input.imageFile.replace(/\.[a-z0-9]+$/i, "")));
  const locationWords = new Set(normalizedWords(`${input.city} ${input.country}`));
  const subjectWords = normalizedWords(input.name).filter((word) => !locationWords.has(word) && word.length >= 3);
  const matchedSubjectWords = subjectWords.filter((word) => fileWords.has(word));
  const subjectMatchRatio = subjectWords.length ? matchedSubjectWords.length / subjectWords.length : 0;
  const category = input.category.toLowerCase();
  const strongStructure = category === "tower" || category === "stadium" || category === "bridge";
  const categoryMentioned = fileWords.has(category);
  const fullNameMentioned = normalizedWords(input.imageFile).join(" ").includes(normalizedWords(input.name).join(" "));
  const differentNamedSubject = incidentalFilename.test(input.imageFile) && !categoryMentioned && subjectMatchRatio < 0.5;

  const subjectDominance = differentNamedSubject
    ? 25
    : fullNameMentioned
      ? 96
      : categoryMentioned || subjectMatchRatio >= 0.5
        ? strongStructure ? 88 : 84
        : strongStructure ? 76 : 72;
  const focalSubjectQuality = Math.round((subjectDominance * 0.8) + (fullNameMentioned || categoryMentioned ? 18 : 10));
  const imageFraming: LandmarkImageFraming = subjectDominance >= 86
    ? "subject-dominant"
    : subjectDominance >= 68
      ? "subject-in-context"
      : "incidental-or-unclear";
  const focalSubjectReason = differentNamedSubject
    ? "The image filename identifies a different place as the likely focal subject."
    : fullNameMentioned
      ? "The image filename explicitly names the selected landmark."
      : categoryMentioned || subjectMatchRatio >= 0.5
        ? "The image filename contains strong selected-landmark subject evidence."
        : "The image is usable, but the filename supplies only limited focal-subject evidence.";

  return { focalSubjectQuality, subjectDominance, imageFraming, focalSubjectReason, strongStructure, differentNamedSubject };
}

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
  const focal = evaluateFocalSubject(input);
  if (focal.differentNamedSubject) rejectionReasons.push("Image filename indicates that the landmark is incidental rather than the focal subject.");
  if (focal.strongStructure && focal.subjectDominance < 70) rejectionReasons.push("Tower, stadium, and bridge images require strong subject-dominance evidence.");

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
    mediaQuality: Math.round((imageQualityScore * 0.55) + (focal.focalSubjectQuality * 0.45)),
    rejectionReasons,
    minimumScore: 68,
    evaluationMethod: "source-backed",
    evaluationVersion: "postcard-quality-v2"
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
    focalSubjectQuality: focal.focalSubjectQuality,
    subjectDominance: focal.subjectDominance,
    imageFraming: focal.imageFraming,
    focalSubjectReason: focal.focalSubjectReason,
    landmarkPlayabilityScore: Math.round((qualityEvaluation.overallScore * 0.45) + (recognizability * 0.3) + (focal.focalSubjectQuality * 0.25)),
    qualityEvaluation
  };
}

export function isLandmarkEligible(landmark: Pick<Landmark, "eligibilityStatus" | "qualityEvaluation">) {
  return landmark.eligibilityStatus === "eligible" && landmark.qualityEvaluation.finalEligibility;
}
