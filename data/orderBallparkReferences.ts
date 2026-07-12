export const IN_ORDER_CATEGORY_FAMILIES = [
  "film-release-chronology",
  "film-box-office",
  "music-release-chronology",
  "album-release-chronology",
  "video-game-release-chronology",
  "television-premiere-chronology",
  "book-publication-chronology",
  "historical-events",
  "inventions-discoveries",
  "sports-records-milestones",
  "landmark-completion-dates",
  "building-heights",
  "geographic-size-distance",
  "animal-size-speed",
  "space-astronomy",
  "company-founding-dates",
  "technology-milestones",
  "mainstream-country-city-facts"
] as const;

export type InOrderCategoryFamily = typeof IN_ORDER_CATEGORY_FAMILIES[number];

export const BALLPARK_CATEGORIES = [
  "Famous landmarks",
  "Popular sports",
  "Movies and entertainment",
  "Astronomy",
  "Animals",
  "Geography",
  "Transportation",
  "Human body",
  "Technology",
  "Familiar history"
] as const;

export type BallparkCategory = typeof BALLPARK_CATEGORIES[number];
export type ReferenceDifficulty = "approachable" | "standard" | "challenging";

export type ReferenceFact = {
  id: string;
  label: string;
  value: number;
  displayValue: string;
  familiarity: number;
  ballparkPrompt?: string;
  unit?: string;
};

export type ReferenceOrder = {
  categoryFamily: InOrderCategoryFamily;
  categoryLabel: string;
  title: string;
  playerPrompt: string;
  metric: string;
  direction: "highest-to-lowest" | "lowest-to-highest";
};

export type ReferenceCollection = {
  id: string;
  ballparkCategory: BallparkCategory;
  unit: string;
  ballparkPromptTemplate: string;
  sourceUrl: string;
  sourceLabel: string;
  sourceSnapshot: string;
  factualConfidence: number;
  sourceQuality: number;
  intuitiveEstimability: number;
  entertainmentValue: number;
  wordingClarity: number;
  answerStability: number;
  unitFamiliarity: number;
  categoryFreshness: number;
  difficultyTier: ReferenceDifficulty;
  order?: ReferenceOrder;
  facts: ReferenceFact[];
};

type FactTuple = readonly [id: string, label: string, value: number, displayValue: string, familiarity?: number];

function facts(rows: readonly FactTuple[]): ReferenceFact[] {
  return rows.map(([id, label, value, displayValue, familiarity = 82]) => ({ id, label, value, displayValue, familiarity }));
}

type CollectionInput = Omit<ReferenceCollection, "facts" | "factualConfidence" | "sourceQuality" | "wordingClarity" | "answerStability" | "unitFamiliarity" | "categoryFreshness"> & {
  facts: readonly FactTuple[] | ReferenceFact[];
  factualConfidence?: number;
  sourceQuality?: number;
  wordingClarity?: number;
  answerStability?: number;
  unitFamiliarity?: number;
  categoryFreshness?: number;
};

function collection(input: CollectionInput): ReferenceCollection {
  const rows = input.facts.map((row) => Array.isArray(row)
    ? { id: row[0], label: row[1], value: row[2], displayValue: row[3], familiarity: row[4] ?? 82 }
    : row) as ReferenceFact[];
  return {
    ...input,
    facts: rows,
    factualConfidence: input.factualConfidence ?? 94,
    sourceQuality: input.sourceQuality ?? 92,
    wordingClarity: input.wordingClarity ?? 94,
    answerStability: input.answerStability ?? 90,
    unitFamiliarity: input.unitFamiliarity ?? 90,
    categoryFreshness: input.categoryFreshness ?? 86
  };
}

const BRITANNICA = "https://www.britannica.com/";
const VERIFIED = "Stable reference facts reviewed 2026-07-12";

export const ORDER_BALLPARK_REFERENCE_COLLECTIONS: ReferenceCollection[] = [
  collection({
    id: "landmark-heights", ballparkCategory: "Famous landmarks", unit: "meters",
    ballparkPromptTemplate: "About how tall is {name}, in meters?", sourceUrl: BRITANNICA,
    sourceLabel: "Encyclopaedia Britannica landmark reference", sourceSnapshot: VERIFIED,
    intuitiveEstimability: 88, entertainmentValue: 90, difficultyTier: "approachable",
    order: { categoryFamily: "building-heights", categoryLabel: "Landmarks", title: "Famous landmarks by height", playerPrompt: "Rank these landmarks by height, tallest to shortest.", metric: "height in meters", direction: "highest-to-lowest" },
    facts: facts([
      ["tokyo-skytree", "Tokyo Skytree", 634, "634 m", 91], ["canton-tower", "Canton Tower", 604, "604 m", 82],
      ["cn-tower", "CN Tower", 553, "553 m", 94], ["eiffel-tower", "Eiffel Tower", 330, "330 m", 99],
      ["gateway-arch", "Gateway Arch", 192, "192 m", 92], ["space-needle", "Space Needle", 184, "184 m", 94],
      ["washington-monument", "Washington Monument", 169, "169 m", 96], ["elizabeth-tower", "Elizabeth Tower (Big Ben)", 96, "96 m", 98],
      ["statue-liberty", "Statue of Liberty", 93, "93 m", 99], ["leaning-tower", "Leaning Tower of Pisa", 57, "57 m", 98]
    ])
  }),
  collection({
    id: "landmark-completion", ballparkCategory: "Famous landmarks", unit: "year",
    ballparkPromptTemplate: "In what year was {name} completed?", sourceUrl: BRITANNICA,
    sourceLabel: "Encyclopaedia Britannica architecture histories", sourceSnapshot: VERIFIED,
    intuitiveEstimability: 80, entertainmentValue: 88, difficultyTier: "standard",
    order: { categoryFamily: "landmark-completion-dates", categoryLabel: "Landmarks", title: "Famous landmarks by completion date", playerPrompt: "Put these landmarks in completion order, earliest to latest.", metric: "completion year", direction: "lowest-to-highest" },
    facts: facts([
      ["colosseum", "the Colosseum", 80, "80 CE", 98], ["notre-dame", "Notre-Dame de Paris", 1345, "1345", 96],
      ["leaning-tower-date", "Leaning Tower of Pisa", 1372, "1372", 98], ["st-peters", "St. Peter's Basilica", 1626, "1626", 94],
      ["elizabeth-tower-date", "Elizabeth Tower (Big Ben)", 1859, "1859", 98], ["statue-liberty-date", "Statue of Liberty", 1886, "1886", 99],
      ["eiffel-date", "Eiffel Tower", 1889, "1889", 99], ["empire-state-date", "Empire State Building", 1931, "1931", 98],
      ["sydney-opera", "Sydney Opera House", 1973, "1973", 97], ["burj-date", "Burj Khalifa", 2010, "2010", 99]
    ])
  }),
  collection({
    id: "skyscraper-heights", ballparkCategory: "Famous landmarks", unit: "meters",
    ballparkPromptTemplate: "About how tall is {name}, in meters?", sourceUrl: "https://www.skyscrapercenter.com/",
    sourceLabel: "Council on Tall Buildings and Urban Habitat", sourceSnapshot: VERIFIED,
    intuitiveEstimability: 82, entertainmentValue: 84, difficultyTier: "standard",
    order: { categoryFamily: "building-heights", categoryLabel: "Architecture", title: "Skyscrapers by architectural height", playerPrompt: "Rank these skyscrapers by height, tallest to shortest.", metric: "architectural height in meters", direction: "highest-to-lowest" },
    facts: facts([
      ["flatiron", "Flatiron Building", 87, "87 m", 89], ["woolworth", "Woolworth Building", 241, "241 m", 78],
      ["chrysler", "Chrysler Building", 319, "319 m", 96], ["empire-skyscraper", "Empire State Building", 381, "381 m", 98],
      ["willis", "Willis Tower", 442, "442 m", 94], ["petronas", "Petronas Towers", 452, "452 m", 94],
      ["taipei-101", "Taipei 101", 508, "508 m", 93], ["one-wtc", "One World Trade Center", 541, "541 m", 95],
      ["shanghai-tower", "Shanghai Tower", 632, "632 m", 91], ["burj-skyscraper", "Burj Khalifa", 828, "828 m", 99]
    ])
  }),
  collection({
    id: "bridge-main-spans", ballparkCategory: "Famous landmarks", unit: "meters",
    ballparkPromptTemplate: "About how long is the main span of {name}, in meters?", sourceUrl: "https://structurae.net/",
    sourceLabel: "Structurae international structures database", sourceSnapshot: VERIFIED,
    intuitiveEstimability: 74, entertainmentValue: 80, difficultyTier: "challenging", answerStability: 96,
    order: { categoryFamily: "geographic-size-distance", categoryLabel: "Bridges", title: "Famous bridges by main span", playerPrompt: "Rank these bridges by main-span length, longest to shortest.", metric: "main span in meters", direction: "highest-to-lowest" },
    facts: facts([
      ["tower-bridge", "Tower Bridge", 61, "61 m", 95], ["millau", "Millau Viaduct", 342, "342 m", 84],
      ["brooklyn", "Brooklyn Bridge", 486, "486 m", 98], ["sydney-harbour", "Sydney Harbour Bridge", 503, "503 m", 94],
      ["george-washington", "George Washington Bridge", 1067, "1,067 m", 86], ["mackinac", "Mackinac Bridge", 1158, "1,158 m", 80],
      ["golden-gate", "Golden Gate Bridge", 1280, "1,280 m", 99], ["verrazzano", "Verrazzano-Narrows Bridge", 1298, "1,298 m", 82],
      ["humber", "Humber Bridge", 1410, "1,410 m", 74], ["akashi", "Akashi Kaikyo Bridge", 1991, "1,991 m", 78]
    ])
  }),
  collection({
    id: "monument-sizes", ballparkCategory: "Famous landmarks", unit: "meters",
    ballparkPromptTemplate: "About how tall is {name}, in meters?", sourceUrl: BRITANNICA,
    sourceLabel: "Encyclopaedia Britannica monument reference", sourceSnapshot: VERIFIED,
    intuitiveEstimability: 78, entertainmentValue: 86, difficultyTier: "standard", order: undefined,
    facts: facts([
      ["manneken-pis", "Manneken Pis", 0.61, "0.61 m", 75], ["little-mermaid", "The Little Mermaid statue", 1.25, "1.25 m", 82],
      ["thinker", "The Thinker", 1.86, "1.86 m", 88], ["david", "Michelangelo's David", 5.17, "5.17 m", 94],
      ["moai", "a large Easter Island moai", 10, "about 10 m", 92], ["rushmore-face", "each Mount Rushmore face", 18, "about 18 m", 98],
      ["christ-redeemer", "Christ the Redeemer including its pedestal", 38, "38 m", 98], ["motherland-calls", "The Motherland Calls", 85, "85 m", 74],
      ["spring-temple", "Spring Temple Buddha", 128, "128 m", 72], ["statue-unity", "Statue of Unity", 182, "182 m", 78]
    ])
  }),
  collection({
    id: "stadium-capacities", ballparkCategory: "Popular sports", unit: "seats",
    ballparkPromptTemplate: "About how many spectators can {name} hold?", sourceUrl: "https://www.worldstadiumdatabase.com/",
    sourceLabel: "World Stadium Database and official venue capacities", sourceSnapshot: "Published seated capacities reviewed 2026-07-12",
    factualConfidence: 90, sourceQuality: 88, intuitiveEstimability: 87, entertainmentValue: 88,
    answerStability: 80, difficultyTier: "approachable",
    order: { categoryFamily: "sports-records-milestones", categoryLabel: "Sports", title: "Sports venues by capacity", playerPrompt: "Rank these sports venues by capacity, largest to smallest.", metric: "published spectator capacity", direction: "highest-to-lowest" },
    facts: facts([
      ["msg", "Madison Square Garden", 19812, "19,812", 96], ["fenway", "Fenway Park", 37755, "37,755", 98],
      ["wrigley", "Wrigley Field", 41649, "41,649", 97], ["yankee", "Yankee Stadium", 46537, "46,537", 97],
      ["maracana", "Maracana Stadium", 78838, "78,838", 93], ["wembley", "Wembley Stadium", 90000, "90,000", 98],
      ["rose-bowl", "Rose Bowl", 92542, "92,542", 95], ["camp-nou", "Camp Nou", 99354, "99,354", 97],
      ["michigan-stadium", "Michigan Stadium", 107601, "107,601", 91], ["indy-speedway", "Indianapolis Motor Speedway", 257325, "257,325", 90]
    ])
  }),
  collection({
    id: "sports-venue-openings", ballparkCategory: "Popular sports", unit: "year",
    ballparkPromptTemplate: "In what year did {name} open?", sourceUrl: "https://www.loc.gov/",
    sourceLabel: "Library of Congress and official venue histories", sourceSnapshot: VERIFIED,
    intuitiveEstimability: 78, entertainmentValue: 82, difficultyTier: "standard",
    order: { categoryFamily: "sports-records-milestones", categoryLabel: "Sports", title: "Sports venues by opening date", playerPrompt: "Put these sports venues in opening order, earliest to latest.", metric: "opening year", direction: "lowest-to-highest" },
    facts: facts([
      ["fenway-open", "Fenway Park", 1912, "1912", 98], ["wrigley-open", "Wrigley Field", 1914, "1914", 97],
      ["rose-open", "Rose Bowl", 1922, "1922", 95], ["augusta-open", "Augusta National Golf Club", 1933, "1933", 91],
      ["maracana-open", "Maracana Stadium", 1950, "1950", 93], ["dodger-open", "Dodger Stadium", 1962, "1962", 94],
      ["msg-open", "the current Madison Square Garden", 1968, "1968", 96], ["superdome-open", "Caesars Superdome", 1975, "1975", 91],
      ["camden-open", "Oriole Park at Camden Yards", 1992, "1992", 85], ["wembley-open", "the current Wembley Stadium", 2007, "2007", 98]
    ])
  }),
  collection({
    id: "summer-olympic-hosts", ballparkCategory: "Popular sports", unit: "year",
    ballparkPromptTemplate: "In what year did {name} host the Summer Olympics?", sourceUrl: "https://olympics.com/ioc/olympic-games",
    sourceLabel: "International Olympic Committee Olympic Games history", sourceSnapshot: VERIFIED,
    intuitiveEstimability: 84, entertainmentValue: 90, difficultyTier: "approachable",
    order: { categoryFamily: "sports-records-milestones", categoryLabel: "Sports", title: "Summer Olympic host cities", playerPrompt: "Put these Summer Olympic host cities in order, earliest to latest.", metric: "host year", direction: "lowest-to-highest" },
    facts: facts([
      ["athens-1896", "Athens", 1896, "1896", 98], ["paris-1900", "Paris", 1900, "1900", 98],
      ["london-1908", "London", 1908, "1908", 98], ["berlin-1936", "Berlin", 1936, "1936", 95],
      ["rome-1960", "Rome", 1960, "1960", 94], ["tokyo-1964", "Tokyo", 1964, "1964", 98],
      ["mexico-1968", "Mexico City", 1968, "1968", 95], ["montreal-1976", "Montreal", 1976, "1976", 93],
      ["barcelona-1992", "Barcelona", 1992, "1992", 96], ["sydney-2000", "Sydney", 2000, "2000", 97]
    ])
  }),
  collection({
    id: "sports-event-debuts", ballparkCategory: "Popular sports", unit: "year",
    ballparkPromptTemplate: "In what year was the first {name} held?", sourceUrl: BRITANNICA,
    sourceLabel: "Encyclopaedia Britannica sports histories", sourceSnapshot: VERIFIED,
    intuitiveEstimability: 75, entertainmentValue: 86, difficultyTier: "standard",
    order: { categoryFamily: "sports-records-milestones", categoryLabel: "Sports", title: "Major sports events by debut", playerPrompt: "Put these major sports events in debut order, earliest to latest.", metric: "first edition year", direction: "lowest-to-highest" },
    facts: facts([
      ["kentucky-derby", "Kentucky Derby", 1875, "1875", 91], ["wimbledon", "Wimbledon Championships", 1877, "1877", 95],
      ["boston-marathon", "Boston Marathon", 1897, "1897", 89], ["tour-france", "Tour de France", 1903, "1903", 94],
      ["little-league-world-series", "Little League World Series", 1947, "1947", 88], ["indy-500", "Indianapolis 500", 1911, "1911", 92],
      ["fifa-world-cup", "FIFA World Cup", 1930, "1930", 99], ["masters", "Masters Tournament", 1934, "1934", 92],
      ["super-bowl", "Super Bowl", 1967, "1967", 99], ["wnba-finals", "WNBA Finals", 1997, "1997", 88]
    ])
  }),
  collection({
    id: "sports-dimensions", ballparkCategory: "Popular sports", unit: "units",
    ballparkPromptTemplate: "{name}", sourceUrl: "https://www.britannica.com/sports/",
    sourceLabel: "Official playing rules summarized by Encyclopaedia Britannica", sourceSnapshot: VERIFIED,
    intuitiveEstimability: 92, entertainmentValue: 91, wordingClarity: 96, difficultyTier: "approachable", order: undefined,
    facts: [
      { id: "basketball-hoop", label: "basketball hoop height", value: 10, displayValue: "10 feet", familiarity: 99, unit: "feet", ballparkPrompt: "How high is a regulation basketball hoop, in feet?" },
      { id: "soccer-goal", label: "soccer goal height", value: 8, displayValue: "8 feet", familiarity: 97, unit: "feet", ballparkPrompt: "How high is a regulation soccer goal, in feet?" },
      { id: "base-path", label: "baseball base-path length", value: 90, displayValue: "90 feet", familiarity: 97, unit: "feet", ballparkPrompt: "How far apart are the bases in Major League Baseball, in feet?" },
      { id: "bowling-lane", label: "bowling lane length", value: 60, displayValue: "60 feet", familiarity: 90, unit: "feet", ballparkPrompt: "How far is it from the foul line to the head pin on a bowling lane, in feet?" },
      { id: "tennis-net", label: "tennis net center height", value: 3, displayValue: "3 feet", familiarity: 91, unit: "feet", ballparkPrompt: "How high is a tennis net at the center, in feet?" },
      { id: "marathon", label: "marathon distance", value: 26.2, displayValue: "26.2 miles", familiarity: 99, unit: "miles", ballparkPrompt: "How long is a marathon, in miles?" },
      { id: "olympic-pool", label: "Olympic pool length", value: 50, displayValue: "50 meters", familiarity: 98, unit: "meters", ballparkPrompt: "How long is an Olympic-size swimming pool, in meters?" },
      { id: "hockey-rink", label: "NHL rink length", value: 200, displayValue: "200 feet", familiarity: 91, unit: "feet", ballparkPrompt: "How long is a standard NHL rink, in feet?" },
      { id: "cricket-pitch", label: "cricket pitch length", value: 22, displayValue: "22 yards", familiarity: 86, unit: "yards", ballparkPrompt: "How long is a cricket pitch, in yards?" },
      { id: "golf-hole", label: "golf cup diameter", value: 4.25, displayValue: "4.25 inches", familiarity: 88, unit: "inches", ballparkPrompt: "How wide is a regulation golf hole, in inches?" }
    ]
  }),
  collection({
    id: "live-action-film-releases", ballparkCategory: "Movies and entertainment", unit: "year",
    ballparkPromptTemplate: "In what year was {name} released?", sourceUrl: "https://catalog.afi.com/",
    sourceLabel: "AFI Catalog of Feature Films", sourceSnapshot: VERIFIED,
    intuitiveEstimability: 91, entertainmentValue: 94, difficultyTier: "approachable",
    order: { categoryFamily: "film-release-chronology", categoryLabel: "Movies", title: "Movies by release date", playerPrompt: "Put these movies in release order, earliest to latest.", metric: "theatrical release year", direction: "lowest-to-highest" },
    facts: facts([
      ["wizard-oz", "The Wizard of Oz", 1939, "1939", 99], ["casablanca", "Casablanca", 1942, "1942", 97],
      ["jaws", "Jaws", 1975, "1975", 99], ["star-wars", "Star Wars", 1977, "1977", 99],
      ["et", "E.T. the Extra-Terrestrial", 1982, "1982", 98], ["jurassic-park", "Jurassic Park", 1993, "1993", 99],
      ["titanic", "Titanic", 1997, "1997", 99], ["matrix", "The Matrix", 1999, "1999", 98],
      ["dark-knight", "The Dark Knight", 2008, "2008", 98], ["frozen", "Frozen", 2013, "2013", 99]
    ])
  }),
  collection({
    id: "animated-film-releases", ballparkCategory: "Movies and entertainment", unit: "year",
    ballparkPromptTemplate: "In what year was {name} released?", sourceUrl: "https://catalog.afi.com/",
    sourceLabel: "AFI Catalog and studio release histories", sourceSnapshot: VERIFIED,
    intuitiveEstimability: 89, entertainmentValue: 93, difficultyTier: "approachable",
    order: { categoryFamily: "film-release-chronology", categoryLabel: "Movies", title: "Animated movies by release date", playerPrompt: "Put these animated movies in release order, earliest to latest.", metric: "theatrical release year", direction: "lowest-to-highest" },
    facts: facts([
      ["snow-white", "Snow White and the Seven Dwarfs", 1937, "1937", 98], ["cinderella", "Cinderella", 1950, "1950", 98],
      ["sleeping-beauty", "Sleeping Beauty", 1959, "1959", 94], ["little-mermaid-film", "The Little Mermaid", 1989, "1989", 98],
      ["beauty-beast", "Beauty and the Beast", 1991, "1991", 98], ["toy-story", "Toy Story", 1995, "1995", 99],
      ["shrek", "Shrek", 2001, "2001", 99], ["finding-nemo", "Finding Nemo", 2003, "2003", 99],
      ["up", "Up", 2009, "2009", 96], ["inside-out", "Inside Out", 2015, "2015", 97]
    ])
  }),
  collection({
    id: "film-runtimes", ballparkCategory: "Movies and entertainment", unit: "minutes",
    ballparkPromptTemplate: "About how long is {name}, in minutes?", sourceUrl: "https://catalog.afi.com/",
    sourceLabel: "AFI Catalog and studio running times", sourceSnapshot: VERIFIED,
    intuitiveEstimability: 94, entertainmentValue: 89, difficultyTier: "approachable", order: undefined,
    facts: facts([
      ["toy-story-runtime", "Toy Story", 81, "81 minutes", 99], ["finding-nemo-runtime", "Finding Nemo", 100, "100 minutes", 99],
      ["wizard-runtime", "The Wizard of Oz", 102, "102 minutes", 99], ["et-runtime", "E.T. the Extra-Terrestrial", 115, "115 minutes", 98],
      ["star-wars-runtime", "Star Wars", 121, "121 minutes", 99], ["jaws-runtime", "Jaws", 124, "124 minutes", 99],
      ["jurassic-runtime", "Jurassic Park", 127, "127 minutes", 99], ["matrix-runtime", "The Matrix", 136, "136 minutes", 98],
      ["dark-knight-runtime", "The Dark Knight", 152, "152 minutes", 98], ["titanic-runtime", "Titanic", 194, "194 minutes", 99]
    ])
  }),
  collection({
    id: "film-worldwide-gross", ballparkCategory: "Movies and entertainment", unit: "millions of US dollars",
    ballparkPromptTemplate: "About how much did {name} earn worldwide, in millions of US dollars?", sourceUrl: "https://www.the-numbers.com/box-office-records/worldwide/all-movies/cumulative/all-time",
    sourceLabel: "The Numbers worldwide box-office totals", sourceSnapshot: "Worldwide grosses rounded to nearest million; reviewed 2026-07-12",
    factualConfidence: 91, sourceQuality: 88, intuitiveEstimability: 85, entertainmentValue: 92, answerStability: 82,
    difficultyTier: "standard",
    order: { categoryFamily: "film-box-office", categoryLabel: "Movies", title: "Movies by worldwide box office", playerPrompt: "Rank these movies by worldwide box office, highest to lowest.", metric: "worldwide gross in millions of US dollars", direction: "highest-to-lowest" },
    facts: facts([
      ["jaws-gross", "Jaws", 476, "$476 million", 99], ["star-wars-gross", "Star Wars", 775, "$775 million", 99],
      ["et-gross", "E.T. the Extra-Terrestrial", 797, "$797 million", 98], ["dark-knight-gross", "The Dark Knight", 1006, "$1.006 billion", 98],
      ["jurassic-gross", "Jurassic Park", 1104, "$1.104 billion", 99], ["frozen-gross", "Frozen", 1285, "$1.285 billion", 99],
      ["barbie-gross", "Barbie", 1446, "$1.446 billion", 98], ["titanic-gross", "Titanic", 2264, "$2.264 billion", 99],
      ["endgame-gross", "Avengers: Endgame", 2799, "$2.799 billion", 99], ["avatar-gross", "Avatar", 2924, "$2.924 billion", 99]
    ])
  }),
  collection({
    id: "television-premieres", ballparkCategory: "Movies and entertainment", unit: "year",
    ballparkPromptTemplate: "In what year did {name} premiere?", sourceUrl: "https://www.paleycenter.org/collection/",
    sourceLabel: "Paley Center television collection and network histories", sourceSnapshot: VERIFIED,
    intuitiveEstimability: 88, entertainmentValue: 93, difficultyTier: "approachable",
    order: { categoryFamily: "television-premiere-chronology", categoryLabel: "Television", title: "TV shows by premiere date", playerPrompt: "Put these TV shows in premiere order, earliest to latest.", metric: "premiere year", direction: "lowest-to-highest" },
    facts: facts([
      ["i-love-lucy", "I Love Lucy", 1951, "1951", 96], ["twilight-zone", "The Twilight Zone", 1959, "1959", 95],
      ["star-trek", "Star Trek", 1966, "1966", 98], ["sesame-street", "Sesame Street", 1969, "1969", 99],
      ["snl", "Saturday Night Live", 1975, "1975", 98], ["simpsons", "The Simpsons", 1989, "1989", 99],
      ["friends", "Friends", 1994, "1994", 99], ["spongebob", "SpongeBob SquarePants", 1999, "1999", 99],
      ["office-us", "The Office (U.S.)", 2005, "2005", 99], ["stranger-things", "Stranger Things", 2016, "2016", 98]
    ])
  }),
  collection({
    id: "book-publications", ballparkCategory: "Movies and entertainment", unit: "year",
    ballparkPromptTemplate: "In what year was {name} first published?", sourceUrl: "https://catalog.loc.gov/",
    sourceLabel: "Library of Congress catalog", sourceSnapshot: VERIFIED,
    intuitiveEstimability: 82, entertainmentValue: 88, difficultyTier: "standard",
    order: { categoryFamily: "book-publication-chronology", categoryLabel: "Books", title: "Books by publication date", playerPrompt: "Put these books in publication order, earliest to latest.", metric: "first publication year", direction: "lowest-to-highest" },
    facts: facts([
      ["hobbit", "The Hobbit", 1937, "1937", 98], ["nineteen-eighty-four", "Nineteen Eighty-Four", 1949, "1949", 97],
      ["catcher", "The Catcher in the Rye", 1951, "1951", 95], ["mockingbird", "To Kill a Mockingbird", 1960, "1960", 97],
      ["dune", "Dune", 1965, "1965", 96], ["shining", "The Shining", 1977, "1977", 94],
      ["handmaids", "The Handmaid's Tale", 1985, "1985", 93], ["harry-potter", "Harry Potter and the Philosopher's Stone", 1997, "1997", 99],
      ["hunger-games", "The Hunger Games", 2008, "2008", 98], ["fault-stars", "The Fault in Our Stars", 2012, "2012", 91]
    ])
  }),
  collection({
    id: "song-release-years", ballparkCategory: "Movies and entertainment", unit: "year",
    ballparkPromptTemplate: "In what year was {name} released?", sourceUrl: "https://www.billboard.com/charts/hot-100/",
    sourceLabel: "Billboard chart archive and label release histories", sourceSnapshot: VERIFIED,
    intuitiveEstimability: 88, entertainmentValue: 95, difficultyTier: "approachable",
    order: { categoryFamily: "music-release-chronology", categoryLabel: "Music", title: "Hit songs by release date", playerPrompt: "Put these hit songs in release order, earliest to latest.", metric: "release year", direction: "lowest-to-highest" },
    facts: facts([
      ["rock-clock", "Rock Around the Clock", 1954, "1954", 91], ["respect", "Respect by Aretha Franklin", 1967, "1967", 97],
      ["bohemian", "Bohemian Rhapsody", 1975, "1975", 99], ["billie-jean", "Billie Jean", 1983, "1983", 99],
      ["teen-spirit", "Smells Like Teen Spirit", 1991, "1991", 98], ["wonderwall", "Wonderwall", 1995, "1995", 97],
      ["crazy-love", "Crazy in Love", 2003, "2003", 98], ["rolling-deep", "Rolling in the Deep", 2010, "2010", 98],
      ["uptown-funk", "Uptown Funk", 2014, "2014", 99], ["blinding-lights", "Blinding Lights", 2019, "2019", 99]
    ])
  }),
  collection({
    id: "album-release-years", ballparkCategory: "Movies and entertainment", unit: "year",
    ballparkPromptTemplate: "In what year was the album {name} released?", sourceUrl: "https://www.grammy.com/",
    sourceLabel: "Recording Academy and label discographies", sourceSnapshot: VERIFIED,
    intuitiveEstimability: 84, entertainmentValue: 94, difficultyTier: "standard",
    order: { categoryFamily: "album-release-chronology", categoryLabel: "Music", title: "Albums by release date", playerPrompt: "Put these albums in release order, earliest to latest.", metric: "release year", direction: "lowest-to-highest" },
    facts: facts([
      ["elvis-album", "Elvis Presley by Elvis Presley", 1956, "1956", 92], ["sgt-pepper", "Sgt. Pepper's Lonely Hearts Club Band", 1967, "1967", 98],
      ["dark-side", "The Dark Side of the Moon", 1973, "1973", 98], ["rumours", "Rumours", 1977, "1977", 98],
      ["thriller", "Thriller", 1982, "1982", 99], ["purple-rain", "Purple Rain", 1984, "1984", 98],
      ["nevermind", "Nevermind", 1991, "1991", 98], ["ok-computer", "OK Computer", 1997, "1997", 94],
      ["adele-21", "21 by Adele", 2011, "2011", 98], ["taylor-1989", "1989 by Taylor Swift", 2014, "2014", 99]
    ])
  }),
  collection({
    id: "video-game-releases", ballparkCategory: "Movies and entertainment", unit: "year",
    ballparkPromptTemplate: "In what year was {name} first released?", sourceUrl: "https://www.museumofplay.org/",
    sourceLabel: "The Strong National Museum of Play", sourceSnapshot: VERIFIED,
    intuitiveEstimability: 86, entertainmentValue: 95, difficultyTier: "approachable",
    order: { categoryFamily: "video-game-release-chronology", categoryLabel: "Video games", title: "Video games by release date", playerPrompt: "Put these video games in release order, earliest to latest.", metric: "first release year", direction: "lowest-to-highest" },
    facts: facts([
      ["pong", "Pong", 1972, "1972", 97], ["space-invaders", "Space Invaders", 1978, "1978", 94],
      ["pac-man", "Pac-Man", 1980, "1980", 99], ["super-mario", "Super Mario Bros.", 1985, "1985", 99],
      ["zelda", "The Legend of Zelda", 1986, "1986", 98], ["sonic", "Sonic the Hedgehog", 1991, "1991", 97],
      ["doom", "Doom", 1993, "1993", 96], ["pokemon", "Pokemon Red and Green", 1996, "1996", 98],
      ["minecraft", "Minecraft", 2011, "2011", 99], ["fortnite", "Fortnite", 2017, "2017", 99]
    ])
  }),
  collection({
    id: "solar-system-diameters", ballparkCategory: "Astronomy", unit: "kilometers",
    ballparkPromptTemplate: "About how wide is {name}, in kilometers?", sourceUrl: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/",
    sourceLabel: "NASA planetary fact sheets", sourceSnapshot: VERIFIED,
    factualConfidence: 98, sourceQuality: 99, intuitiveEstimability: 84, entertainmentValue: 92,
    answerStability: 99, difficultyTier: "approachable",
    order: { categoryFamily: "space-astronomy", categoryLabel: "Astronomy", title: "Solar System worlds by diameter", playerPrompt: "Rank these Solar System worlds by diameter, largest to smallest.", metric: "mean diameter in kilometers", direction: "highest-to-lowest" },
    facts: facts([
      ["ceres-diameter", "Ceres", 939, "939 km", 79], ["pluto-diameter", "Pluto", 2377, "2,377 km", 94],
      ["mercury-diameter", "Mercury", 4879, "4,879 km", 97], ["mars-diameter", "Mars", 6779, "6,779 km", 99],
      ["venus-diameter", "Venus", 12104, "12,104 km", 98], ["earth-diameter", "Earth", 12756, "12,756 km", 99],
      ["neptune-diameter", "Neptune", 49528, "49,528 km", 96], ["uranus-diameter", "Uranus", 51118, "51,118 km", 96],
      ["saturn-diameter", "Saturn", 120536, "120,536 km", 99], ["jupiter-diameter", "Jupiter", 142984, "142,984 km", 99]
    ])
  }),
  collection({
    id: "distance-from-sun", ballparkCategory: "Astronomy", unit: "million kilometers",
    ballparkPromptTemplate: "About how far is {name} from the Sun, in millions of kilometers?", sourceUrl: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/",
    sourceLabel: "NASA planetary fact sheets", sourceSnapshot: VERIFIED,
    factualConfidence: 98, sourceQuality: 99, intuitiveEstimability: 76, entertainmentValue: 91,
    answerStability: 99, difficultyTier: "standard",
    order: { categoryFamily: "space-astronomy", categoryLabel: "Astronomy", title: "Solar System objects by distance from the Sun", playerPrompt: "Rank these objects by average distance from the Sun, farthest to nearest.", metric: "average orbital distance in millions of kilometers", direction: "highest-to-lowest" },
    facts: facts([
      ["mercury-distance", "Mercury", 57.9, "57.9 million km", 97], ["venus-distance", "Venus", 108.2, "108.2 million km", 98],
      ["earth-distance", "Earth", 149.6, "149.6 million km", 99], ["mars-distance", "Mars", 227.9, "227.9 million km", 99],
      ["ceres-distance", "Ceres", 413.7, "413.7 million km", 79], ["jupiter-distance", "Jupiter", 778.6, "778.6 million km", 99],
      ["saturn-distance", "Saturn", 1433.5, "1,433.5 million km", 99], ["uranus-distance", "Uranus", 2872.5, "2,872.5 million km", 96],
      ["neptune-distance", "Neptune", 4495.1, "4,495.1 million km", 96], ["pluto-distance", "Pluto", 5906.4, "5,906.4 million km", 94]
    ])
  }),
  collection({
    id: "orbital-periods", ballparkCategory: "Astronomy", unit: "Earth days",
    ballparkPromptTemplate: "About how many Earth days does {name} take to orbit the Sun?", sourceUrl: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/",
    sourceLabel: "NASA planetary fact sheets", sourceSnapshot: VERIFIED,
    factualConfidence: 98, sourceQuality: 99, intuitiveEstimability: 73, entertainmentValue: 89,
    answerStability: 99, difficultyTier: "standard",
    order: { categoryFamily: "space-astronomy", categoryLabel: "Astronomy", title: "Solar System objects by orbital period", playerPrompt: "Rank these objects by orbital period, longest to shortest.", metric: "orbital period in Earth days", direction: "highest-to-lowest" },
    facts: facts([
      ["mercury-orbit", "Mercury", 88, "88 days", 97], ["venus-orbit", "Venus", 225, "225 days", 98],
      ["earth-orbit", "Earth", 365.25, "365.25 days", 99], ["mars-orbit", "Mars", 687, "687 days", 99],
      ["ceres-orbit", "Ceres", 1682, "1,682 days", 79], ["jupiter-orbit", "Jupiter", 4333, "4,333 days", 99],
      ["saturn-orbit", "Saturn", 10759, "10,759 days", 99], ["uranus-orbit", "Uranus", 30687, "30,687 days", 96],
      ["neptune-orbit", "Neptune", 60190, "60,190 days", 96], ["pluto-orbit", "Pluto", 90560, "90,560 days", 94]
    ])
  }),
  collection({
    id: "moon-diameters", ballparkCategory: "Astronomy", unit: "kilometers",
    ballparkPromptTemplate: "About how wide is {name}, in kilometers?", sourceUrl: "https://science.nasa.gov/solar-system/moons/",
    sourceLabel: "NASA Solar System Exploration moon profiles", sourceSnapshot: VERIFIED,
    factualConfidence: 98, sourceQuality: 99, intuitiveEstimability: 68, entertainmentValue: 87,
    answerStability: 99, difficultyTier: "challenging",
    order: { categoryFamily: "space-astronomy", categoryLabel: "Astronomy", title: "Well-known moons by diameter", playerPrompt: "Rank these moons by diameter, largest to smallest.", metric: "mean diameter in kilometers", direction: "highest-to-lowest" },
    facts: facts([
      ["phobos", "Phobos", 22.5, "22.5 km", 74], ["enceladus", "Enceladus", 504, "504 km", 76],
      ["charon", "Charon", 1212, "1,212 km", 78], ["triton", "Triton", 2707, "2,707 km", 79],
      ["europa", "Europa", 3122, "3,122 km", 88], ["earth-moon", "the Moon", 3475, "3,475 km", 99],
      ["io", "Io", 3643, "3,643 km", 84], ["callisto", "Callisto", 4821, "4,821 km", 82],
      ["titan", "Titan", 5150, "5,150 km", 89], ["ganymede", "Ganymede", 5268, "5,268 km", 87]
    ])
  }),
  collection({
    id: "space-milestones", ballparkCategory: "Astronomy", unit: "year",
    ballparkPromptTemplate: "What year marked {name}?", sourceUrl: "https://history.nasa.gov/",
    sourceLabel: "NASA History Office", sourceSnapshot: VERIFIED,
    factualConfidence: 99, sourceQuality: 99, intuitiveEstimability: 86, entertainmentValue: 95,
    answerStability: 99, difficultyTier: "approachable",
    order: { categoryFamily: "space-astronomy", categoryLabel: "Astronomy", title: "Space milestones by date", playerPrompt: "Put these space milestones in order, earliest to latest.", metric: "event year", direction: "lowest-to-highest" },
    facts: facts([
      ["sputnik", "Sputnik 1's launch", 1957, "1957", 98], ["yuri", "Yuri Gagarin's first human spaceflight", 1961, "1961", 97],
      ["apollo-11", "Apollo 11's Moon landing", 1969, "1969", 99], ["pioneer-jupiter", "Pioneer 10's Jupiter flyby", 1973, "1973", 82],
      ["viking", "Viking 1's Mars landing", 1976, "1976", 88], ["voyager-neptune", "Voyager 2's Neptune flyby", 1989, "1989", 83],
      ["hubble", "the Hubble Space Telescope's launch", 1990, "1990", 98], ["iss-module", "the first ISS module's launch", 1998, "1998", 92],
      ["curiosity", "the Curiosity rover's Mars landing", 2012, "2012", 96], ["jwst", "the James Webb Space Telescope's launch", 2021, "2021", 97]
    ])
  }),
  collection({
    id: "animal-running-speeds", ballparkCategory: "Animals", unit: "miles per hour",
    ballparkPromptTemplate: "About how fast can {name} run, in miles per hour?", sourceUrl: "https://animals.sandiegozoo.org/",
    sourceLabel: "San Diego Zoo Wildlife Alliance animal profiles", sourceSnapshot: "Rounded documented top speeds reviewed 2026-07-12",
    factualConfidence: 90, sourceQuality: 92, intuitiveEstimability: 87, entertainmentValue: 94,
    answerStability: 82, difficultyTier: "approachable",
    order: { categoryFamily: "animal-size-speed", categoryLabel: "Animals", title: "Animals by running speed", playerPrompt: "Rank these animals by top running speed, fastest to slowest.", metric: "documented top speed in miles per hour", direction: "highest-to-lowest" },
    facts: facts([
      ["elephant-speed", "an elephant", 25, "25 mph", 96], ["human-speed", "the fastest human sprinter", 28, "about 28 mph", 99],
      ["grizzly-speed", "a grizzly bear", 30, "30 mph", 93], ["coyote-speed", "a coyote", 35, "35 mph", 89],
      ["quarter-horse-speed", "a quarter horse", 40, "40 mph", 94], ["ostrich-speed", "an ostrich", 43, "43 mph", 94],
      ["greyhound-speed", "a greyhound", 45, "45 mph", 93], ["lion-speed", "a lion", 50, "50 mph", 98],
      ["pronghorn-speed", "a pronghorn", 55, "55 mph", 84], ["cheetah-speed", "a cheetah", 70, "70 mph", 99]
    ])
  }),
  collection({
    id: "animal-weights", ballparkCategory: "Animals", unit: "kilograms",
    ballparkPromptTemplate: "About how much can an adult {name} weigh, in kilograms?", sourceUrl: "https://animals.sandiegozoo.org/",
    sourceLabel: "San Diego Zoo Wildlife Alliance animal profiles", sourceSnapshot: "Representative adult weights reviewed 2026-07-12",
    factualConfidence: 88, sourceQuality: 92, intuitiveEstimability: 84, entertainmentValue: 91,
    answerStability: 76, difficultyTier: "standard",
    order: { categoryFamily: "animal-size-speed", categoryLabel: "Animals", title: "Animals by adult weight", playerPrompt: "Rank these animals by typical adult weight, heaviest to lightest.", metric: "representative adult weight in kilograms", direction: "highest-to-lowest" },
    facts: facts([
      ["cat-weight", "house cat", 4.5, "4.5 kg", 99], ["beaver-weight", "beaver", 25, "25 kg", 87],
      ["wolf-weight", "gray wolf", 45, "45 kg", 94], ["panda-weight", "giant panda", 100, "100 kg", 97],
      ["lion-weight", "lion", 190, "190 kg", 98], ["polar-weight", "polar bear", 450, "450 kg", 98],
      ["giraffe-weight", "giraffe", 1200, "1,200 kg", 98], ["hippo-weight", "hippopotamus", 3200, "3,200 kg", 97],
      ["elephant-weight", "African elephant", 6000, "6,000 kg", 99], ["blue-whale-weight", "blue whale", 120000, "120,000 kg", 99]
    ])
  }),
  collection({
    id: "animal-gestation", ballparkCategory: "Animals", unit: "days",
    ballparkPromptTemplate: "About how long is a {name}'s pregnancy, in days?", sourceUrl: "https://www.merckvetmanual.com/",
    sourceLabel: "Merck Veterinary Manual reproductive tables", sourceSnapshot: VERIFIED,
    factualConfidence: 94, sourceQuality: 97, intuitiveEstimability: 73, entertainmentValue: 87,
    answerStability: 88, difficultyTier: "challenging",
    order: { categoryFamily: "animal-size-speed", categoryLabel: "Animals", title: "Animals by gestation length", playerPrompt: "Rank these animals by gestation length, longest to shortest.", metric: "typical gestation in days", direction: "highest-to-lowest" },
    facts: facts([
      ["mouse-gestation", "mouse", 20, "20 days", 88], ["rabbit-gestation", "rabbit", 31, "31 days", 93],
      ["dog-gestation", "dog", 63, "63 days", 99], ["cat-gestation", "cat", 65, "65 days", 99],
      ["pig-gestation", "pig", 114, "114 days", 92], ["sheep-gestation", "sheep", 152, "152 days", 88],
      ["cow-gestation", "cow", 283, "283 days", 95], ["horse-gestation", "horse", 340, "340 days", 97],
      ["giraffe-gestation", "giraffe", 450, "450 days", 96], ["elephant-gestation", "elephant", 645, "645 days", 99]
    ])
  }),
  collection({
    id: "bird-wingspans", ballparkCategory: "Animals", unit: "centimeters",
    ballparkPromptTemplate: "About how wide is the typical wingspan of {name}, in centimeters?", sourceUrl: "https://www.allaboutbirds.org/guide/",
    sourceLabel: "Cornell Lab of Ornithology bird guide", sourceSnapshot: "Representative adult wingspans reviewed 2026-07-12",
    factualConfidence: 91, sourceQuality: 96, intuitiveEstimability: 78, entertainmentValue: 88,
    answerStability: 82, difficultyTier: "standard",
    order: { categoryFamily: "animal-size-speed", categoryLabel: "Animals", title: "Birds by wingspan", playerPrompt: "Rank these birds by typical wingspan, widest to narrowest.", metric: "representative wingspan in centimeters", direction: "highest-to-lowest" },
    facts: facts([
      ["robin-span", "American robins", 35, "35 cm", 91], ["pigeon-span", "rock pigeons", 68, "68 cm", 92],
      ["barn-owl-span", "barn owls", 110, "110 cm", 93], ["raven-span", "common ravens", 116, "116 cm", 92],
      ["redtail-span", "red-tailed hawks", 125, "125 cm", 91], ["goose-span", "Canada geese", 170, "170 cm", 94],
      ["heron-span", "great blue herons", 183, "183 cm", 90], ["eagle-span", "bald eagles", 213, "213 cm", 98],
      ["condor-span", "Andean condors", 300, "300 cm", 87], ["albatross-span", "wandering albatrosses", 350, "350 cm", 88]
    ])
  }),
  collection({
    id: "animal-lifespans", ballparkCategory: "Animals", unit: "years",
    ballparkPromptTemplate: "About how many years can a {name} live?", sourceUrl: BRITANNICA,
    sourceLabel: "Encyclopaedia Britannica animal profiles", sourceSnapshot: "Rounded representative lifespans reviewed 2026-07-12",
    factualConfidence: 86, sourceQuality: 90, intuitiveEstimability: 80, entertainmentValue: 91,
    answerStability: 72, difficultyTier: "standard",
    order: { categoryFamily: "animal-size-speed", categoryLabel: "Animals", title: "Animals by lifespan", playerPrompt: "Rank these animals by representative lifespan, longest to shortest.", metric: "representative lifespan in years", direction: "highest-to-lowest" },
    facts: facts([
      ["hamster-life", "hamster", 3, "3 years", 92], ["rabbit-life", "rabbit", 9, "9 years", 93],
      ["dog-life", "dog", 12, "12 years", 99], ["lion-life", "lion", 15, "15 years", 98],
      ["giraffe-life", "giraffe", 25, "25 years", 96], ["horse-life", "horse", 30, "30 years", 97],
      ["macaw-life", "macaw", 50, "50 years", 89], ["elephant-life", "African elephant", 65, "65 years", 99],
      ["tortoise-life", "Galapagos giant tortoise", 100, "100 years", 94], ["bowhead-life", "bowhead whale", 200, "200 years", 80]
    ])
  }),
  collection({
    id: "us-state-areas", ballparkCategory: "Geography", unit: "square miles",
    ballparkPromptTemplate: "About how large is {name}, in square miles?", sourceUrl: "https://www.census.gov/geographies/reference-files/2010/geo/state-area.html",
    sourceLabel: "U.S. Census Bureau state area measurements", sourceSnapshot: VERIFIED,
    factualConfidence: 98, sourceQuality: 99, intuitiveEstimability: 82, entertainmentValue: 84,
    answerStability: 99, difficultyTier: "standard",
    order: { categoryFamily: "geographic-size-distance", categoryLabel: "Geography", title: "U.S. states by area", playerPrompt: "Rank these U.S. states by area, largest to smallest.", metric: "total area in square miles", direction: "highest-to-lowest" },
    facts: facts([
      ["wyoming-area", "Wyoming", 97813, "97,813 sq mi", 84], ["oregon-area", "Oregon", 98379, "98,379 sq mi", 91],
      ["colorado-area", "Colorado", 104094, "104,094 sq mi", 94], ["nevada-area", "Nevada", 110572, "110,572 sq mi", 91],
      ["arizona-area", "Arizona", 113990, "113,990 sq mi", 95], ["new-mexico-area", "New Mexico", 121590, "121,590 sq mi", 89],
      ["montana-area", "Montana", 147040, "147,040 sq mi", 90], ["california-area", "California", 163695, "163,695 sq mi", 99],
      ["texas-area", "Texas", 268596, "268,596 sq mi", 99], ["alaska-area", "Alaska", 665384, "665,384 sq mi", 99]
    ])
  }),
  collection({
    id: "island-areas", ballparkCategory: "Geography", unit: "square kilometers",
    ballparkPromptTemplate: "About how large is {name}, in square kilometers?", sourceUrl: BRITANNICA,
    sourceLabel: "Encyclopaedia Britannica island profiles", sourceSnapshot: VERIFIED,
    factualConfidence: 92, sourceQuality: 91, intuitiveEstimability: 69, entertainmentValue: 80,
    answerStability: 96, difficultyTier: "challenging",
    order: { categoryFamily: "geographic-size-distance", categoryLabel: "Geography", title: "Large islands by area", playerPrompt: "Rank these islands by area, largest to smallest.", metric: "area in square kilometers", direction: "highest-to-lowest" },
    facts: facts([
      ["ellesmere", "Ellesmere Island", 196236, "196,236 km²", 72], ["great-britain", "Great Britain", 209331, "209,331 km²", 98],
      ["victoria-island", "Victoria Island", 217291, "217,291 km²", 72], ["honshu", "Honshu", 225800, "225,800 km²", 87],
      ["sumatra", "Sumatra", 473481, "473,481 km²", 88], ["baffin", "Baffin Island", 507451, "507,451 km²", 78],
      ["madagascar-island", "Madagascar", 587041, "587,041 km²", 96], ["borneo", "Borneo", 748168, "748,168 km²", 92],
      ["new-guinea", "New Guinea", 785753, "785,753 km²", 90], ["greenland", "Greenland", 2166086, "2,166,086 km²", 99]
    ])
  }),
  collection({
    id: "lake-areas", ballparkCategory: "Geography", unit: "square kilometers",
    ballparkPromptTemplate: "About how large is {name}, in square kilometers?", sourceUrl: "https://www.usgs.gov/programs/water-resources/science/lakes-and-reservoirs",
    sourceLabel: "USGS water resources and Encyclopaedia Britannica lake profiles", sourceSnapshot: VERIFIED,
    factualConfidence: 91, sourceQuality: 94, intuitiveEstimability: 68, entertainmentValue: 79,
    answerStability: 93, difficultyTier: "challenging",
    order: { categoryFamily: "geographic-size-distance", categoryLabel: "Geography", title: "Major lakes by surface area", playerPrompt: "Rank these major lakes by surface area, largest to smallest.", metric: "surface area in square kilometers", direction: "highest-to-lowest" },
    facts: facts([
      ["great-slave", "Great Slave Lake", 27200, "27,200 km²", 74], ["lake-malawi", "Lake Malawi", 29600, "29,600 km²", 78],
      ["great-bear", "Great Bear Lake", 31153, "31,153 km²", 72], ["baikal", "Lake Baikal", 31500, "31,500 km²", 91],
      ["tanganyika", "Lake Tanganyika", 32900, "32,900 km²", 84], ["michigan", "Lake Michigan", 58000, "58,000 km²", 96],
      ["huron", "Lake Huron", 59600, "59,600 km²", 92], ["victoria-lake", "Lake Victoria", 68870, "68,870 km²", 93],
      ["superior", "Lake Superior", 82100, "82,100 km²", 98], ["caspian", "Caspian Sea", 371000, "371,000 km²", 96]
    ])
  }),
  collection({
    id: "aircraft-first-flights", ballparkCategory: "Transportation", unit: "year",
    ballparkPromptTemplate: "What year was {name}'s first flight?", sourceUrl: "https://airandspace.si.edu/collection-objects",
    sourceLabel: "Smithsonian National Air and Space Museum collection", sourceSnapshot: VERIFIED,
    factualConfidence: 97, sourceQuality: 99, intuitiveEstimability: 79, entertainmentValue: 89,
    answerStability: 99, difficultyTier: "standard",
    order: { categoryFamily: "technology-milestones", categoryLabel: "Transportation", title: "Aircraft by first flight", playerPrompt: "Put these aircraft in first-flight order, earliest to latest.", metric: "first flight year", direction: "lowest-to-highest" },
    facts: facts([
      ["wright-flyer", "the Wright Flyer", 1903, "1903", 99], ["spirit-st-louis", "the Spirit of St. Louis", 1927, "1927", 93],
      ["dc3", "Douglas DC-3", 1935, "1935", 90], ["spitfire", "Supermarine Spitfire", 1936, "1936", 94],
      ["bell-x1", "Bell X-1", 1946, "1946", 91], ["boeing-707", "Boeing 707", 1957, "1957", 91],
      ["concorde", "Concorde", 1969, "1969", 98], ["enterprise", "Space Shuttle Enterprise", 1977, "1977", 91],
      ["b2", "B-2 Spirit", 1989, "1989", 91], ["a380", "Airbus A380", 2005, "2005", 94]
    ])
  }),
  collection({
    id: "iconic-car-debuts", ballparkCategory: "Transportation", unit: "year",
    ballparkPromptTemplate: "In what year did the {name} debut?", sourceUrl: "https://www.hagerty.com/media/automotive-history/",
    sourceLabel: "Hagerty automotive history and manufacturer archives", sourceSnapshot: VERIFIED,
    factualConfidence: 93, sourceQuality: 90, intuitiveEstimability: 83, entertainmentValue: 91,
    answerStability: 98, difficultyTier: "standard",
    order: { categoryFamily: "technology-milestones", categoryLabel: "Transportation", title: "Iconic cars by debut", playerPrompt: "Put these iconic cars in debut order, earliest to latest.", metric: "debut year", direction: "lowest-to-highest" },
    facts: facts([
      ["model-t", "Ford Model T", 1908, "1908", 99], ["beetle", "Volkswagen Beetle", 1938, "1938", 98],
      ["jeep", "Willys Jeep", 1941, "1941", 96], ["corvette", "Chevrolet Corvette", 1953, "1953", 98],
      ["mini", "original Mini", 1959, "1959", 96], ["mustang", "Ford Mustang", 1964, "1964", 99],
      ["civic", "Honda Civic", 1972, "1972", 95], ["delorean", "DeLorean DMC-12", 1981, "1981", 96],
      ["miata", "Mazda MX-5 Miata", 1989, "1989", 92], ["tesla-roadster", "Tesla Roadster", 2008, "2008", 95]
    ])
  }),
  collection({
    id: "subway-openings", ballparkCategory: "Transportation", unit: "year",
    ballparkPromptTemplate: "In what year did the {name} subway system open?", sourceUrl: "https://www.uitp.org/",
    sourceLabel: "International Association of Public Transport histories", sourceSnapshot: VERIFIED,
    factualConfidence: 95, sourceQuality: 95, intuitiveEstimability: 72, entertainmentValue: 82,
    answerStability: 99, difficultyTier: "challenging",
    order: { categoryFamily: "technology-milestones", categoryLabel: "Transportation", title: "Subway systems by opening date", playerPrompt: "Put these subway systems in opening order, earliest to latest.", metric: "opening year", direction: "lowest-to-highest" },
    facts: facts([
      ["london-underground", "London", 1863, "1863", 99], ["budapest-metro", "Budapest", 1896, "1896", 79],
      ["paris-metro", "Paris", 1900, "1900", 97], ["nyc-subway", "New York City", 1904, "1904", 99],
      ["buenos-subte", "Buenos Aires", 1913, "1913", 82], ["tokyo-metro", "Tokyo", 1927, "1927", 98],
      ["moscow-metro", "Moscow", 1935, "1935", 94], ["toronto-subway", "Toronto", 1954, "1954", 91],
      ["mexico-metro", "Mexico City", 1969, "1969", 90], ["dubai-metro", "Dubai", 2009, "2009", 93]
    ])
  }),
  collection({
    id: "famous-ship-launches", ballparkCategory: "Transportation", unit: "year",
    ballparkPromptTemplate: "In what year was {name} launched?", sourceUrl: "https://www.rmg.co.uk/collections",
    sourceLabel: "Royal Museums Greenwich and naval museum collections", sourceSnapshot: VERIFIED,
    factualConfidence: 95, sourceQuality: 96, intuitiveEstimability: 76, entertainmentValue: 87,
    answerStability: 99, difficultyTier: "standard",
    order: { categoryFamily: "technology-milestones", categoryLabel: "Transportation", title: "Famous ships by launch date", playerPrompt: "Put these famous ships in launch order, earliest to latest.", metric: "launch year", direction: "lowest-to-highest" },
    facts: facts([
      ["cutty-sark", "Cutty Sark", 1869, "1869", 87], ["titanic-launch", "RMS Titanic", 1911, "1911", 99],
      ["uss-arizona", "USS Arizona", 1915, "1915", 90], ["queen-mary", "RMS Queen Mary", 1934, "1934", 92],
      ["bismarck", "Bismarck", 1939, "1939", 91], ["uss-missouri", "USS Missouri", 1944, "1944", 92],
      ["nautilus", "USS Nautilus", 1954, "1954", 89], ["qe2", "Queen Elizabeth 2", 1967, "1967", 91],
      ["voyager-seas", "Voyager of the Seas", 1998, "1998", 80], ["queen-mary-2", "Queen Mary 2", 2003, "2003", 88]
    ])
  }),
  collection({
    id: "rail-milestones", ballparkCategory: "Transportation", unit: "year",
    ballparkPromptTemplate: "What year marked {name}?", sourceUrl: "https://www.railwaymuseum.org.uk/objects-and-stories",
    sourceLabel: "National Railway Museum and operator histories", sourceSnapshot: VERIFIED,
    factualConfidence: 94, sourceQuality: 96, intuitiveEstimability: 73, entertainmentValue: 84,
    answerStability: 98, difficultyTier: "challenging",
    order: { categoryFamily: "technology-milestones", categoryLabel: "Transportation", title: "Rail milestones by date", playerPrompt: "Put these rail milestones in order, earliest to latest.", metric: "milestone year", direction: "lowest-to-highest" },
    facts: facts([
      ["stockton-darlington", "the opening of the Stockton and Darlington Railway", 1825, "1825", 74], ["liverpool-manchester", "the opening of the Liverpool and Manchester Railway", 1830, "1830", 76],
      ["transcontinental", "the First Transcontinental Railroad's completion", 1869, "1869", 95], ["orient-express", "the Orient Express's first service", 1883, "1883", 93],
      ["trans-siberian", "the Trans-Siberian Railway's completion", 1916, "1916", 90], ["shinkansen", "the Tokaido Shinkansen's opening", 1964, "1964", 94],
      ["amtrak", "Amtrak's first service", 1971, "1971", 88], ["tgv", "the TGV's first public service", 1981, "1981", 92],
      ["eurostar", "Eurostar's first service", 1994, "1994", 94], ["shanghai-maglev", "the Shanghai Maglev's commercial opening", 2004, "2004", 85]
    ])
  }),
  collection({
    id: "human-bone-counts", ballparkCategory: "Human body", unit: "bones",
    ballparkPromptTemplate: "How many bones are in {name}?", sourceUrl: "https://my.clevelandclinic.org/health/body/25176-skeletal-system",
    sourceLabel: "Cleveland Clinic skeletal system reference", sourceSnapshot: VERIFIED,
    factualConfidence: 96, sourceQuality: 96, intuitiveEstimability: 92, entertainmentValue: 90,
    answerStability: 98, difficultyTier: "approachable", order: undefined,
    facts: facts([
      ["adult-bones", "an adult human body", 206, "206 bones", 99], ["hand-bones", "one human hand", 27, "27 bones", 98],
      ["foot-bones", "one human foot", 26, "26 bones", 98], ["skull-bones", "the human skull", 22, "22 bones", 96],
      ["facial-bones", "the human face", 14, "14 bones", 90], ["wrist-bones", "one human wrist", 8, "8 bones", 94],
      ["ankle-bones", "one human ankle", 7, "7 bones", 92], ["ear-bones", "one middle ear", 3, "3 bones", 94],
      ["arm-bones", "one human arm from shoulder to wrist", 3, "3 long bones", 96], ["leg-bones", "one human leg including the kneecap", 4, "4 bones", 96]
    ])
  }),
  collection({
    id: "organ-weights", ballparkCategory: "Human body", unit: "grams",
    ballparkPromptTemplate: "About how much does {name} weigh, in grams?", sourceUrl: "https://www.ncbi.nlm.nih.gov/books/",
    sourceLabel: "NIH National Library of Medicine anatomy references", sourceSnapshot: "Representative healthy adult measurements reviewed 2026-07-12",
    factualConfidence: 89, sourceQuality: 97, intuitiveEstimability: 77, entertainmentValue: 87,
    answerStability: 74, difficultyTier: "standard", order: undefined,
    facts: facts([
      ["pituitary-weight", "the pituitary gland", 0.5, "0.5 g", 82], ["thyroid-weight", "the thyroid gland", 20, "20 g", 88],
      ["pancreas-weight", "the pancreas", 90, "90 g", 86], ["kidney-weight", "one kidney", 150, "150 g", 91],
      ["spleen-weight", "the spleen", 170, "170 g", 84], ["heart-weight", "the heart", 300, "300 g", 98],
      ["lungs-weight", "both lungs together", 1000, "about 1,000 g", 94], ["brain-weight", "the adult brain", 1400, "about 1,400 g", 99],
      ["liver-weight", "the adult liver", 1500, "about 1,500 g", 94], ["skin-weight", "an adult's skin", 3600, "about 3,600 g", 91]
    ])
  }),
  collection({
    id: "body-part-lengths", ballparkCategory: "Human body", unit: "centimeters",
    ballparkPromptTemplate: "About how long is {name}, in centimeters?", sourceUrl: "https://www.ncbi.nlm.nih.gov/books/",
    sourceLabel: "NIH National Library of Medicine anatomy references", sourceSnapshot: "Representative healthy adult measurements reviewed 2026-07-12",
    factualConfidence: 88, sourceQuality: 97, intuitiveEstimability: 83, entertainmentValue: 84,
    answerStability: 72, difficultyTier: "standard", order: undefined,
    facts: facts([
      ["ear-canal-length", "the adult ear canal", 2.5, "2.5 cm", 88], ["optic-nerve-length", "the human optic nerve", 5, "about 5 cm", 82],
      ["trachea-length", "the adult trachea", 11, "about 11 cm", 88], ["male-urethra", "the adult male urethra", 20, "about 20 cm", 80],
      ["esophagus-length", "the adult esophagus", 25, "about 25 cm", 92], ["spinal-cord-length", "the adult spinal cord", 45, "about 45 cm", 91],
      ["large-intestine", "the large intestine", 150, "about 150 cm", 97], ["small-intestine", "the small intestine", 600, "about 600 cm", 98],
      ["adult-humerus", "an adult humerus", 36, "about 36 cm", 89], ["adult-femur", "an adult femur", 48, "about 48 cm", 94]
    ])
  }),
  collection({
    id: "daily-body-activity", ballparkCategory: "Human body", unit: "count",
    ballparkPromptTemplate: "{name}", sourceUrl: "https://my.clevelandclinic.org/health/body",
    sourceLabel: "Cleveland Clinic body-system explainers", sourceSnapshot: "Rounded healthy-adult estimates reviewed 2026-07-12",
    factualConfidence: 86, sourceQuality: 95, intuitiveEstimability: 91, entertainmentValue: 93,
    answerStability: 70, difficultyTier: "approachable", order: undefined,
    facts: [
      { id: "heartbeats-day", label: "heartbeats per day", value: 100000, displayValue: "about 100,000 beats", familiarity: 99, unit: "heartbeats", ballparkPrompt: "About how many times does an average adult heart beat in one day?" },
      { id: "breaths-day", label: "breaths per day", value: 22000, displayValue: "about 22,000 breaths", familiarity: 98, unit: "breaths", ballparkPrompt: "About how many breaths does an adult take in one day?" },
      { id: "blinks-day", label: "blinks per day", value: 15000, displayValue: "about 15,000 blinks", familiarity: 93, unit: "blinks", ballparkPrompt: "About how many times does a person blink in one day?" },
      { id: "blood-pumped-day", label: "blood pumped per day", value: 7500, displayValue: "about 7,500 liters", familiarity: 94, unit: "liters", ballparkPrompt: "About how many liters of blood does the heart pump in one day?" },
      { id: "air-breathed-day", label: "air breathed per day", value: 11000, displayValue: "about 11,000 liters", familiarity: 89, unit: "liters", ballparkPrompt: "About how many liters of air does an adult breathe in one day?" },
      { id: "saliva-day", label: "saliva made per day", value: 1.5, displayValue: "about 1.5 liters", familiarity: 92, unit: "liters", ballparkPrompt: "About how many liters of saliva does an adult make in one day?" },
      { id: "skin-cells-hour", label: "skin cells shed per hour", value: 200000000, displayValue: "about 200 million cells", familiarity: 85, unit: "skin cells", ballparkPrompt: "About how many skin cells can a person shed in one hour?" },
      { id: "red-cells-second", label: "red blood cells made per second", value: 2000000, displayValue: "about 2 million cells", familiarity: 91, unit: "red blood cells", ballparkPrompt: "About how many red blood cells does the body make each second?" },
      { id: "hair-growth-month", label: "hair growth per month", value: 1.25, displayValue: "about 1.25 centimeters", familiarity: 91, unit: "centimeters", ballparkPrompt: "About how many centimeters does scalp hair grow in one month?" },
      { id: "nail-growth-month", label: "fingernail growth per month", value: 3.5, displayValue: "about 3.5 millimeters", familiarity: 88, unit: "millimeters", ballparkPrompt: "About how many millimeters does a fingernail grow in one month?" }
    ]
  }),
  collection({
    id: "body-numbers", ballparkCategory: "Human body", unit: "count",
    ballparkPromptTemplate: "{name}", sourceUrl: "https://www.ncbi.nlm.nih.gov/books/",
    sourceLabel: "NIH National Library of Medicine human biology references", sourceSnapshot: VERIFIED,
    factualConfidence: 90, sourceQuality: 97, intuitiveEstimability: 91, entertainmentValue: 92,
    answerStability: 86, difficultyTier: "approachable", order: undefined,
    facts: [
      { id: "adult-teeth", label: "adult teeth", value: 32, displayValue: "32 teeth", familiarity: 99, unit: "teeth", ballparkPrompt: "How many teeth does a typical adult have, including wisdom teeth?" },
      { id: "rib-count", label: "human ribs", value: 24, displayValue: "24 ribs", familiarity: 99, unit: "ribs", ballparkPrompt: "How many ribs does a typical human have?" },
      { id: "chromosome-count", label: "human chromosomes", value: 46, displayValue: "46 chromosomes", familiarity: 98, unit: "chromosomes", ballparkPrompt: "How many chromosomes are in a typical human body cell?" },
      { id: "blood-types", label: "common ABO/Rh blood types", value: 8, displayValue: "8 common types", familiarity: 97, unit: "blood types", ballparkPrompt: "How many common blood types are there when ABO groups and positive or negative Rh factor are combined?" },
      { id: "taste-buds", label: "taste buds", value: 10000, displayValue: "about 10,000", familiarity: 93, unit: "taste buds", ballparkPrompt: "About how many taste buds does an adult have?" },
      { id: "head-hairs", label: "scalp hairs", value: 100000, displayValue: "about 100,000 hairs", familiarity: 96, unit: "hairs", ballparkPrompt: "About how many hairs are on the average human scalp?" },
      { id: "muscle-count", label: "skeletal muscles", value: 600, displayValue: "more than 600", familiarity: 96, unit: "muscles", ballparkPrompt: "Roughly how many muscles are in the human body?" },
      { id: "sweat-glands", label: "sweat glands", value: 3000000, displayValue: "about 3 million", familiarity: 88, unit: "sweat glands", ballparkPrompt: "About how many sweat glands does the human body have?" },
      { id: "neurons", label: "brain neurons", value: 86000000000, displayValue: "about 86 billion", familiarity: 96, unit: "neurons", ballparkPrompt: "About how many neurons are in the human brain?" },
      { id: "red-blood-cells", label: "red blood cells", value: 25000000000000, displayValue: "about 25 trillion", familiarity: 91, unit: "red blood cells", ballparkPrompt: "About how many red blood cells are in an adult human body?" }
    ]
  }),
  collection({
    id: "consumer-tech-releases", ballparkCategory: "Technology", unit: "year",
    ballparkPromptTemplate: "In what year was {name} released?", sourceUrl: "https://www.computerhistory.org/timeline/",
    sourceLabel: "Computer History Museum timeline and manufacturer histories", sourceSnapshot: VERIFIED,
    factualConfidence: 96, sourceQuality: 97, intuitiveEstimability: 89, entertainmentValue: 91,
    answerStability: 99, difficultyTier: "approachable",
    order: { categoryFamily: "technology-milestones", categoryLabel: "Technology", title: "Consumer technology by release date", playerPrompt: "Put these technology products in release order, earliest to latest.", metric: "release year", direction: "lowest-to-highest" },
    facts: facts([
      ["macintosh", "Apple Macintosh", 1984, "1984", 97], ["windows-one", "Windows 1.0", 1985, "1985", 93],
      ["game-boy-tech", "Nintendo Game Boy", 1989, "1989", 98], ["playstation-tech", "original PlayStation", 1994, "1994", 99],
      ["dvd", "DVD", 1996, "1996", 97], ["ipod", "Apple iPod", 2001, "2001", 99],
      ["gmail", "Gmail", 2004, "2004", 98], ["iphone", "Apple iPhone", 2007, "2007", 99],
      ["ipad", "Apple iPad", 2010, "2010", 99], ["apple-watch", "Apple Watch", 2015, "2015", 97]
    ])
  }),
  collection({
    id: "programming-language-debuts", ballparkCategory: "Technology", unit: "year",
    ballparkPromptTemplate: "In what year did {name} first appear?", sourceUrl: "https://www.computerhistory.org/timeline/software-languages/",
    sourceLabel: "Computer History Museum software and language timeline", sourceSnapshot: VERIFIED,
    factualConfidence: 95, sourceQuality: 97, intuitiveEstimability: 68, entertainmentValue: 80,
    answerStability: 97, difficultyTier: "challenging",
    order: { categoryFamily: "technology-milestones", categoryLabel: "Technology", title: "Programming languages by debut", playerPrompt: "Put these programming languages in debut order, earliest to latest.", metric: "first public appearance year", direction: "lowest-to-highest" },
    facts: facts([
      ["fortran", "Fortran", 1957, "1957", 88], ["cobol", "COBOL", 1959, "1959", 85],
      ["basic", "BASIC", 1964, "1964", 88], ["c-language", "C", 1972, "1972", 97],
      ["sql", "SQL", 1974, "1974", 93], ["cpp", "C++", 1985, "1985", 97],
      ["python", "Python", 1991, "1991", 99], ["java", "Java", 1995, "1995", 99],
      ["csharp", "C#", 2000, "2000", 96], ["rust", "Rust", 2010, "2010", 94]
    ])
  }),
  collection({
    id: "game-console-releases", ballparkCategory: "Technology", unit: "year",
    ballparkPromptTemplate: "In what year was {name} released in North America?", sourceUrl: "https://www.museumofplay.org/",
    sourceLabel: "The Strong National Museum of Play console collection", sourceSnapshot: VERIFIED,
    factualConfidence: 96, sourceQuality: 96, intuitiveEstimability: 90, entertainmentValue: 95,
    answerStability: 99, difficultyTier: "approachable",
    order: { categoryFamily: "video-game-release-chronology", categoryLabel: "Video games", title: "Game consoles by release date", playerPrompt: "Put these game consoles in North American release order, earliest to latest.", metric: "North American release year", direction: "lowest-to-highest" },
    facts: facts([
      ["atari-2600", "Atari 2600", 1977, "1977", 96], ["nes", "Nintendo Entertainment System", 1985, "1985", 99],
      ["game-boy", "Game Boy", 1989, "1989", 99], ["snes", "Super Nintendo", 1991, "1991", 99],
      ["playstation", "PlayStation", 1995, "1995", 99], ["n64", "Nintendo 64", 1996, "1996", 99],
      ["dreamcast", "Dreamcast", 1999, "1999", 94], ["xbox", "Xbox", 2001, "2001", 99],
      ["wii", "Wii", 2006, "2006", 99], ["switch", "Nintendo Switch", 2017, "2017", 99]
    ])
  }),
  collection({
    id: "storage-capacities", ballparkCategory: "Technology", unit: "megabytes",
    ballparkPromptTemplate: "About how much data could {name} store, in megabytes?", sourceUrl: "https://www.computerhistory.org/timeline/memory-storage/",
    sourceLabel: "Computer History Museum memory and storage timeline", sourceSnapshot: VERIFIED,
    factualConfidence: 94, sourceQuality: 97, intuitiveEstimability: 78, entertainmentValue: 86,
    answerStability: 98, difficultyTier: "standard",
    order: { categoryFamily: "technology-milestones", categoryLabel: "Technology", title: "Storage formats by capacity", playerPrompt: "Rank these storage formats by capacity, largest to smallest.", metric: "nominal capacity in megabytes", direction: "highest-to-lowest" },
    facts: facts([
      ["punch-card", "one standard IBM punch card", 0.00008, "about 0.00008 MB", 87], ["floppy", "a 3.5-inch HD floppy disk", 1.44, "1.44 MB", 98],
      ["usb-eight", "an early 8 MB USB flash drive", 8, "8 MB", 86], ["zip-disk", "a first-generation Zip disk", 100, "100 MB", 91],
      ["cdrom", "a standard CD-ROM", 700, "700 MB", 99], ["dvd-single", "a single-layer DVD", 4700, "4,700 MB", 98],
      ["dvd-dual", "a dual-layer DVD", 8500, "8,500 MB", 92], ["bluray-single", "a single-layer Blu-ray disc", 25000, "25,000 MB", 96],
      ["bluray-dual", "a dual-layer Blu-ray disc", 50000, "50,000 MB", 92], ["ipod-classic", "a 160 GB iPod classic", 160000, "160,000 MB", 94]
    ])
  }),
  collection({
    id: "web-service-launches", ballparkCategory: "Technology", unit: "year",
    ballparkPromptTemplate: "In what year did {name} launch?", sourceUrl: "https://www.computerhistory.org/timeline/networking-the-web/",
    sourceLabel: "Computer History Museum web timeline and company histories", sourceSnapshot: VERIFIED,
    factualConfidence: 95, sourceQuality: 97, intuitiveEstimability: 90, entertainmentValue: 94,
    answerStability: 99, difficultyTier: "approachable",
    order: { categoryFamily: "technology-milestones", categoryLabel: "Technology", title: "Web services by launch date", playerPrompt: "Put these web services in launch order, earliest to latest.", metric: "launch year", direction: "lowest-to-highest" },
    facts: facts([
      ["web-public", "the public World Wide Web", 1991, "1991", 99], ["yahoo", "Yahoo", 1994, "1994", 94],
      ["amazon", "Amazon", 1995, "1995", 99], ["google", "Google", 1998, "1998", 99],
      ["wikipedia", "Wikipedia", 2001, "2001", 99], ["facebook", "Facebook", 2004, "2004", 99],
      ["youtube", "YouTube", 2005, "2005", 99], ["twitter", "Twitter", 2006, "2006", 99],
      ["instagram", "Instagram", 2010, "2010", 99], ["tiktok", "TikTok internationally", 2017, "2017", 99]
    ])
  }),
  collection({
    id: "global-history-milestones", ballparkCategory: "Familiar history", unit: "year",
    ballparkPromptTemplate: "What year marked {name}?", sourceUrl: BRITANNICA,
    sourceLabel: "Encyclopaedia Britannica world history", sourceSnapshot: VERIFIED,
    factualConfidence: 97, sourceQuality: 94, intuitiveEstimability: 88, entertainmentValue: 91,
    answerStability: 99, difficultyTier: "approachable",
    order: { categoryFamily: "historical-events", categoryLabel: "History", title: "World events by date", playerPrompt: "Put these world events in order, earliest to latest.", metric: "event year", direction: "lowest-to-highest" },
    facts: facts([
      ["magna-carta", "the sealing of Magna Carta", 1215, "1215", 96], ["gutenberg-bible", "the Gutenberg Bible's completion", 1455, "1455", 92],
      ["columbus-voyage", "Columbus's first Atlantic voyage", 1492, "1492", 99], ["declaration", "the U.S. Declaration of Independence", 1776, "1776", 99],
      ["french-revolution", "the start of the French Revolution", 1789, "1789", 98], ["modern-olympics", "the first modern Olympic Games", 1896, "1896", 97],
      ["wwi-begins", "World War I beginning", 1914, "1914", 99], ["wwii-ends", "World War II ending", 1945, "1945", 99],
      ["berlin-wall", "the fall of the Berlin Wall", 1989, "1989", 99], ["euro-intro", "the euro's introduction", 1999, "1999", 91]
    ])
  }),
  collection({
    id: "invention-milestones", ballparkCategory: "Familiar history", unit: "year",
    ballparkPromptTemplate: "What year marked {name}?", sourceUrl: "https://americanhistory.si.edu/collections/subjects/invention",
    sourceLabel: "Smithsonian National Museum of American History invention collections", sourceSnapshot: VERIFIED,
    factualConfidence: 93, sourceQuality: 98, intuitiveEstimability: 84, entertainmentValue: 91,
    answerStability: 96, difficultyTier: "standard",
    order: { categoryFamily: "inventions-discoveries", categoryLabel: "Inventions", title: "Invention milestones by date", playerPrompt: "Put these invention milestones in order, earliest to latest.", metric: "documented milestone year", direction: "lowest-to-highest" },
    facts: facts([
      ["printing-press", "Gutenberg's development of the printing press", 1440, "about 1440", 98], ["telescope-patent", "the first telescope patent application", 1608, "1608", 91],
      ["newcomen-engine", "Newcomen's steam engine", 1712, "1712", 86], ["hot-air-balloon", "the first crewed hot-air balloon flight", 1783, "1783", 94],
      ["telephone-patent", "Bell's telephone patent", 1876, "1876", 98], ["practical-lightbulb", "Edison's practical incandescent lamp", 1879, "1879", 98],
      ["powered-flight", "the Wright brothers' powered flight", 1903, "1903", 99], ["television-demo", "Baird's public television demonstration", 1926, "1926", 90],
      ["transistor", "the first working transistor", 1947, "1947", 96], ["world-wide-web", "Tim Berners-Lee's World Wide Web proposal", 1989, "1989", 99]
    ])
  }),
  collection({
    id: "exploration-milestones", ballparkCategory: "Familiar history", unit: "year",
    ballparkPromptTemplate: "What year marked {name}?", sourceUrl: "https://www.rmg.co.uk/stories/topics/exploration",
    sourceLabel: "Royal Museums Greenwich and NASA exploration histories", sourceSnapshot: VERIFIED,
    factualConfidence: 96, sourceQuality: 96, intuitiveEstimability: 82, entertainmentValue: 93,
    answerStability: 99, difficultyTier: "standard",
    order: { categoryFamily: "historical-events", categoryLabel: "History", title: "Exploration milestones by date", playerPrompt: "Put these exploration milestones in order, earliest to latest.", metric: "event year", direction: "lowest-to-highest" },
    facts: facts([
      ["magellan-departs", "the departure of Magellan's expedition from Spain", 1519, "1519", 91], ["mayflower", "the Mayflower's arrival at Plymouth", 1620, "1620", 96],
      ["cook-australia", "James Cook's charting of Australia's east coast", 1770, "1770", 90], ["lewis-clark", "the Lewis and Clark Expedition's departure", 1804, "1804", 95],
      ["beagle", "the start of Darwin's voyage on HMS Beagle", 1831, "1831", 94], ["south-pole", "the first expedition to reach the South Pole", 1911, "1911", 95],
      ["everest-summit", "the first confirmed Mount Everest summit", 1953, "1953", 99], ["challenger-deep", "the first crewed Challenger Deep descent", 1960, "1960", 88],
      ["human-space", "the first human spaceflight", 1961, "1961", 99], ["moon-landing-history", "the first crewed Moon landing", 1969, "1969", 99]
    ])
  }),
  collection({
    id: "us-history-milestones", ballparkCategory: "Familiar history", unit: "year",
    ballparkPromptTemplate: "What year marked {name}?", sourceUrl: "https://www.loc.gov/collections/",
    sourceLabel: "Library of Congress U.S. history collections", sourceSnapshot: VERIFIED,
    factualConfidence: 98, sourceQuality: 99, intuitiveEstimability: 90, entertainmentValue: 90,
    answerStability: 99, difficultyTier: "approachable",
    order: { categoryFamily: "historical-events", categoryLabel: "History", title: "U.S. history milestones by date", playerPrompt: "Put these U.S. history milestones in order, earliest to latest.", metric: "event year", direction: "lowest-to-highest" },
    facts: facts([
      ["jamestown", "Jamestown's founding", 1607, "1607", 96], ["boston-tea-party", "the Boston Tea Party", 1773, "1773", 98],
      ["declaration-us", "the Declaration of Independence", 1776, "1776", 99], ["constitution", "the U.S. Constitution's signing", 1787, "1787", 99],
      ["louisiana-purchase", "the Louisiana Purchase", 1803, "1803", 98], ["civil-war", "the U.S. Civil War beginning", 1861, "1861", 99],
      ["emancipation", "the Emancipation Proclamation taking effect", 1863, "1863", 98], ["liberty-dedication", "the Statue of Liberty's dedication", 1886, "1886", 98],
      ["nineteenth-amendment", "the Nineteenth Amendment's ratification", 1920, "1920", 97], ["brown-board", "the Brown v. Board of Education decision", 1954, "1954", 97]
    ])
  }),
  collection({
    id: "company-founding-years", ballparkCategory: "Familiar history", unit: "year",
    ballparkPromptTemplate: "In what year was {name} founded?", sourceUrl: "https://www.britannica.com/topic/",
    sourceLabel: "Company histories and Encyclopaedia Britannica", sourceSnapshot: VERIFIED,
    factualConfidence: 94, sourceQuality: 92, intuitiveEstimability: 89, entertainmentValue: 90,
    answerStability: 98, difficultyTier: "approachable",
    order: { categoryFamily: "company-founding-dates", categoryLabel: "Companies", title: "Famous companies by founding date", playerPrompt: "Put these famous companies in founding order, earliest to latest.", metric: "founding year", direction: "lowest-to-highest" },
    facts: facts([
      ["nintendo-founded", "Nintendo", 1889, "1889", 96], ["coca-cola-founded", "The Coca-Cola Company", 1892, "1892", 99],
      ["ford-founded", "Ford Motor Company", 1903, "1903", 99], ["disney-founded", "The Walt Disney Company", 1923, "1923", 99],
      ["lego-founded", "LEGO Group", 1932, "1932", 98], ["mcdonalds-founded", "McDonald's", 1940, "1940", 99],
      ["ikea-founded", "IKEA", 1943, "1943", 98], ["nike-founded", "Nike", 1964, "1964", 99],
      ["microsoft-founded", "Microsoft", 1975, "1975", 99], ["apple-founded", "Apple", 1976, "1976", 99]
    ])
  })
];
