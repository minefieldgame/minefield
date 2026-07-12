# Minefield

Minefield is a server-authoritative daily feed of eight short games:

1. Rewind
2. Odd One Out
3. In Order
4. Buzzword
5. In the Ballpark
6. Meet Me Halfway
7. On a Postcard
8. Minefield

The app uses Next.js App Router, React, TypeScript, Tailwind, DynamoDB, legal media/metadata providers, and the OpenAI Responses API for validated inventory replenishment.

## Sing Along retirement

Sing Along is preserved only as a retired legacy game so historical records and direct legacy routes remain readable. It is not part of the active board, scoring, completion requirements, sharing, or normal content-health status.

Scalable synchronized lyric timing requires a commercial license. Minefield will not depend on unauthorized lyric scraping, fabricated timings, or hundreds of manually reviewed copyrighted excerpts. Future games should prioritize open data, free and legal sources, provider APIs with clearly permitted use, public-domain material, or original mechanics such as Odd One Out.

## Local development

Use Node.js 20 or newer.

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and provide the server-only values you use. Never expose `OPENAI_API_KEY` through a `NEXT_PUBLIC_` variable. The configured generation model defaults to `gpt-5.4-mini` in `lib/content/config.ts`.

## Authoritative content lifecycle

Every non-procedural resolver follows the same lifecycle:

1. Read the DynamoDB daily puzzle for the exact game and date.
2. Return an existing puzzle unchanged, including during an admin refresh.
3. Load a prepared and/or persisted candidate inventory when no daily row exists.
4. Validate and normalize the candidates.
5. Deduplicate request keys before every DynamoDB batch or transaction.
6. Batch-check permanent exact keys and dated semantic cooldowns.
7. Select a deterministic, quality-approved, unused candidate.
8. Atomically publish the puzzle, exact reservations, cooldown records, and usage counter.
9. If another request wins the daily transaction, read and return that winner.
10. If an exact key collides, retry another candidate within a bounded strategy.

Exact content identities remain permanently reserved. Category, artist, country, answer, and topic cooldowns are dated records that may be reused after their configured window or relaxed when only the semantic cooldown is exhausted. Existing legacy cooldown rows are read by date and do not become permanent exact blocks. Authoritative puzzle assignment never happens in the browser.

Current prepared inventory baselines:

| Game | Quality-approved universe | Replenish below | Soft cooldown |
|---|---:|---:|---:|
| Rewind | selected-date discovery snapshot | 1,200 | 45 days |
| Odd One Out | 1,224 across 17 balanced families | 300 | 21 days |
| In Order | 600 objective lists across 18 families | 200 | 45 days |
| Buzzword | 5,000 prepared; full quality gates determine eligibility | 1,500 | 90 days |
| In the Ballpark | 540 stable numeric questions across 10 categories | 200 | 45 days |
| Meet Me Halfway | 5,000+ eligible city pairs | 1,000 | 30 days |
| On a Postcard | 501 normal-play landmarks from 507 technical records | 200 | 60 days |

Rewind means "Rewind this date through music history." The selected daily month and day are projected into prior years, then resolved to the nearest Billboard issue, preferably within 7 days and never beyond 14 days. Selection favors iconic and mainstream original recordings with playable iTunes previews. Diagnostics keep provider-response totals separate from unique, metadata-valid, preview-playable, quality-approved, used, and unused counts.

Odd One Out uses project-authored, source-backed templates and an original five-item mechanic. Its prepared inventory contains 72 eligible puzzles in each of 17 category families. Exact item-set identity is order independent; semantic topic and answer reuse use dated cooldowns.

In Order limits country facts to at most 15%, excludes country latitude/longitude rankings, rejects ties, and spans mainstream movies, games, television, books, music metadata, history, sports, landmarks, animals, science, technology, and geography. In the Ballpark uses stable, recognizable facts, natural player copy, explicit quality dimensions, and no internal provider/snapshot wording. Buzzword converts phonetic data to readable syllables and admits only plausible misspellings. On a Postcard excludes archive-only sites and heavily favors iconic or recognizable landmarks over challenging ones.

Prepared source assets live in `data/generated/`. Rebuild and verify them with:

```bash
npm run content:prepare
npm run content:validate
npm run content:simulate
```

The preparation pipeline uses WordNet, SUBTLEX-US, CMUdict, structured reference collections, Wikidata, and Wikimedia Commons metadata. The 365-day simulation uses local inventories and makes no live external calls.

## Admin diagnostics

`/admin` previews the selected date and reports two separate states for each active content game:

- **Inventory health** describes the reusable eligible inventory.
- **Selected-date status** describes the actual route result: Ready, Cached, Generated, Failed, Provider unavailable, or Infrastructure failure.

A failed route cannot show a puzzle hash or a passed duplicate check. Odd One Out appears in the active section. Sing Along appears only in a retired/legacy section and does not count as an active failure.

Inventory metric labels are intentionally precise:

- discovered unique
- provider responses examined
- technically valid unique
- quality approved
- playable eligible
- previously used exact
- unused eligible
- cooldown
- pending provider data
- invalid
- rejected for quality
- duplicate aliases collapsed

## DynamoDB storage

No new table is required. Candidate records, candidate manifests, daily puzzles, and usage counters use namespaced keys in the existing daily-content table. Existing published puzzles and used-content records remain compatible.

```text
AWS_REGION=us-east-1
MINEFIELD_DAILY_CONTENT_TABLE=MinefieldDailyContent
MINEFIELD_USED_CONTENT_TABLE=MinefieldUsedContent
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.4-mini
```

`MinefieldDailyContent` is keyed by `dateGameKey`; `MinefieldUsedContent` is keyed by `uniqueContentKey`. The Amplify SSR role needs `DescribeTable`, `GetItem`, `PutItem`, `BatchGetItem`, `BatchWriteItem`, and `TransactWriteItems` for both tables. The established development reliability path can also create missing tables; in production, provision both tables ahead of time and omit `CreateTable` from the runtime role. DynamoDB failures fail safely with no repeating in-memory fallback.

## Verification and deployment

```bash
npx tsc --noEmit
npm test
npm run content:validate
npm run content:simulate
npm run build
```

After a build, verify `.next/required-server-files.json`, `/api/odd-one-out`, and `/api/deployment-info` in the route manifest. `amplify.yml` records non-secret commit, branch, job, and build-time metadata. `/api/deployment-info` returns those values with the app version and is the production proof that the expected commit is live.

Pushes to the connected `main` branch trigger Amplify. A release is complete only after Amplify reports Deployed, `/api/deployment-info` matches the pushed commit, the public board loads, and at least five future admin dates generate every active game successfully.
