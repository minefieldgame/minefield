import type { ChartSong } from "@/types/game";

export const DEV_SAMPLE_CHART: { date: string; songs: ChartSong[] } = {
  date: "1983-06-18",
  songs: [
    { position: 1, title: "Flashdance... What a Feeling", artist: "Irene Cara" },
    { position: 2, title: "Time (Clock of the Heart)", artist: "Culture Club" },
    { position: 3, title: "Let's Dance", artist: "David Bowie" },
    { position: 4, title: "Overkill", artist: "Men at Work" },
    { position: 5, title: "Beat It", artist: "Michael Jackson" }
  ]
};
