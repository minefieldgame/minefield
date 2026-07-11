# Minefield

Minefield is a server-authoritative daily feed of eight short games: Rewind, Sing Along, In Order, Buzzword, In the Ballpark, Meet Me Halfway, On a Postcard, and the final Minefield board. The app uses Next.js App Router, React, TypeScript, Tailwind, DynamoDB, external media/metadata providers, and the OpenAI Responses API for validated inventory replenishment.

## Local development

Use Node.js 20 or newer.

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and provide the server-only values you use. Never expose `OPENAI_API_KEY` through a `NEXT_PUBLIC_` variable. The configured generation model defaults to `gpt-5.4-mini` in `lib/content/config.ts`.

## Content-generation architecture

Every non-procedural resolver follows the same lifecycle:

1. Return an already-published DynamoDB puzzle unchanged.
2. Load a prepared and/or persisted candidate batch.
3. Run deterministic validation and normalization.
4. Batch-check exact keys and dated semantic-cooldown keys.
5. Validate factual data, original-recording metadata, preview availability, or image/lyric timing as applicable.
6. Select deterministically from the valid unused batch.
7. Atomically publish the puzzle, exact/semantic used-content records, and inventory usage counter.

Exact duplicates are never relaxed. Category, artist, country, city, and topic cooldowns may relax when a strict pool is empty. All authoritative assignment happens in server routes.

Current prepared inventory baselines:

| Game | Prepared/rolling universe | Replenish below | Soft cooldown |
|---|---:|---:|---:|
| Rewind | 6,800+ rolling chart-song candidates | 1,200 | 45 days |
| Sing Along | actual reviewed timing count shown in admin; staged pool supports thousands | 400 | 60 days |
| In Order | 600 objective structured lists | 200 | 45 days |
| Buzzword | 5,000 validated words | 2,000 | 90 days |
| In the Ballpark | 2,000+ verified structured questions | 800 | 45 days |
| On a Postcard | 500 verified Commons photographs | 200 | 60 days |
| Meet Me Halfway | 5,000+ generated city pairs | 1,000 | 30 days |

Rewind considers many Billboard issues, positions, and decades, batch-checks song keys, then validates bounded iTunes preview batches. Sing Along only admits records with sourced preview-relative timing, a 0.25–1.0 second answer gap, an inaudible answer segment, and a playable preview; broad iTunes discovery records remain `pending-review` until timing validation passes. In Order, Buzzword, and Ballpark use structured batch generation through the configured model only when validated inventory falls below threshold, and deterministic validators can reject the entire batch. On a Postcard is generated from Wikidata and Wikimedia Commons metadata rather than a TypeScript landmark bank.

Prepared source assets live in `data/generated/`. Rebuild and validate them with:

```bash
npm run content:prepare
npm run content:validate
npm run content:simulate
```

`content:prepare` uses WordNet, SUBTLEX-US, CMUdict, REST Countries, the World Bank population indicator, Wikidata, and Wikimedia Commons metadata. The landmark pipeline checks MIME type, non-SVG format, dimensions, coordinates, names, source files, attribution, and license metadata. The offline simulation uses prepared/mocked providers and makes no live external calls.

## Admin diagnostics

`/admin` contains the content-health dashboard and the **Replenish Content Inventories** action. Per game it reports architecture, total/validated/unused inventory, cumulative exact uses, cooldown exclusions, invalid/pending records, current-request generation/rejections, selected candidate, provider strategy, duration, API calls, DynamoDB reads/writes, health class, and actionable failure reason.

Daily summary states are authoritative: `Ready`, `Cached`, `Generated`, `Failed`, or `Low inventory warning`. A failed game has no puzzle hash and cannot show a passed duplicate check.

## DynamoDB storage

No new table is required. Candidate records, candidate manifests, and usage counters use namespaced keys in the existing daily-content table. Existing published puzzles and legacy used-content keys remain compatible.

```text
AWS_REGION=us-east-1
MINEFIELD_DAILY_CONTENT_TABLE=MinefieldDailyContent
MINEFIELD_USED_CONTENT_TABLE=MinefieldUsedContent
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.4-mini
```

`MinefieldDailyContent` is keyed by `dateGameKey`; `MinefieldUsedContent` is keyed by `uniqueContentKey`. The Amplify SSR role needs these least-privilege actions on the two table ARNs:

```json
{
  "Effect": "Allow",
  "Action": [
    "dynamodb:DescribeTable",
    "dynamodb:CreateTable",
    "dynamodb:GetItem",
    "dynamodb:PutItem",
    "dynamodb:BatchGetItem",
    "dynamodb:BatchWriteItem",
    "dynamodb:TransactWriteItems"
  ],
  "Resource": [
    "arn:aws:dynamodb:REGION:ACCOUNT_ID:table/MinefieldDailyContent",
    "arn:aws:dynamodb:REGION:ACCOUNT_ID:table/MinefieldUsedContent"
  ]
}
```

The runtime still creates a missing table through the established reliability path. In a locked-down production account, provision both tables ahead of time and omit `CreateTable` from the runtime role. DynamoDB failures fail safely; there is no repeating in-memory fallback.

## Verification and deployment

```bash
npm test
npm run content:validate
npm run content:simulate
npm run build
```

The Amplify build defined in `amplify.yml` runs `npm ci` and `npm run build`, publishing the complete `.next` output for SSR routes. Production must retain `.next/required-server-files.json` and all API route handlers. Pushes to the connected production branch trigger the Amplify deployment; deployment status should be confirmed in Amplify before declaring the release complete.
