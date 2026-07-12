export type QualityDifficulty = "approachable" | "standard" | "challenging";

export type QualityEvaluation = {
  factualConfidence: number;
  recognizability: number;
  clarity: number;
  fairness: number;
  entertainmentValue: number;
  difficulty: QualityDifficulty;
  sourceQuality: number;
  mediaQuality?: number;
  overallScore: number;
  finalEligibility: boolean;
  rejectionReasons: string[];
  evaluationMethod: "deterministic" | "source-backed" | "cached-model-assisted";
  evaluationVersion: string;
};

function bounded(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function buildQualityEvaluation({
  factualConfidence,
  recognizability,
  clarity,
  fairness,
  entertainmentValue,
  difficulty,
  sourceQuality,
  mediaQuality,
  rejectionReasons = [],
  minimumScore = 60,
  evaluationMethod = "deterministic",
  evaluationVersion = "quality-v1"
}: Omit<QualityEvaluation, "overallScore" | "finalEligibility"> & { minimumScore?: number }): QualityEvaluation {
  const scores = [factualConfidence, recognizability, clarity, fairness, entertainmentValue, sourceQuality];
  if (typeof mediaQuality === "number") scores.push(mediaQuality);
  const overallScore = bounded(scores.reduce((total, score) => total + bounded(score), 0) / scores.length);
  const normalizedRejections = [...new Set(rejectionReasons.map((reason) => reason.trim()).filter(Boolean))];
  return {
    factualConfidence: bounded(factualConfidence),
    recognizability: bounded(recognizability),
    clarity: bounded(clarity),
    fairness: bounded(fairness),
    entertainmentValue: bounded(entertainmentValue),
    difficulty,
    sourceQuality: bounded(sourceQuality),
    ...(typeof mediaQuality === "number" ? { mediaQuality: bounded(mediaQuality) } : {}),
    overallScore,
    finalEligibility: normalizedRejections.length === 0 && overallScore >= minimumScore,
    rejectionReasons: normalizedRejections,
    evaluationMethod,
    evaluationVersion
  };
}

export function assertQualityEvaluation(evaluation: QualityEvaluation) {
  const scores = [
    evaluation.factualConfidence,
    evaluation.recognizability,
    evaluation.clarity,
    evaluation.fairness,
    evaluation.entertainmentValue,
    evaluation.sourceQuality,
    evaluation.overallScore,
    ...(typeof evaluation.mediaQuality === "number" ? [evaluation.mediaQuality] : [])
  ];
  return scores.every((score) => Number.isFinite(score) && score >= 0 && score <= 100) &&
    (!evaluation.finalEligibility || evaluation.rejectionReasons.length === 0);
}
