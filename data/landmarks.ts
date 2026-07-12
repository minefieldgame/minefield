import landmarkData from "@/data/generated/landmarks.json";
import { evaluateLandmarkQuality, type LandmarkEligibilityStatus, type LandmarkRecognizabilityTier } from "@/lib/content/landmarkQuality";
import type { QualityEvaluation } from "@/lib/content/quality";

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
  sitelinks: number;
  region: string;
  eligibilityStatus: LandmarkEligibilityStatus;
  exclusionReason: string;
  recognizabilityTier: LandmarkRecognizabilityTier;
  imageQualityScore: number;
  landmarkPlayabilityScore: number;
  qualityEvaluation: QualityEvaluation;
};

type GeneratedLandmark = Omit<Landmark,
  "aliases" | "imageValidation" | "sitelinks" | "region" | "eligibilityStatus" |
  "exclusionReason" | "recognizabilityTier" | "imageQualityScore" | "landmarkPlayabilityScore" | "qualityEvaluation"
> & { sitelinks?: number };

const CURATED_QUALITY_REPLACEMENTS: GeneratedLandmark[] = [{
  id: "Q9141",
  name: "Taj Mahal",
  city: "Agra",
  country: "India",
  continent: "Asia",
  category: "tourist attraction",
  latitude: 27.175,
  longitude: 78.04194444444444,
  imageFile: "Taj Mahal (Edited).jpeg",
  imageUrl: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Taj%20Mahal%20(Edited).jpeg?width=1200",
  imageAlt: "The Taj Mahal in Agra, India",
  sourceNote: "https://www.wikidata.org/wiki/Q9141; https://commons.wikimedia.org/wiki/File:Taj_Mahal_(Edited).jpeg",
  attribution: "Yann Forget; edited by Jim Carter",
  license: "CC BY-SA 4.0",
  mimeType: "image/jpeg",
  width: 3840,
  height: 2525,
  sitelinks: 179,
  validationVersion: "postcard-v4"
}, {
  id: "Q676203",
  name: "Machu Picchu",
  city: "Cusco Region",
  country: "Peru",
  continent: "South America",
  category: "archaeological site",
  latitude: -13.163333333333334,
  longitude: -72.54555555555555,
  imageFile: "80 - Machu Picchu - Juin 2009 - edit.jpg",
  imageUrl: "https://commons.wikimedia.org/wiki/Special:Redirect/file/80%20-%20Machu%20Picchu%20-%20Juin%202009%20-%20edit.jpg?width=1200",
  imageAlt: "Machu Picchu in Peru",
  sourceNote: "https://www.wikidata.org/wiki/Q676203; https://commons.wikimedia.org/wiki/File:80_-_Machu_Picchu_-_Juin_2009_-_edit.jpg",
  attribution: "Martin St-Amant",
  license: "CC BY-SA 3.0",
  mimeType: "image/jpeg",
  width: 10000,
  height: 9760,
  sitelinks: 147,
  validationVersion: "postcard-v4"
}, {
  id: "Q43473",
  name: "Angkor Wat",
  city: "Siem Reap",
  country: "Cambodia",
  continent: "Asia",
  category: "temple",
  latitude: 13.4125,
  longitude: 103.86666666667,
  imageFile: "Angkor Wat.jpg",
  imageUrl: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Angkor%20Wat.jpg?width=1200",
  imageAlt: "Angkor Wat in Cambodia",
  sourceNote: "https://www.wikidata.org/wiki/Q43473; https://commons.wikimedia.org/wiki/File:Angkor_Wat.jpg",
  attribution: "Bjørn Christian Tørrissen",
  license: "CC BY-SA 4.0",
  mimeType: "image/jpeg",
  width: 2004,
  height: 1362,
  sitelinks: 136,
  validationVersion: "postcard-v4"
}, {
  id: "Q39054",
  name: "Leaning Tower of Pisa",
  city: "Pisa",
  country: "Italy",
  continent: "Europe",
  category: "tower",
  latitude: 43.72301,
  longitude: 10.396624,
  imageFile: "Campanile Dôme - Pise (IT52) - 2022-08-31 - 20.jpg",
  imageUrl: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Campanile%20D%C3%B4me%20-%20Pise%20(IT52)%20-%202022-08-31%20-%2020.jpg?width=1200",
  imageAlt: "The Leaning Tower of Pisa in Italy",
  sourceNote: "https://www.wikidata.org/wiki/Q39054; https://commons.wikimedia.org/wiki/File:Campanile_D%C3%B4me_-_Pise_(IT52)_-_2022-08-31_-_20.jpg",
  attribution: "Chabe01",
  license: "CC BY-SA 4.0",
  mimeType: "image/jpeg",
  width: 2601,
  height: 5767,
  sitelinks: 116,
  validationVersion: "postcard-v4"
}, {
  id: "Q83497",
  name: "Mount Rushmore",
  city: "Keystone",
  country: "United States",
  continent: "North America",
  category: "statue",
  latitude: 43.87888888888889,
  longitude: -103.45916666666666,
  imageFile: "Mount Rushmore detail view (100MP).jpg",
  imageUrl: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Mount%20Rushmore%20detail%20view%20(100MP).jpg?width=1200",
  imageAlt: "Mount Rushmore in South Dakota",
  sourceNote: "https://www.wikidata.org/wiki/Q83497; https://commons.wikimedia.org/wiki/File:Mount_Rushmore_detail_view_(100MP).jpg",
  attribution: "Thomas Wolf, www.foto-tw.de",
  license: "CC BY-SA 3.0",
  mimeType: "image/jpeg",
  width: 12128,
  height: 8246,
  sitelinks: 95,
  validationVersion: "postcard-v4"
}, {
  id: "Q5859",
  name: "Chichén Itzá",
  city: "Yucatán",
  country: "Mexico",
  continent: "North America",
  category: "archaeological site",
  latitude: 20.683055555555555,
  longitude: -88.56861111111111,
  imageFile: "El Castillo, Chichén Itzá.jpg",
  imageUrl: "https://commons.wikimedia.org/wiki/Special:Redirect/file/El%20Castillo%2C%20Chich%C3%A9n%20Itz%C3%A1.jpg?width=1200",
  imageAlt: "El Castillo at Chichén Itzá in Yucatán, Mexico",
  sourceNote: "https://www.wikidata.org/wiki/Q5859; https://commons.wikimedia.org/wiki/File:El_Castillo,_Chich%C3%A9n_Itz%C3%A1.jpg",
  attribution: "Jaakko Sakari Reinikainen (Ulayiti)",
  license: "CC BY-SA 3.0",
  mimeType: "image/jpeg",
  width: 1024,
  height: 768,
  sitelinks: 130,
  validationVersion: "postcard-v4"
}, {
  id: "Q37200",
  name: "Great Pyramid of Giza",
  city: "Giza",
  country: "Egypt",
  continent: "Africa",
  category: "pyramid",
  latitude: 29.97915,
  longitude: 31.134219444444445,
  imageFile: "Kheops-Pyramid.jpg",
  imageUrl: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Kheops-Pyramid.jpg?width=1200",
  imageAlt: "The Great Pyramid of Giza in Egypt",
  sourceNote: "https://www.wikidata.org/wiki/Q37200; https://commons.wikimedia.org/wiki/File:Kheops-Pyramid.jpg",
  attribution: "Nina Aldin Thune",
  license: "CC BY-SA 3.0",
  mimeType: "image/jpeg",
  width: 1581,
  height: 971,
  sitelinks: 120,
  validationVersion: "postcard-v4"
}];

export const LANDMARKS: Landmark[] = [...landmarkData as GeneratedLandmark[], ...CURATED_QUALITY_REPLACEMENTS]
  .map((landmark) => {
    const quality = evaluateLandmarkQuality({ ...landmark, sitelinks: landmark.sitelinks ?? 0 });
    return {
      ...landmark,
      sitelinks: landmark.sitelinks ?? 0,
      region: landmark.continent,
      aliases: [landmark.name],
      imageValidation: `Verified Wikimedia Commons ${landmark.mimeType} photograph (${landmark.width}x${landmark.height}); ${landmark.license}; validation ${landmark.validationVersion}.`,
      ...quality
    };
  });
