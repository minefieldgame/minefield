import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const wordnet = require("wordnet");
const frequencyRows = require("subtlex-word-frequencies");
const cmudict = require("@stdlib/datasets-cmudict");
const countries = require("world-countries");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.join(ROOT, "data", "generated");
const generatedAt = new Date().toISOString();

const blockedWords = /(?:sex|porn|nazi|slur|rape|murder|suicide|terror|genital|cocaine|heroin|bullshit|bastard|asshole|fucking|racist|penis|vagina|hillbilly)/i;
const phonemeMap = {
  AA: "ah", AE: "a", AH: "uh", AO: "aw", AW: "ow", AY: "eye", B: "b", CH: "ch",
  D: "d", DH: "th", EH: "eh", ER: "er", EY: "ay", F: "f", G: "g", HH: "h",
  IH: "ih", IY: "ee", JH: "j", K: "k", L: "l", M: "m", N: "n", NG: "ng",
  OW: "oh", OY: "oy", P: "p", R: "r", S: "s", SH: "sh", T: "t", TH: "th",
  UH: "oo", UW: "oo", V: "v", W: "w", Y: "y", Z: "z", ZH: "zh"
};

const vowelPhonemes = new Set(["AA", "AE", "AH", "AO", "AW", "AY", "EH", "ER", "EY", "IH", "IY", "OW", "OY", "UH", "UW"]);

function misspellings(word, knownWords) {
  const variants = new Map();
  const add = (value, rule, score) => {
    if (value === word || !/^[a-z]+$/.test(value) || value.length < 4 || knownWords.has(value)) return;
    const existing = variants.get(value);
    if (!existing || score > existing.score) variants.set(value, { value, rule, score });
  };
  if (word.includes("ie")) add(word.replace("ie", "ei"), "ie-ei confusion", 0.98);
  if (word.includes("ei")) add(word.replace("ei", "ie"), "ie-ei confusion", 0.98);
  for (const [left, right] of [["able", "ible"], ["ible", "able"], ["ance", "ence"], ["ence", "ance"], ["ant", "ent"], ["ent", "ant"], ["ary", "ery"], ["ery", "ary"], ["tion", "sion"], ["sion", "tion"]]) {
    if (word.endsWith(left)) add(`${word.slice(0, -left.length)}${right}`, "common suffix confusion", 0.94);
  }
  if (word.endsWith("ous")) add(word.replace(/ous$/, "us"), "unstressed vowel omission", 0.9);
  const doubled = word.match(/([bcdfglmnpqrst])\1/);
  if (doubled) add(word.replace(doubled[0], doubled[1]), "omitted doubled consonant", 0.98);
  const clusters = [["ph", "f"], ["ck", "k"], ["wr", "r"], ["rh", "r"], ["ps", "s"], ["mn", "n"], ["gue", "g"], ["ough", "uff"], ["gh", "g"]];
  for (const [left, right] of clusters) {
    if (word.includes(left)) add(word.replace(left, right), "common phonetic or silent-letter substitution", 0.88);
  }
  const consonantCandidates = [...word].map((letter, index) => ({ letter, index }))
    .filter(({ letter, index }) => index > 1 && index < word.length - 2 && /[bcdfglmnprst]/.test(letter));
  for (const { letter, index } of consonantCandidates.slice(0, 2)) {
    if (word[index - 1] !== letter && word[index + 1] !== letter) {
      add(`${word.slice(0, index)}${letter}${word.slice(index)}`, "plausible doubled consonant", 0.8);
    }
  }
  const vowels = [...word].map((letter, index) => ({ letter, index }))
    .filter(({ letter, index }) => index > 1 && index < word.length - 2 && /[aeiou]/.test(letter));
  for (const { letter, index } of vowels.slice(-2)) {
    const replacement = letter === "e" ? "a" : letter === "a" ? "e" : letter === "i" ? "e" : letter === "o" ? "u" : "o";
    add(`${word.slice(0, index)}${replacement}${word.slice(index + 1)}`, "common unstressed-vowel confusion", 0.74);
  }
  return [...variants.values()].sort((left, right) => right.score - left.score || left.value.localeCompare(right.value)).slice(0, 4);
}

function pronunciation(word, dictionary) {
  const raw = dictionary[word.toUpperCase()] ?? dictionary[word.toUpperCase().replace(/-/g, "")];
  if (!raw) return "";
  const tokens = raw.trim().split(/\s+/).map((token) => ({
    phoneme: token.replace(/\d/g, ""),
    stress: Number(token.match(/\d/)?.[0] ?? 0)
  }));
  const vowelIndexes = tokens.flatMap((token, index) => vowelPhonemes.has(token.phoneme) ? [index] : []);
  if (!vowelIndexes.length) return "";
  const syllables = [];
  let start = 0;
  for (let index = 0; index < vowelIndexes.length - 1; index += 1) {
    const vowel = vowelIndexes[index];
    const nextVowel = vowelIndexes[index + 1];
    const consonantGap = nextVowel - vowel - 1;
    const bridge = tokens[vowel + 1]?.phoneme;
    const keepBridgeAsCoda = consonantGap === 1 && (
      (bridge === "R" && tokens[nextVowel]?.phoneme === "AH") ||
      (index === vowelIndexes.length - 2 && ["T", "D"].includes(bridge) && tokens[nextVowel]?.phoneme === "IY")
    );
    const nextStart = keepBridgeAsCoda ? nextVowel : consonantGap <= 1 ? vowel + 1 : nextVowel - 1;
    syllables.push(tokens.slice(start, nextStart));
    start = nextStart;
  }
  syllables.push(tokens.slice(start));
  return syllables.map((syllable) => {
    let text = syllable.map((token, index) => {
      if (token.phoneme === "EH" && syllable[index + 1]?.phoneme === "R") return "air";
      if (token.phoneme === "R" && syllable[index - 1]?.phoneme === "EH") return "";
      return phonemeMap[token.phoneme] ?? token.phoneme.toLowerCase();
    }).join("").replace(/ih(?=[bcdfgjklmnpqrstvwxyz]+$)/, "i").replace(/([a-z])\1\1+/g, "$1$1");
    if (text.length === 1 && /[aeiou]/.test(text)) text = `${text}h`;
    const stressed = syllable.some((token) => token.stress === 1);
    text = text.replace(/^([kg])uh(?=[mn])/, "$1uh");
    return stressed ? text.toUpperCase() : text.toLowerCase();
  }).filter(Boolean).join("-");
}

async function prepareWords() {
  await wordnet.init();
  const dictionary = cmudict({ data: "dict" });
  const rows = [];
  const seen = new Set();
  const seenDefinitions = new Set();
  const knownWords = new Set(frequencyRows.map((row) => String(row?.word ?? "").toLowerCase()).filter((word) => /^[a-z]+$/.test(word)));
  const spellingTrap = /(ie|ei|([bcdfglmnpqrst])\2|able$|ible$|ance$|ence$|ant$|ent$|ary$|ery$|ous$|tion$|sion$|cious$|ph|gh|ough|qu|sc|mn|rh|ps|wr|ck|dge|gue$)/;
  for (let rank = 1500; rank < frequencyRows.length && rows.length < 5200; rank += 1) {
    const original = String(frequencyRows[rank]?.word ?? "");
    const word = original.toLowerCase();
    if (original !== word || !/^[a-z]{7,18}$/.test(word) || !spellingTrap.test(word) || seen.has(word) || blockedWords.test(word)) continue;
    const misspellingRecords = misspellings(word, knownWords);
    const commonMisspellings = misspellingRecords.map((record) => record.value);
    const pronunciationHint = pronunciation(word, dictionary);
    if (commonMisspellings.length < 2 || !pronunciationHint) continue;
    const definitions = await wordnet.lookup(word, true).catch(() => []);
    const definition = String(definitions[0]?.glossary ?? "").split(";")[0].replace(/^\s+|\s+$/g, "");
    const definitionKey = definition.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter((token) => !["a", "an", "the"].includes(token)).join(" ");
    if (definition.length < 12 || definition.length > 180 || blockedWords.test(definition) || seenDefinitions.has(definitionKey)) continue;
    seen.add(word);
    seenDefinitions.add(definitionKey);
    rows.push({
      id: `word-${word}`,
      word,
      definition,
      commonMisspellings,
      misspellingEvidence: misspellingRecords,
      misspellingPlausibilityScore: Math.round(misspellingRecords.reduce((total, record) => total + record.score, 0) / misspellingRecords.length * 100),
      pronunciationHint,
      pronunciationValid: pronunciationHint.length >= 3 && !/[\d*]|(?:^|-)[a-z](?:-|$)/.test(pronunciationHint),
      misspellingValid: misspellingRecords.length >= 2 && misspellingRecords.every((record) => record.score >= 0.7),
      qualityScore: Math.max(35, Math.min(98, Math.round(96 - Math.max(0, rank - 3000) / 1200))),
      difficulty: rank < 4500 ? "easy" : rank < 12000 ? "medium" : "hard",
      frequencyRank: rank + 1,
      sourceNote: "Princeton WordNet definition; SUBTLEX-US frequency rank; CMUdict pronunciation",
      validationVersion: "buzzword-v4"
    });
  }
  if (rows.length < 5000) throw new Error(`Only ${rows.length} word candidates passed validation.`);
  return rows.slice(0, 5000);
}

async function prepareCountries() {
  let remote = [];
  try {
    const fields = "name,cca3,independent,unMember,population,area,borders,languages,capital,timezones,idd,latlng,region,subregion,landlocked,currencies";
    const response = await fetch(`https://restcountries.com/v3.1/all?fields=${fields}`, { headers: { "User-Agent": "MinefieldDaily/2.0" } });
    if (response.ok) remote = await response.json();
  } catch {}
  const fallback = new Map(countries.map((country) => [country.cca3, country]));
  const populations = new Map();
  try {
    const populationResponse = await fetch("https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json&date=2024&per_page=400", { headers: { "User-Agent": "MinefieldDaily/2.0" } });
    if (populationResponse.ok) {
      const populationPayload = await populationResponse.json();
      for (const row of populationPayload[1] ?? []) if (row.countryiso3code && row.value) populations.set(row.countryiso3code, Number(row.value));
    }
  } catch {}
  const source = remote.length ? remote : countries;
  return source
    .filter((country) => country.unMember && country.area > 0)
    .map((country) => {
      const local = fallback.get(country.cca3) ?? country;
      return {
        id: country.cca3,
        name: country.name.common,
        population: Number(populations.get(country.cca3) ?? country.population ?? 0),
        area: Number(country.area),
        borders: country.borders?.length ?? 0,
        languages: Object.keys(country.languages ?? {}).length,
        capitals: country.capital?.length ?? local.capital?.length ?? 0,
        timezones: country.timezones?.length ?? 1,
        currencies: Object.keys(country.currencies ?? local.currencies ?? {}).length,
        callingCode: Number(`${country.idd?.root ?? local.idd?.root ?? ""}${country.idd?.suffixes?.length === 1 ? country.idd.suffixes[0] : ""}`.replace(/\D/g, "")) || null,
        latitude: Number(country.latlng?.[0] ?? local.latlng?.[0] ?? 0),
        longitude: Number(country.latlng?.[1] ?? local.latlng?.[1] ?? 0),
        landlocked: Boolean(country.landlocked ?? local.landlocked),
        region: country.region ?? local.region,
        subregion: country.subregion ?? local.subregion,
        snapshotDate: generatedAt.slice(0, 10),
        sourceNote: "REST Countries v3.1 structured-data snapshot; World Bank 2024 population indicator SP.POP.TOTL"
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

function parsePoint(value) {
  const match = /^Point\(([-\d.]+) ([-\d.]+)\)$/.exec(value ?? "");
  return match ? { longitude: Number(match[1]), latitude: Number(match[2]) } : null;
}

async function wikidataLandmarks() {
  const roots = [
    ["Q570116", "tourist attraction", "Q15"], ["Q570116", "tourist attraction", "Q48"],
    ["Q570116", "tourist attraction", "Q46"], ["Q570116", "tourist attraction", "Q49"],
    ["Q570116", "tourist attraction", "Q18"], ["Q570116", "tourist attraction", "Q55643"],
    ["Q12280", "bridge"], ["Q11303", "skyscraper"], ["Q23413", "castle"],
    ["Q33506", "museum"], ["Q483110", "stadium"], ["Q839954", "archaeological site"],
    ["Q8502", "mountain"], ["Q16970", "church"], ["Q32815", "mosque"],
    ["Q44539", "temple"], ["Q16560", "palace"], ["Q12518", "tower"],
    ["Q179700", "statue"], ["Q174782", "public square"], ["Q570116", "tourist attraction"]
  ];
  const bindings = [];
  for (const [root, fallbackClass, requiredContinent] of roots) {
    const query = `SELECT DISTINCT ?item ?itemLabel ?image ?coord ?countryLabel ?continentLabel ?locationLabel ?sitelinks WHERE {
      ?item wdt:P31/wdt:P279* wd:${root}; wdt:P18 ?image; wdt:P625 ?coord; wdt:P17 ?country; wikibase:sitelinks ?sitelinks.
      ?country wdt:P30 ?continent.
      OPTIONAL { ?item wdt:P131 ?location. }
      FILTER(?sitelinks >= 8)
      ${requiredContinent ? `FILTER(?continent = wd:${requiredContinent})` : ""}
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } ORDER BY DESC(?sitelinks) LIMIT ${requiredContinent ? 130 : 90}`;
    const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;
    const response = await fetch(url, { headers: { Accept: "application/sparql-results+json", "User-Agent": "MinefieldDaily/2.0 (content inventory maintainer)" }, signal: AbortSignal.timeout(20_000) }).catch(() => null);
    if (!response?.ok) continue;
    const payload = await response.json();
    bindings.push(...(payload.results?.bindings ?? []).map((row) => ({ ...row, classLabel: { value: fallbackClass } })));
  }
  if (bindings.length < 500) throw new Error(`Wikidata returned only ${bindings.length} landmark candidates.`);
  return bindings;
}

async function commonsMetadata(files) {
  const result = new Map();
  for (let index = 0; index < files.length; index += 50) {
    const titles = files.slice(index, index + 50).map((file) => `File:${file}`).join("|");
    const params = new URLSearchParams({ action: "query", format: "json", formatversion: "2", titles, prop: "imageinfo", iiprop: "url|mime|size|extmetadata" });
    let response;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, { headers: { "User-Agent": "MinefieldDaily/2.0 (content-maintainer@minefieldgame.com)" }, signal: AbortSignal.timeout(20_000) }).catch(() => null);
      if (response?.ok) break;
      if (response && response.status !== 429 && response.status < 500) break;
      await new Promise((resolve) => setTimeout(resolve, 750 * (attempt + 1)));
    }
    if (!response?.ok) throw new Error(`Commons metadata returned ${response?.status ?? "no response"}`);
    const payload = await response.json();
    for (const page of payload.query?.pages ?? []) {
      const info = page.imageinfo?.[0];
      if (page.title && info) result.set(page.title.replace(/^File:/, ""), info);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return result;
}

async function prepareLandmarks() {
  const bindings = await wikidataLandmarks();
  const candidates = [];
  const names = new Set();
  const files = new Set();
  const coordinates = new Set();
  for (const row of bindings) {
    const point = parsePoint(row.coord?.value);
    const name = row.itemLabel?.value?.trim();
    const file = decodeURIComponent(row.image?.value?.split("/Special:FilePath/")[1] ?? "").replace(/_/g, " ");
    const normalizedName = name?.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, " ").toLowerCase().trim();
    const coordinateKey = point ? `${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}` : "";
    if (!point || !name || !file || names.has(normalizedName) || files.has(file) || coordinates.has(coordinateKey)) continue;
    if (/\.(?:svg|pdf|djvu)$/i.test(file)) continue;
    names.add(normalizedName); files.add(file); coordinates.add(coordinateKey);
    candidates.push({ row, point, name, file });
  }
  const metadata = await commonsMetadata(candidates.slice(0, 1200).map((entry) => entry.file));
  const rows = [];
  for (const { row, point, name, file } of candidates) {
    const info = metadata.get(file);
    if (!info?.mime?.startsWith("image/") || info.mime === "image/svg+xml" || info.width < 640 || info.height < 480) continue;
    const ext = info.extmetadata ?? {};
    const license = ext.LicenseShortName?.value || ext.UsageTerms?.value || "See Commons file page";
    const artist = String(ext.Artist?.value ?? "Wikimedia Commons contributor").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 240);
    rows.push({
      id: row.item.value.split("/").pop(), name,
      city: row.locationLabel?.value ?? row.countryLabel?.value ?? "Unknown region",
      country: row.countryLabel?.value ?? "Unknown country",
      continent: row.continentLabel?.value ?? "Other",
      category: row.classLabel?.value ?? "landmark",
      latitude: point.latitude, longitude: point.longitude,
      imageFile: file,
      imageUrl: `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(file)}?width=1200`,
      imageAlt: `${name} in ${row.locationLabel?.value ?? row.countryLabel?.value ?? "its region"}`,
      sourceNote: `${row.item.value}; https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, "_"))}`,
      attribution: artist,
      license,
      mimeType: info.mime,
      width: info.width,
      height: info.height,
      validationVersion: "postcard-v3"
    });
  }
  if (rows.length < 500) throw new Error(`Only ${rows.length} landmark photographs passed validation.`);
  const byContinent = new Map();
  for (const row of rows) {
    const group = byContinent.get(row.continent) ?? [];
    group.push(row);
    byContinent.set(row.continent, group);
  }
  const selected = [];
  const categoryCounts = new Map();
  while (selected.length < 500) {
    let progressed = false;
    for (const group of [...byContinent.values()].sort((left, right) => right.length - left.length)) {
      const index = group.findIndex((row) => (categoryCounts.get(row.category) ?? 0) < 85);
      if (index < 0) continue;
      const [row] = group.splice(index, 1);
      selected.push(row);
      categoryCounts.set(row.category, (categoryCounts.get(row.category) ?? 0) + 1);
      progressed = true;
      if (selected.length >= 500) break;
    }
    if (!progressed) break;
  }
  if (selected.length < 500) throw new Error(`Diversity caps left only ${selected.length} landmark photographs.`);
  return selected;
}

await fs.mkdir(OUTPUT, { recursive: true });
const scope = process.env.CONTENT_PREPARE_SCOPE ?? "all";
const loadExisting = async (name) => JSON.parse(await fs.readFile(path.join(OUTPUT, name), "utf8"));
const words = scope === "all" || scope === "words" ? await prepareWords() : await loadExisting("buzzwords.json");
const countryFacts = scope === "all" || scope === "countries" ? await prepareCountries() : await loadExisting("countryFacts.json");
const landmarks = scope === "all" || scope === "landmarks" ? await prepareLandmarks() : await loadExisting("landmarks.json");
await Promise.all([
  fs.writeFile(path.join(OUTPUT, "buzzwords.json"), `${JSON.stringify(words)}\n`),
  fs.writeFile(path.join(OUTPUT, "countryFacts.json"), `${JSON.stringify(countryFacts)}\n`),
  fs.writeFile(path.join(OUTPUT, "landmarks.json"), `${JSON.stringify(landmarks)}\n`),
  fs.writeFile(path.join(OUTPUT, "manifest.json"), `${JSON.stringify({ generatedAt, counts: { buzzwords: words.length, buzzwordEligible: words.filter((word) => word.pronunciationValid && word.misspellingValid && word.qualityScore >= 70).length, countryFacts: countryFacts.length, landmarks: landmarks.length }, sources: ["Princeton WordNet", "SUBTLEX-US", "CMUdict", "REST Countries", "Wikidata", "Wikimedia Commons"] }, null, 2)}\n`)
]);
console.log(JSON.stringify({ generatedAt, buzzwords: words.length, countryFacts: countryFacts.length, landmarks: landmarks.length }, null, 2));
