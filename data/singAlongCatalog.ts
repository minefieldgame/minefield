import type { SingAlongTimingProviderResult } from "@/lib/content/singAlongTimingProvider";

export type SingAlongEligibilityState =
  | "discovered"
  | "preview-playable"
  | "provider-timed"
  | "timing-validated"
  | "playable"
  | "duplicate-blocked"
  | "pending-provider-data"
  | "invalid"
  | "archive-only";

export type SingAlongCatalogEntry = {
  title: string;
  artist: string;
  chartYear: number;
  chartDate: string;
  chartPosition: number;
  playbackStart: number;
  playbackStop: number;
  chorusTimestamp: number;
  cueDescription: string;
  setupLyricExcerpt: string;
  answerLyricExcerpt: string;
  answerLyricStartTimeSeconds: number;
  clipStartTimeSeconds: number;
  clipEndTimeSeconds: number;
  acceptedLyric: string;
  alternateAcceptedLyrics: string[];
  correctChoiceId: "a" | "b" | "c" | "d";
  choices: Array<{ id: "a" | "b" | "c" | "d"; text: string; isCorrect: boolean }>;
  sourceNote: string;
  eligibilityState?: SingAlongEligibilityState;
  providerResult?: SingAlongTimingProviderResult;
  rejectionReasons?: string[];
};

export const SING_ALONG_CATALOG: SingAlongCatalogEntry[] = [
  {
    title: "Sweet Caroline",
    eligibilityState: "archive-only",
    artist: "Neil Diamond",
    chartYear: 1969,
    chartDate: "1969-08-16",
    chartPosition: 4,
    playbackStart: 8,
    playbackStop: 15,
    chorusTimestamp: 16.5,
    setupLyricExcerpt: "lead-in before title hook",
    answerLyricExcerpt: "Sweet Caroline",
    answerLyricStartTimeSeconds: 16.5,
    clipStartTimeSeconds: 6,
    clipEndTimeSeconds: 16,
    cueDescription: "Clip ends just before the famous title hook.",
    acceptedLyric: "Sweet Caroline",
    alternateAcceptedLyrics: ["Sweet Caroline"],
    correctChoiceId: "a",
    choices: [
      { id: "a", text: "Sweet Caroline", isCorrect: true },
      { id: "b", text: "Good times never seemed so good", isCorrect: false },
      { id: "c", text: "Touching me", isCorrect: false },
      { id: "d", text: "I will survive", isCorrect: false }
    ],
    sourceNote: "Billboard Hot 100 chart metadata; chorus cue manually curated."
  },
  {
    title: "Hey Jude",
    eligibilityState: "archive-only",
    artist: "The Beatles",
    chartYear: 1968,
    chartDate: "1968-09-28",
    chartPosition: 1,
    playbackStart: 6,
    playbackStop: 13,
    chorusTimestamp: 14.5,
    setupLyricExcerpt: "lead-in before title phrase",
    answerLyricExcerpt: "Hey Jude",
    answerLyricStartTimeSeconds: 14.5,
    clipStartTimeSeconds: 4,
    clipEndTimeSeconds: 14,
    cueDescription: "Clip ends just before the title phrase.",
    acceptedLyric: "Hey Jude",
    alternateAcceptedLyrics: ["Hey Jude"],
    correctChoiceId: "b",
    choices: [
      { id: "a", text: "Take a sad song", isCorrect: false },
      { id: "b", text: "Hey Jude", isCorrect: true },
      { id: "c", text: "Let it be", isCorrect: false },
      { id: "d", text: "Don't make it bad", isCorrect: false }
    ],
    sourceNote: "Billboard Hot 100 chart metadata; chorus cue manually curated."
  },
  {
    title: "Billie Jean",
    eligibilityState: "archive-only",
    artist: "Michael Jackson",
    chartYear: 1983,
    chartDate: "1983-03-05",
    chartPosition: 1,
    playbackStart: 7,
    playbackStop: 14,
    chorusTimestamp: 15.5,
    setupLyricExcerpt: "lead-in before iconic name in hook",
    answerLyricExcerpt: "Billie Jean",
    answerLyricStartTimeSeconds: 15.5,
    clipStartTimeSeconds: 5,
    clipEndTimeSeconds: 15,
    cueDescription: "Clip ends just before the iconic name in the hook.",
    acceptedLyric: "Billie Jean",
    alternateAcceptedLyrics: ["Billie Jean"],
    correctChoiceId: "c",
    choices: [
      { id: "a", text: "Beat it", isCorrect: false },
      { id: "b", text: "The kid is not my son", isCorrect: false },
      { id: "c", text: "Billie Jean", isCorrect: true },
      { id: "d", text: "Thriller night", isCorrect: false }
    ],
    sourceNote: "Billboard Hot 100 chart metadata; chorus cue manually curated."
  },
  {
    title: "Stayin' Alive",
    eligibilityState: "archive-only",
    artist: "Bee Gees",
    chartYear: 1978,
    chartDate: "1978-02-04",
    chartPosition: 1,
    playbackStart: 8,
    playbackStop: 15,
    chorusTimestamp: 16.5,
    setupLyricExcerpt: "lead-in before title hook",
    answerLyricExcerpt: "Stayin' alive",
    answerLyricStartTimeSeconds: 16.5,
    clipStartTimeSeconds: 6,
    clipEndTimeSeconds: 16,
    cueDescription: "Clip ends just before the title hook.",
    acceptedLyric: "Stayin alive",
    alternateAcceptedLyrics: ["Staying alive", "Stayin' alive"],
    correctChoiceId: "d",
    choices: [
      { id: "a", text: "Night fever", isCorrect: false },
      { id: "b", text: "More than a woman", isCorrect: false },
      { id: "c", text: "You should be dancing", isCorrect: false },
      { id: "d", text: "Stayin' alive", isCorrect: true }
    ],
    sourceNote: "Billboard Hot 100 chart metadata; chorus cue manually curated."
  },
  {
    title: "I Will Survive",
    eligibilityState: "archive-only",
    artist: "Gloria Gaynor",
    chartYear: 1979,
    chartDate: "1979-03-10",
    chartPosition: 1,
    playbackStart: 8,
    playbackStop: 15,
    chorusTimestamp: 16.5,
    setupLyricExcerpt: "lead-in before survival hook",
    answerLyricExcerpt: "I will survive",
    answerLyricStartTimeSeconds: 16.5,
    clipStartTimeSeconds: 6,
    clipEndTimeSeconds: 16,
    cueDescription: "Clip ends just before the survival hook.",
    acceptedLyric: "I will survive",
    alternateAcceptedLyrics: ["I'll survive", "I will survive"],
    correctChoiceId: "a",
    choices: [
      { id: "a", text: "I will survive", isCorrect: true },
      { id: "b", text: "At first I was afraid", isCorrect: false },
      { id: "c", text: "I should have changed that lock", isCorrect: false },
      { id: "d", text: "We are family", isCorrect: false }
    ],
    sourceNote: "Billboard Hot 100 chart metadata; chorus cue manually curated."
  },
  {
    title: "Call Me Maybe",
    eligibilityState: "archive-only",
    artist: "Carly Rae Jepsen",
    chartYear: 2012,
    chartDate: "2012-06-23",
    chartPosition: 1,
    playbackStart: 7,
    playbackStop: 14,
    chorusTimestamp: 15.5,
    setupLyricExcerpt: "lead-in before title phrase",
    answerLyricExcerpt: "Call me maybe",
    answerLyricStartTimeSeconds: 15.5,
    clipStartTimeSeconds: 5,
    clipEndTimeSeconds: 15,
    cueDescription: "Clip ends just before the title phrase lands.",
    acceptedLyric: "Call me maybe",
    alternateAcceptedLyrics: ["Call me maybe"],
    correctChoiceId: "b",
    choices: [
      { id: "a", text: "Here's my number", isCorrect: false },
      { id: "b", text: "Call me maybe", isCorrect: true },
      { id: "c", text: "Before you came into my life", isCorrect: false },
      { id: "d", text: "Shake it off", isCorrect: false }
    ],
    sourceNote: "Billboard Hot 100 chart metadata; chorus cue manually curated."
  }
];
