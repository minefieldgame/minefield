export type SingAlongCatalogEntry = {
  title: string;
  artist: string;
  chartYear: number;
  chartDate: string;
  chartPosition: number;
  playbackStart: number;
  playbackStop: number;
  chorusTimestamp: number;
  acceptedLyric: string;
  alternateAcceptedLyrics: string[];
  sourceNote: string;
};

export const SING_ALONG_CATALOG: SingAlongCatalogEntry[] = [
  {
    title: "Sweet Caroline",
    artist: "Neil Diamond",
    chartYear: 1969,
    chartDate: "1969-08-16",
    chartPosition: 4,
    playbackStart: 8,
    playbackStop: 15,
    chorusTimestamp: 16.5,
    acceptedLyric: "Sweet Caroline",
    alternateAcceptedLyrics: ["Sweet Caroline"],
    sourceNote: "Billboard Hot 100 chart metadata; chorus cue manually curated."
  },
  {
    title: "Hey Jude",
    artist: "The Beatles",
    chartYear: 1968,
    chartDate: "1968-09-28",
    chartPosition: 1,
    playbackStart: 6,
    playbackStop: 13,
    chorusTimestamp: 14.5,
    acceptedLyric: "Hey Jude",
    alternateAcceptedLyrics: ["Hey Jude"],
    sourceNote: "Billboard Hot 100 chart metadata; chorus cue manually curated."
  },
  {
    title: "Billie Jean",
    artist: "Michael Jackson",
    chartYear: 1983,
    chartDate: "1983-03-05",
    chartPosition: 1,
    playbackStart: 7,
    playbackStop: 14,
    chorusTimestamp: 15.5,
    acceptedLyric: "Billie Jean",
    alternateAcceptedLyrics: ["Billie Jean"],
    sourceNote: "Billboard Hot 100 chart metadata; chorus cue manually curated."
  },
  {
    title: "Stayin' Alive",
    artist: "Bee Gees",
    chartYear: 1978,
    chartDate: "1978-02-04",
    chartPosition: 1,
    playbackStart: 8,
    playbackStop: 15,
    chorusTimestamp: 16.5,
    acceptedLyric: "Stayin alive",
    alternateAcceptedLyrics: ["Staying alive", "Stayin' alive"],
    sourceNote: "Billboard Hot 100 chart metadata; chorus cue manually curated."
  },
  {
    title: "I Will Survive",
    artist: "Gloria Gaynor",
    chartYear: 1979,
    chartDate: "1979-03-10",
    chartPosition: 1,
    playbackStart: 8,
    playbackStop: 15,
    chorusTimestamp: 16.5,
    acceptedLyric: "I will survive",
    alternateAcceptedLyrics: ["I'll survive", "I will survive"],
    sourceNote: "Billboard Hot 100 chart metadata; chorus cue manually curated."
  },
  {
    title: "Call Me Maybe",
    artist: "Carly Rae Jepsen",
    chartYear: 2012,
    chartDate: "2012-06-23",
    chartPosition: 1,
    playbackStart: 7,
    playbackStop: 14,
    chorusTimestamp: 15.5,
    acceptedLyric: "Call me maybe",
    alternateAcceptedLyrics: ["Call me maybe"],
    sourceNote: "Billboard Hot 100 chart metadata; chorus cue manually curated."
  }
];
