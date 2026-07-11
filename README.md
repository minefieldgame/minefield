# Minefield

Minefield is a mobile-first daily feed of seven quick trivia and skill games:

- NeedleDrop — identify a song from increasingly long official preview clips.
- Top 10 — drag ten familiar items into the correct ranked order.
- SpellDrop — spell one dynamically generated commonly misspelled word.
- Closer — estimate one dynamically generated numeric fact.
- Meet Me Halfway — place the geographic midpoint between two world cities.
- Landmark Drop — locate a famous landmark on the world map.
- Minefield — survive a final board whose difficulty is earned across the first six games.

The app uses Next.js App Router, React, TypeScript, Tailwind CSS, server route handlers, and browser-local progress. The full board is worth 700 points.

## Local development

Use Node.js 20 or newer.

```bash
npm install
```

Create a file named `.env.local` in the project root:

```text
OPENAI_API_KEY=your_api_key_here
```

The default generation model is centralized in `lib/content/config.ts` and uses the lower-cost `gpt-5.4-mini`. Override it only when needed:

```text
OPENAI_MODEL=gpt-5.4-mini
```

OpenAI API usage requires an API-platform account with billing configured. A ChatGPT subscription does not automatically provide API credits.

Then run:

```bash
npm run dev
```

Production verification:

```bash
npm run build
npm start
```

## Dynamic content

Top 10, SpellDrop, and Closer use the shared server-side content system in `lib/content/`:

- `dailyContentEngine.ts` — seeded orchestration, retries, validation, cache envelopes, and diagnostics
- `aiClient.ts` — server-only OpenAI structured-output requests
- `validation.ts` — deterministic sanity checks
- `sourceResolver.ts` — source metadata normalization
- `cache.ts` — instance-local generated-content cache and in-flight request deduplication
- `repeatPrevention.ts` — hashes, recent-content checks, and replaceable history storage

Every request uses the Pacific date, game ID, and a deterministic seed. Generated factual content is validated before it reaches the player. Top 10 and Closer use web-backed source notes. The OpenAI key never enters the browser bundle.

If `OPENAI_API_KEY` is missing, dynamic games show a clean unavailable state and the board advances. Admin displays the full configuration error. Minefield does not silently substitute a small hardcoded daily puzzle bank.

Player progress stores the final generated puzzle in localStorage, so refreshes preserve the exact puzzle already received by that player. Server cache headers, same-instance daily caching, frontend request deduplication, and in-flight server promise reuse prevent repeated generation calls. Admin reports cache hits and generation duration. A production shared cache/database can replace the cache/history adapters later without changing game components.

## Geography reference data

`data/worldCities.ts` contains more than 100 major-city coordinates. `data/landmarks.ts` contains more than 50 global landmarks with coordinates and Wikimedia Commons image references. These are broad geographic reference datasets rather than prewritten daily trivia banks.

Meet Me Halfway uses a spherical midpoint calculation. Both map games use haversine distance and deterministic daily selection. The shared `InteractiveGuessMap` uses client-side Leaflet with a label-free OpenStreetMap/CARTO basemap, high-density rendering, touch zoom, panning, markers, and review mode while remaining compatible with AWS Amplify.

## Daily system

All games reset at midnight in `America/Los_Angeles`. Shared helpers include:

- `getPacificToday()`
- `getDailyGameDate()`
- `getDailySeed()`
- `seededRandom()`
- `saveGameProgress()`
- `loadGameProgress()`
- `calculateDailySummary()`

The feed allows only controlled forward progression. The first six scores determine the final Minefield difficulty. Completing Minefield unlocks the daily answer review.

## AWS Amplify

1. Open AWS Amplify.
2. Select the Minefield app.
3. Go to **App settings**.
4. Open **Environment variables**.
5. Add `OPENAI_API_KEY`.
6. Paste the OpenAI API key.
7. Save.
8. Redeploy the active branch.

Optionally add `OPENAI_MODEL` to override the centralized default.

Do not prefix the key with `NEXT_PUBLIC_`. Do not configure static export; provider route handlers require the managed Next.js runtime.

## Admin

The password-protected diagnostics dashboard is available at `/admin`.

It shows daily seeds and full diagnostics for all seven games, including:

- generator and API-key status
- raw AI responses
- validation checks and confidence
- source notes
- content hashes and repeat checks
- final puzzle JSON
- Minefield mine positions
- city pairs and spherical midpoint coordinates
- landmark image URL/status and coordinates

The default MVP password remains `Yuki2026`. For deployment, set `MINEFIELD_ADMIN_PASSWORD` or replace the boundary with managed identity.

## Notes

- Progress and archives are browser-local and do not sync between devices.
- Server memory caches are instance-local on serverless hosts.
- Public providers and external images can be temporarily unavailable.
- Apple preview audio remains hosted by Apple and is not downloaded or redistributed.

## Required DynamoDB reliability storage

Daily server-generated content now uses DynamoDB for same-day stability and long-term duplicate prevention.

Required server-side environment variables:

```text
AWS_REGION=us-east-1
MINEFIELD_DAILY_CONTENT_TABLE=MinefieldDailyContent
MINEFIELD_USED_CONTENT_TABLE=MinefieldUsedContent
OPENAI_API_KEY=your_api_key_here
```

The Amplify server role needs permission to call `DescribeTable`, `CreateTable`, `GetItem`, and `PutItem` for:

- `MinefieldDailyContent`
- `MinefieldUsedContent`

`MinefieldDailyContent` is keyed by `dateGameKey`, for example `2026-06-24#sing-along`.
`MinefieldUsedContent` is keyed by `uniqueContentKey` and also stores normalized prompt, normalized answer,
secondary duplicate keys, source metadata, and creation date.

If DynamoDB is unavailable, the app fails safely for server-generated games instead of silently using repeating fallback
questions. Admin diagnostics show the daily seed, game seed, content keys, duplicate-check status, retry counts, and
DynamoDB persistence provider details.
