import landmarkData from "@/data/generated/landmarks.json";

export type Landmark = {
  id: string;
  name: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  imageUrl: string;
  imageAlt: string;
  sourceNote: string;
  imageValidation: string;
  continent: string;
  category: string;
  aliases: string[];
  imageFile: string;
  attribution: string;
  license: string;
  mimeType: string;
  width: number;
  height: number;
  validationVersion: string;
};

type GeneratedLandmark = Omit<Landmark, "aliases" | "imageValidation">;

export const LANDMARKS: Landmark[] = (landmarkData as GeneratedLandmark[]).map((landmark) => ({
  ...landmark,
  aliases: [landmark.name],
  imageValidation: `Verified Wikimedia Commons ${landmark.mimeType} photograph (${landmark.width}x${landmark.height}); ${landmark.license}; validation ${landmark.validationVersion}.`
}));
