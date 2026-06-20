# Minefield

Minefield is a mobile-first daily feed of quick mini-games. Players complete one game, move into the next, and finish with a shared scorecard and streak.

The current daily board contains:

- **NeedleDrop** — identify a Billboard Top 10 song from increasingly long official iTunes preview clips.
- **Top 3** — name the first three entries in a ranked category.
- **SpellDrop** — spell a commonly misspelled word after hearing it spoken.

The app uses Next.js App Router, React, TypeScript, Tailwind CSS, local storage, and server route handlers. It requires no database or user account.

## Run locally

Use Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Production check:

```bash
npm run build
npm start
```

## Minefield daily system

All games use the same Pacific Time date. At midnight in `America/Los_Angeles`, a new board becomes available.

Shared helpers provide:

- `getPacificToday()`
- `getDailyGameDate()`
- `getDailySeed()`
- `seededRandom()`
- `saveGameProgress()`
- `loadGameProgress()`
- `calculateDailySummary()`

Each mini-game reports a standard result containing its game ID, score, maximum score, completion state, and short detail. Minefield combines these results into the daily summary and shared streak.

Same-day state and the completed-board archive are stored locally in the browser.

## Game architecture

```text
components/
  MinefieldFeed.tsx
  MiniGameCard.tsx
  DailySummary.tsx
games/
  needledrop/
    NeedleDropGame.tsx
  top-ten/
    TopTenGame.tsx
    logic.ts
    providers.ts
    types.ts
  spelldrop/
    SpellDropGame.tsx
lib/
  date.ts
  seed.ts
  minefieldStorage.ts
types/
  minefield.ts
```

To add another game, create an isolated module and have it report a `MinefieldGameResult` to the feed. Add its metadata to the feed registry and its ID to `MinefieldGameId`.

## Top 3 generation

Top 3 uses a deterministic daily AI pipeline and provider abstraction:

- `generateTopTenCategory(date)`
- `resolveTopTenCategory(category, date)`
- `resolveDailyTopTenPuzzle(date)`
- `validateTopTenPuzzle()`

Live mode uses the server-side OpenAI Responses API with web search and strict structured outputs. The AI creates an objective category in a deterministically selected topic area, resolves three ranked answers from public sources, generates conservative aliases, and returns confidence/source metadata. A deterministic validator rejects malformed, duplicate, subjective, or unsourced puzzles. Generation retries up to three times.

Configure AWS Amplify or local development with:

```text
OPENAI_API_KEY=your_server_side_key
```

Optional model override:

```text
OPENAI_MODEL=gpt-5.5
```

Secrets are read only by server route handlers and are never sent to browser code.

If `OPENAI_API_KEY` is absent, Top 3 uses a deterministic development fallback so the player board remains usable. Deployment details stay out of the player experience; admin clearly reports that the key is missing and live generation is disabled.

Server routes:

- `/api/top-ten/generate`
- `/api/top-ten/resolve`
- `/api/top-ten/validate`

The resolved puzzle is cached in server memory for the running instance, through route cache headers, and in local storage for each player. On serverless platforms, memory caches are instance-local; client persistence remains the MVP guarantee that refreshes do not change a player’s puzzle.

Answer normalization ignores case, punctuation, accents, and extra spaces. Country codes and common aliases such as USA, US, and United States of America are accepted.

## NeedleDrop data and audio

NeedleDrop remains an independent game module. Historical chart issues come from the public `mhollingshead/billboard-hot-100` archive. The player-facing historical date retains the current Pacific month and day while the active weekly source issue is stored separately.

Official preview URLs and store links come from Apple’s iTunes Search API. Minefield never downloads, caches, proxies, or redistributes audio.

## AWS Amplify

1. Push the project to a Git provider supported by Amplify.
2. Create a new Amplify Hosting app and connect the repository.
3. Keep framework detection set to Next.js.
4. Build with `npm run build`.
5. In **App settings → Environment variables**, add `OPENAI_API_KEY` with the server-side OpenAI API key.
6. Optionally add `OPENAI_MODEL`; it defaults to `gpt-5.5`.
7. Redeploy the active branch after saving the environment variables.

Do not prefix the key with `NEXT_PUBLIC_`. Amplify makes the server environment variable available to Next.js route handlers without exposing it in the browser bundle. Never commit the real key to source control.

Do not configure a static export because provider route handlers require the managed Next.js runtime.

## Custom header logo

The supplied Minefield artwork is optimized as a transparent PNG at `public/minefield-logo.png`. The top-left header links the logo to home, preserves its aspect ratio, and uses alt text `Minefield`.

## Admin access

The read-only testing dashboard is available directly at:

```text
/admin
```

MVP password:

```text
Yuki2026
```

The route is intentionally absent from public navigation and includes no-index metadata. Successful access is recorded in `sessionStorage` and backed by a short-lived HTTP-only session cookie. Logout clears both.

The dashboard can:

- Generate the complete board for any selected date
- Move to the previous or next day
- Select today or tomorrow
- Preview tomorrow immediately
- Select a random historical date for stress testing
- Display deterministic seeds and generation timestamps
- Inspect NeedleDrop chart, iTunes matching, preview, and raw provider responses
- Inspect Top 3 category selection, all accepted answers and aliases, validation, and raw provider data
- Test NeedleDrop title normalization and see why a sample guess passes or fails
- Inspect SpellDrop’s selected word, accepted spelling, deterministic seed, and replay limit
- Copy resolved puzzle JSON

Admin previews are read-only. They do not write player progress, alter local daily puzzles, or change production generation.

Future games can add a preview component to `components/admin/adminGameRegistry.tsx`.

The password boundary is isolated in `lib/adminAuth.ts` and `/api/admin/auth`. For deployment beyond the MVP, set `MINEFIELD_ADMIN_PASSWORD` in the server environment or replace this boundary with proper identity-based authentication.

## Known limitations

- Progress and archives are browser-local and do not sync between devices.
- Public providers can be temporarily unavailable or change their response format.
- The initial Top 3 category pool intentionally favors reliable structured data. More categories should only be added with a trustworthy provider and validation strategy.
- Apple preview availability varies by song and storefront.

## Legal notes

Apple preview audio remains hosted by Apple and is presented with attribution and a store link. Billboard and other data names belong to their respective owners. Review current provider terms before commercial launch.
