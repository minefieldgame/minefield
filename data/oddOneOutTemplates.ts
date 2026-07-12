import type { OddOneOutCategory } from "@/games/odd-one-out/types";

export type OddOneOutTemplate = {
  category: OddOneOutCategory;
  slug: string;
  matchingItems: readonly string[];
  oddItems: readonly string[];
  sharedProperty: string;
  oddReasonTemplate: string;
  sourceNote: string;
  qualityScore: number;
  recognizabilityScore: number;
};

/**
 * These are deliberately small, reviewable fact templates rather than generated
 * prose. Candidate expansion only changes which four verified members appear and
 * where the verified outsider is placed.
 */
export const ODD_ONE_OUT_TEMPLATES: readonly OddOneOutTemplate[] = [
  {
    category: "geography",
    slug: "island-countries",
    matchingItems: ["Japan", "Iceland", "Madagascar", "New Zealand", "Sri Lanka", "The Philippines", "Cuba"],
    oddItems: ["Switzerland", "Nepal", "Bolivia", "Mongolia"],
    sharedProperty: "The other four are island countries.",
    oddReasonTemplate: "{odd} is landlocked, not an island country.",
    sourceNote: "United Nations member-state geography and national geographic references.",
    qualityScore: 94,
    recognizabilityScore: 91
  },
  {
    category: "geography",
    slug: "south-american-countries",
    matchingItems: ["Argentina", "Brazil", "Chile", "Peru", "Colombia", "Uruguay", "Ecuador"],
    oddItems: ["Norway", "Spain", "Italy", "Germany"],
    sharedProperty: "The other four are countries in South America.",
    oddReasonTemplate: "{odd} is in Europe, not South America.",
    sourceNote: "United Nations M49 geographic region classification.",
    qualityScore: 96,
    recognizabilityScore: 95
  },
  {
    category: "science",
    slug: "elements-vs-compounds",
    matchingItems: ["Oxygen", "Gold", "Iron", "Helium", "Carbon", "Copper", "Neon"],
    oddItems: ["Water", "Table salt", "Carbon dioxide", "Ammonia"],
    sharedProperty: "The other four are chemical elements.",
    oddReasonTemplate: "{odd} is a chemical compound, not an element.",
    sourceNote: "IUPAC periodic table and standard chemical compound classifications.",
    qualityScore: 96,
    recognizabilityScore: 94
  },
  {
    category: "science",
    slug: "planets-vs-dwarf-planets",
    matchingItems: ["Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Neptune"],
    oddItems: ["Pluto", "Ceres", "Eris", "Haumea"],
    sharedProperty: "The other four are planets in our Solar System.",
    oddReasonTemplate: "{odd} is classified as a dwarf planet, not a planet.",
    sourceNote: "NASA Solar System Exploration and IAU planetary classification.",
    qualityScore: 96,
    recognizabilityScore: 90
  },
  {
    category: "animals",
    slug: "mammals",
    matchingItems: ["Dolphins", "Elephants", "Bats", "Dogs", "Whales", "Kangaroos", "Giraffes"],
    oddItems: ["Eagles", "Penguins", "Crocodiles", "Tortoises"],
    sharedProperty: "The other four are mammals.",
    oddReasonTemplate: "{odd} are not mammals.",
    sourceNote: "Encyclopaedia of Life animal-class references.",
    qualityScore: 94,
    recognizabilityScore: 96
  },
  {
    category: "animals",
    slug: "birds",
    matchingItems: ["Eagles", "Owls", "Penguins", "Ostriches", "Flamingos", "Sparrows", "Parrots"],
    oddItems: ["Bats", "Dolphins", "Whales", "Kangaroos"],
    sharedProperty: "The other four are birds.",
    oddReasonTemplate: "{odd} are mammals, not birds.",
    sourceNote: "Encyclopaedia of Life animal-class references.",
    qualityScore: 94,
    recognizabilityScore: 96
  },
  {
    category: "sports",
    slug: "nba-vs-nfl-franchises",
    matchingItems: ["Los Angeles Lakers", "Boston Celtics", "Chicago Bulls", "Golden State Warriors", "New York Knicks", "Miami Heat", "San Antonio Spurs"],
    oddItems: ["New England Patriots", "Green Bay Packers", "Dallas Cowboys", "Pittsburgh Steelers"],
    sharedProperty: "The other four are NBA franchises.",
    oddReasonTemplate: "The {odd} are an NFL franchise, not an NBA franchise.",
    sourceNote: "Official NBA and NFL franchise directories.",
    qualityScore: 94,
    recognizabilityScore: 91
  },
  {
    category: "sports",
    slug: "nba-vs-mlb-franchises",
    matchingItems: ["Los Angeles Lakers", "Boston Celtics", "Chicago Bulls", "Golden State Warriors", "New York Knicks", "Miami Heat", "San Antonio Spurs"],
    oddItems: ["New York Yankees", "Boston Red Sox", "Chicago Cubs", "Los Angeles Dodgers"],
    sharedProperty: "The other four are NBA franchises.",
    oddReasonTemplate: "The {odd} are an MLB franchise, not an NBA franchise.",
    sourceNote: "Official NBA and MLB franchise directories.",
    qualityScore: 94,
    recognizabilityScore: 91
  },
  {
    category: "movies",
    slug: "pixar-films",
    matchingItems: ["Toy Story", "Finding Nemo", "Cars", "Up", "Coco", "Inside Out", "WALL-E"],
    oddItems: ["Frozen", "The Lion King", "Moana", "Aladdin"],
    sharedProperty: "The other four are Pixar feature films.",
    oddReasonTemplate: "{odd} is a Walt Disney Animation Studios film, not a Pixar film.",
    sourceNote: "Pixar and Walt Disney Animation Studios official feature-film catalogs.",
    qualityScore: 97,
    recognizabilityScore: 97
  },
  {
    category: "movies",
    slug: "star-wars-films",
    matchingItems: ["A New Hope", "The Empire Strikes Back", "Return of the Jedi", "The Phantom Menace", "Revenge of the Sith", "The Force Awakens", "Rogue One"],
    oddItems: ["The Wrath of Khan", "The Voyage Home", "First Contact", "Star Trek Beyond"],
    sharedProperty: "The other four are Star Wars films.",
    oddReasonTemplate: "{odd} is a Star Trek film, not a Star Wars film.",
    sourceNote: "Lucasfilm Star Wars film catalog and Paramount Star Trek film catalog.",
    qualityScore: 95,
    recognizabilityScore: 91
  },
  {
    category: "music",
    slug: "beatles-albums",
    matchingItems: ["Abbey Road", "Revolver", "Rubber Soul", "Sgt. Pepper's Lonely Hearts Club Band", "Let It Be", "Help!", "The White Album"],
    oddItems: ["Thriller", "Rumours", "Purple Rain", "1989"],
    sharedProperty: "The other four are studio albums by the Beatles.",
    oddReasonTemplate: "{odd} is not a Beatles album.",
    sourceNote: "The Beatles official discography and artist album credits.",
    qualityScore: 96,
    recognizabilityScore: 94
  },
  {
    category: "music",
    slug: "string-instruments",
    matchingItems: ["Guitar", "Violin", "Cello", "Harp", "Banjo", "Mandolin", "Double bass"],
    oddItems: ["Trumpet", "Trombone", "Tuba", "French horn"],
    sharedProperty: "The other four are string instruments.",
    oddReasonTemplate: "The {odd} is a brass instrument, not a string instrument.",
    sourceNote: "Hornbostel-Sachs instrument families and standard orchestra references.",
    qualityScore: 95,
    recognizabilityScore: 94
  },
  {
    category: "video-games",
    slug: "nintendo-series",
    matchingItems: ["Super Mario", "The Legend of Zelda", "Metroid", "Kirby", "Animal Crossing", "Splatoon", "Pikmin"],
    oddItems: ["Halo", "God of War", "Uncharted", "Forza"],
    sharedProperty: "The other four are Nintendo-published game series.",
    oddReasonTemplate: "{odd} is not a Nintendo-published game series.",
    sourceNote: "Nintendo, Xbox, and PlayStation official franchise catalogs.",
    qualityScore: 94,
    recognizabilityScore: 90
  },
  {
    category: "video-games",
    slug: "playstation-hardware",
    matchingItems: ["PlayStation", "PlayStation 2", "PlayStation 3", "PlayStation 4", "PlayStation 5", "PSP", "PlayStation Vita"],
    oddItems: ["Xbox", "Xbox 360", "Xbox One", "Xbox Series X"],
    sharedProperty: "The other four are devices in Sony's PlayStation family.",
    oddReasonTemplate: "{odd} is in Microsoft's Xbox family, not Sony's PlayStation family.",
    sourceNote: "Sony Interactive Entertainment and Microsoft official hardware histories.",
    qualityScore: 95,
    recognizabilityScore: 93
  },
  {
    category: "television",
    slug: "sitcoms",
    matchingItems: ["Friends", "Seinfeld", "The Office", "Parks and Recreation", "Frasier", "Cheers", "Modern Family"],
    oddItems: ["Breaking Bad", "The Crown", "Mad Men", "The Wire"],
    sharedProperty: "The other four are television sitcoms.",
    oddReasonTemplate: "{odd} is a drama series, not a sitcom.",
    sourceNote: "Network and studio program catalogs with standard genre classifications.",
    qualityScore: 95,
    recognizabilityScore: 95
  },
  {
    category: "television",
    slug: "animated-series",
    matchingItems: ["The Simpsons", "Futurama", "South Park", "SpongeBob SquarePants", "Family Guy", "Scooby-Doo", "Avatar: The Last Airbender"],
    oddItems: ["Friends", "The Office", "Stranger Things", "The Crown"],
    sharedProperty: "The other four are animated television series.",
    oddReasonTemplate: "{odd} is a live-action series, not an animated series.",
    sourceNote: "Network and studio program catalogs with production-format classifications.",
    qualityScore: 95,
    recognizabilityScore: 95
  },
  {
    category: "books",
    slug: "jane-austen-novels",
    matchingItems: ["Pride and Prejudice", "Sense and Sensibility", "Emma", "Mansfield Park", "Persuasion", "Northanger Abbey"],
    oddItems: ["Great Expectations", "Oliver Twist", "David Copperfield", "A Tale of Two Cities"],
    sharedProperty: "The other four are novels by Jane Austen.",
    oddReasonTemplate: "{odd} is a novel by Charles Dickens, not Jane Austen.",
    sourceNote: "Public-domain bibliographic records for Jane Austen and Charles Dickens.",
    qualityScore: 95,
    recognizabilityScore: 90
  },
  {
    category: "books",
    slug: "harry-potter-novels",
    matchingItems: ["The Philosopher's Stone", "The Chamber of Secrets", "The Prisoner of Azkaban", "The Goblet of Fire", "The Order of the Phoenix", "The Half-Blood Prince", "The Deathly Hallows"],
    oddItems: ["The Hobbit", "The Golden Compass", "The Lion, the Witch and the Wardrobe", "A Wizard of Earthsea"],
    sharedProperty: "The other four are novels in the Harry Potter series.",
    oddReasonTemplate: "{odd} is a fantasy novel outside the Harry Potter series.",
    sourceNote: "Publisher bibliographic catalogs for the Harry Potter series and comparison titles.",
    qualityScore: 96,
    recognizabilityScore: 94
  },
  {
    category: "history",
    slug: "us-presidents",
    matchingItems: ["George Washington", "Thomas Jefferson", "Abraham Lincoln", "Franklin D. Roosevelt", "John F. Kennedy", "Ronald Reagan", "Barack Obama"],
    oddItems: ["Winston Churchill", "Margaret Thatcher", "Tony Blair", "Clement Attlee"],
    sharedProperty: "The other four served as president of the United States.",
    oddReasonTemplate: "{odd} served as prime minister of the United Kingdom, not U.S. president.",
    sourceNote: "White House presidential history and UK government prime-minister records.",
    qualityScore: 96,
    recognizabilityScore: 94
  },
  {
    category: "history",
    slug: "events-before-1900",
    matchingItems: ["The Magna Carta", "The Black Death", "The Renaissance", "Columbus's first Atlantic voyage", "The American Revolution", "The French Revolution", "The American Civil War"],
    oddItems: ["The first powered flight", "World War II", "The Moon landing", "The fall of the Berlin Wall"],
    sharedProperty: "The other four happened before 1900.",
    oddReasonTemplate: "{odd} happened after 1900.",
    sourceNote: "Standard historical chronology references and national archives.",
    qualityScore: 94,
    recognizabilityScore: 92
  },
  {
    category: "food",
    slug: "italian-dishes",
    matchingItems: ["Pizza Margherita", "Lasagna", "Risotto", "Osso buco", "Carbonara", "Tiramisu", "Pesto"],
    oddItems: ["Tacos", "Enchiladas", "Tamales", "Pozole"],
    sharedProperty: "The other four are Italian dishes.",
    oddReasonTemplate: "{odd} is a Mexican dish, not an Italian dish.",
    sourceNote: "Italian and Mexican national culinary references.",
    qualityScore: 94,
    recognizabilityScore: 91
  },
  {
    category: "food",
    slug: "cheeses",
    matchingItems: ["Cheddar", "Brie", "Gouda", "Mozzarella", "Parmesan", "Feta", "Camembert"],
    oddItems: ["Baguette", "Pita", "Naan", "Sourdough"],
    sharedProperty: "The other four are cheeses.",
    oddReasonTemplate: "{odd} is a type of bread, not a cheese.",
    sourceNote: "Standard culinary reference classifications for cheese and bread.",
    qualityScore: 96,
    recognizabilityScore: 96
  },
  {
    category: "brands-and-companies",
    slug: "car-manufacturers",
    matchingItems: ["Toyota", "Ford", "BMW", "Honda", "Tesla", "Volvo", "Ferrari"],
    oddItems: ["Nike", "Adidas", "Levi's", "Zara"],
    sharedProperty: "The other four manufacture cars.",
    oddReasonTemplate: "{odd} is an apparel brand, not a car manufacturer.",
    sourceNote: "Company product catalogs and public corporate profiles.",
    qualityScore: 95,
    recognizabilityScore: 97
  },
  {
    category: "brands-and-companies",
    slug: "technology-companies",
    matchingItems: ["Apple", "Microsoft", "Google", "Adobe", "Intel", "Nvidia", "IBM"],
    oddItems: ["McDonald's", "Wendy's", "Subway", "KFC"],
    sharedProperty: "The other four are technology companies.",
    oddReasonTemplate: "{odd} is a restaurant chain, not a technology company.",
    sourceNote: "Public company profiles and official product catalogs.",
    qualityScore: 95,
    recognizabilityScore: 97
  },
  {
    category: "technology",
    slug: "programming-languages",
    matchingItems: ["Python", "Java", "JavaScript", "C++", "Ruby", "Swift", "Kotlin"],
    oddItems: ["Windows", "macOS", "Android", "Linux"],
    sharedProperty: "The other four are programming languages.",
    oddReasonTemplate: "{odd} is not a programming language.",
    sourceNote: "Official language documentation and operating-system project documentation.",
    qualityScore: 96,
    recognizabilityScore: 94
  },
  {
    category: "technology",
    slug: "web-browsers",
    matchingItems: ["Chrome", "Firefox", "Safari", "Microsoft Edge", "Opera", "Brave", "Vivaldi"],
    oddItems: ["Google Search", "Bing", "DuckDuckGo", "Yahoo Search"],
    sharedProperty: "The other four are web browsers.",
    oddReasonTemplate: "{odd} is a search engine, not a web browser.",
    sourceNote: "Official browser and search-engine product documentation.",
    qualityScore: 96,
    recognizabilityScore: 94
  },
  {
    category: "language",
    slug: "romance-languages",
    matchingItems: ["Spanish", "French", "Italian", "Portuguese", "Romanian", "Catalan", "Galician"],
    oddItems: ["German", "Dutch", "Swedish", "English"],
    sharedProperty: "The other four are Romance languages.",
    oddReasonTemplate: "{odd} is a Germanic language, not a Romance language.",
    sourceNote: "Glottolog and standard historical-linguistics family classifications.",
    qualityScore: 94,
    recognizabilityScore: 91
  },
  {
    category: "language",
    slug: "un-official-languages",
    matchingItems: ["Arabic", "Chinese", "English", "French", "Russian", "Spanish"],
    oddItems: ["German", "Japanese", "Portuguese", "Hindi"],
    sharedProperty: "The other four are official languages of the United Nations.",
    oddReasonTemplate: "{odd} is not one of the United Nations' six official languages.",
    sourceNote: "United Nations official-language policy.",
    qualityScore: 95,
    recognizabilityScore: 94
  },
  {
    category: "landmarks",
    slug: "paris-landmarks",
    matchingItems: ["Eiffel Tower", "Louvre Museum", "Arc de Triomphe", "Notre-Dame de Paris", "Sacré-Cœur", "Musée d'Orsay", "Panthéon"],
    oddItems: ["Big Ben", "The Colosseum", "Statue of Liberty", "Sydney Opera House"],
    sharedProperty: "The other four are landmarks in Paris.",
    oddReasonTemplate: "{odd} is not in Paris.",
    sourceNote: "Official city tourism and landmark location records.",
    qualityScore: 96,
    recognizabilityScore: 94
  },
  {
    category: "landmarks",
    slug: "new-york-landmarks",
    matchingItems: ["Empire State Building", "Statue of Liberty", "Brooklyn Bridge", "Central Park", "Times Square", "Rockefeller Center", "Chrysler Building"],
    oddItems: ["Golden Gate Bridge", "Space Needle", "Hollywood Sign", "Gateway Arch"],
    sharedProperty: "The other four are landmarks in New York City.",
    oddReasonTemplate: "{odd} is not in New York City.",
    sourceNote: "Official city tourism and landmark location records.",
    qualityScore: 96,
    recognizabilityScore: 96
  },
  {
    category: "mythology",
    slug: "greek-mythology",
    matchingItems: ["Zeus", "Hera", "Poseidon", "Athena", "Apollo", "Artemis", "Aphrodite"],
    oddItems: ["Odin", "Thor", "Loki", "Freyja"],
    sharedProperty: "The other four are figures from Greek mythology.",
    oddReasonTemplate: "{odd} is a figure from Norse mythology, not Greek mythology.",
    sourceNote: "Public-domain classical mythology references and the Poetic Edda.",
    qualityScore: 95,
    recognizabilityScore: 93
  },
  {
    category: "mythology",
    slug: "norse-mythology",
    matchingItems: ["Odin", "Thor", "Loki", "Freyja", "Tyr", "Heimdall", "Baldr"],
    oddItems: ["Zeus", "Athena", "Apollo", "Hera"],
    sharedProperty: "The other four are figures from Norse mythology.",
    oddReasonTemplate: "{odd} is a figure from Greek mythology, not Norse mythology.",
    sourceNote: "Public-domain classical mythology references and the Poetic Edda.",
    qualityScore: 95,
    recognizabilityScore: 91
  },
  {
    category: "art-and-culture",
    slug: "italian-renaissance-artists",
    matchingItems: ["Leonardo da Vinci", "Michelangelo", "Raphael", "Sandro Botticelli", "Titian", "Giorgione", "Tintoretto"],
    oddItems: ["Claude Monet", "Pierre-Auguste Renoir", "Edgar Degas", "Camille Pissarro"],
    sharedProperty: "The other four are Italian Renaissance artists.",
    oddReasonTemplate: "{odd} was an Impressionist, not an Italian Renaissance artist.",
    sourceNote: "National Gallery and museum artist-period catalogs.",
    qualityScore: 94,
    recognizabilityScore: 88
  },
  {
    category: "art-and-culture",
    slug: "impressionist-artists",
    matchingItems: ["Claude Monet", "Pierre-Auguste Renoir", "Edgar Degas", "Berthe Morisot", "Camille Pissarro", "Alfred Sisley", "Mary Cassatt"],
    oddItems: ["Andy Warhol", "Roy Lichtenstein", "Keith Haring", "David Hockney"],
    sharedProperty: "The other four are associated with Impressionism.",
    oddReasonTemplate: "{odd} is associated with Pop Art, not Impressionism.",
    sourceNote: "Museum artist-movement catalogs from major public collections.",
    qualityScore: 94,
    recognizabilityScore: 88
  }
] as const;
