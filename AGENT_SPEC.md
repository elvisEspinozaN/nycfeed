# NYC Pulse — Agent Spec v2

> **Single source of truth. Codex and Claude both read this before writing any code.**
> Do not deviate from structure, types, or ticket boundaries.
> If something is marked STUB — stub cleanly, mark exact line with `// TODO: real integration`.

---

## What This App Is

NYC Pulse is a TikTok-style vertical civic feed for New York City.
It shows 311 complaints, MTA transit disruptions, and local events ( Public Event Categories
Community Block Parties
Open Streets Pedestrian Events
Street Fairs and Craft Markets
Outdoor Concert Series
Outdoor Movie Nights
Public Park Theater Festivals
Cultural Heritage Festivals
Food and Restaurant Weeks
Museum Free Admission Nights
Holiday Markets and Tree Lightings
Road Races and Marathons
Community Board Public Meetings
Police Neighborhood Safety Forums
Public Library Community Workshops
Public Park Volunteer Cleanups).

Feed modes:
- Near Me: requires `lat` and `lng`; filters coordinate-bearing events by radius in JS.
- All NYC: sends `lat=null` and `lng=null`; skips distance filtering.
- Transit Line: optional `line` filter, e.g. `A`, `L`, `7`; returns only MTA events affecting that route.
- MTA alerts often have no coordinates. Keep no-coordinate events in Near Me instead of hiding transit.
- Because `CityEvent` cannot change, normalized MTA route IDs are stored in `neighborhood` as a space-delimited route list. Do not render that field as a neighborhood for transit cards.

---

## Hackathon Track Compliance

| Requirement               | How We Satisfy It                                                |
| ------------------------- | ---------------------------------------------------------------- |
| Autonomous agent          | `runAgent.ts` orchestrates full pipeline on demand               |
| Real work on the open web | Live NYC Open Data (311), MTA alerts, Nimble-scraped event pages |
| Publish                   | Agent writes to ClickHouse, serves via `/api/feed`               |
| Monitor                   | Datadog spans wrap every pipeline step                           |
| Orchestrate               | fetch → normalize → dedupe → score → store → serve               |
| Transact                  | Bulk upsert into ClickHouse `city_events` table                  |
| 2+ sponsor tools          | ClickHouse + Nimble + Datadog                                    |

---

## Sponsor Tool Roles

### ClickHouse

- Store and query all normalized city events
- Receives bulk inserts from agent, serves geo-filtered results to `/api/feed`
- File: `lib/clickhouse.ts`
- Raw queries only. No ORM.

### Nimble

- Scrape NYC public event pages that have no clean API
- Target: NYC Parks events page
- File: `lib/sources/nimbleEvents.ts`
- If `NIMBLE_API_KEY` not set → return clean demo stub, log clearly

### Datadog

- Trace every agent pipeline step
- Named spans: `fetch.nyc311`, `fetch.mta`, `fetch.nimble`, `normalize`, `dedupe`, `score`, `clickhouse.insert`, `feed.publish`
- File: integrated inside `lib/agent/runAgent.ts`
- If `DATADOG_API_KEY` not set → console.log span names, do not crash

---

## Core Type — Never Change

```typescript
// types/event.ts
export type CityEvent = {
  id: string;
  source: "nyc_311" | "mta" | "nimble_events";
  category: "problem" | "transit" | "event";
  title: string;
  summary: string;
  borough?: string;
  neighborhood?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  sourceUrl?: string;
  severity: "low" | "medium" | "high";
  status?: string;
  occurredAt: string; // ISO string
  fetchedAt: string; // ISO string
};
```

---

## Project Structure

```
nyc-pulse/
├── AGENT_SPEC.md
├── .env.example
├── types/
│   └── event.ts
├── lib/
│   ├── clickhouse.ts         ← store + query
│   ├── geo.ts                ← haversine distance filter (JS, not SQL)
│   ├── scoring.ts            ← keyword-based severity
│   ├── sources/
│   │   ├── nyc311.ts
│   │   ├── mta.ts
│   │   └── nimbleEvents.ts
│   └── agent/
│       ├── normalizeEvent.ts ← raw → CityEvent (includes summary trim)
│       ├── dedupeEvents.ts
│       └── runAgent.ts       ← orchestrator + Datadog spans
├── app/
│   ├── page.tsx
│   ├── login/
│   │   └── page.tsx
│   ├── profile/
│   │   └── page.tsx
│   └── api/
│       ├── feed/route.ts
│       └── ingest/route.ts
└── components/
    ├── FeedCard.tsx
    ├── FeedFilters.tsx
    ├── RadiusSelector.tsx
    └── LocationSearch.tsx
```

**Removed:** `summarizeEvent.ts` — summary trimming happens inside `normalizeEvent.ts`

---

## Tickets

---

### TICKET 1 — Scaffold

**Goal:** Bare project, types, env, nothing else.

- Init Next.js 14 with TypeScript and Tailwind
- Install shadcn: `npx shadcn@latest init`
- Add only these shadcn components: `badge button card select`
- Install Supabase: `npm install @supabase/supabase-js @supabase/ssr`
- Create `types/event.ts` with `CityEvent` type exactly as defined above
- Create `.env.example`:

```
CLICKHOUSE_HOST=
CLICKHOUSE_USERNAME=
CLICKHOUSE_PASSWORD=
CLICKHOUSE_DATABASE=
NIMBLE_API_KEY=
MTA_API_KEY=
DATADOG_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

**Done when:** `npm run dev` runs, types compile, env file exists.

---

### TICKET 2 — ClickHouse

**Goal:** Schema + client. No agent logic yet.

**Schema SQL — run once in ClickHouse Cloud console:**

```sql
CREATE TABLE IF NOT EXISTS city_events (
  id String,
  source LowCardinality(String),
  category LowCardinality(String),
  title String,
  summary String,
  borough Nullable(String),
  neighborhood Nullable(String),
  latitude Nullable(Float64),
  longitude Nullable(Float64),
  address Nullable(String),
  source_url Nullable(String),
  severity LowCardinality(String),
  status Nullable(String),
  occurred_at DateTime,
  fetched_at DateTime
) ENGINE = ReplacingMergeTree()
ORDER BY (id);
```

Notes:

- `ReplacingMergeTree` deduplicates by `id` automatically
- `LowCardinality` on repeated string fields = cheap storage
- No PARTITION BY — unnecessary at hackathon scale

**`lib/clickhouse.ts`** exports:

```typescript
insertEvents(events: CityEvent[]): Promise<void>
queryFeed(lat: number, lng: number, radiusMiles: number, category?: string): Promise<CityEvent[]>
```

- Use `@clickhouse/client` npm package
- `queryFeed`: pull last 200 events, return all, geo filtering happens in JS via `lib/geo.ts`
- Current signature supports All NYC and subway line filtering:
```typescript
queryFeed(
  lat: number | null,
  lng: number | null,
  radiusMiles: number,
  category?: string,
  line?: string
): Promise<CityEvent[]>
```
- If `line` is provided, return only MTA events whose normalized route list contains that line
- Raw queries only

**Done when:** `insertEvents` and `queryFeed` connect to real ClickHouse Cloud instance.

---

### TICKET 3 — Source Fetchers

**Goal:** Three fetchers. Each returns raw data. No normalization here.

#### `lib/sources/nyc311.ts`

- URL: `https://data.cityofnewyork.us/resource/erm2-nwe9.json`
- Params: `$limit=50&$order=created_date DESC`
- No API key needed
- On failure → return `[]`, log error

#### `lib/sources/mta.ts`

- URL: `https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/camsys%2Fsubway-alerts`
- Accounts and API keys are no longer required for MTA realtime feeds
- Header: `x-api-key: ${MTA_API_KEY}` only if an optional key is set
- If fetch fails → return 3 hardcoded demo alerts, labeled `_demo`

#### `lib/sources/nimbleEvents.ts`

- Target: `https://www.nycgovparks.org/events`
- Fields: event name, date, location, borough, url
- Nimble endpoint: `POST https://sdk.nimbleway.com/v1/extract`
- Header: `Authorization: Bearer ${NIMBLE_API_KEY}`
- If key missing → return 3 hardcoded demo events, labeled `_demo`

**Done when:** each fetcher runs independently, returns data or clean fallback.

---

### TICKET 4 — Agent Pipeline

**Goal:** The autonomous agent. Core of the hackathon track.

#### `lib/geo.ts`

- One function: `haversineDistance(lat1, lng1, lat2, lng2): number` → miles
- ~10 lines. Pure math, no dependencies.
- Used by `queryFeed` to filter events after pulling from ClickHouse

#### `lib/scoring.ts`

- One function: `scoreSeverity(event: CityEvent): "low" | "medium" | "high"`
- Checks title + summary for keywords:
  - High: `suspended`, `no service`, `emergency`, `major delay`, `stoppage`, `shutdown`
  - Medium: `delayed`, `reduced`, `complaint`, `disruption`, `outage`
  - Low: everything else
- No external calls. Pure keyword match.

#### `lib/agent/normalizeEvent.ts`

- Takes raw row + source name → returns `CityEvent`
- Generates `id`: `${source}_${simpleHash(title + occurredAt)}`
- Trims summary to 200 chars max
- Sets `fetchedAt` to `new Date().toISOString()`

#### `lib/agent/dedupeEvents.ts`

- Input: `CityEvent[]`
- Dedup key: same `source` + same `title` within 24h
- Keep most recent. Return deduplicated array.

#### `lib/agent/runAgent.ts`

Pipeline order — do not reorder:

```
1. span: fetch.nyc311      → nyc311.fetchRaw()
2. span: fetch.mta         → mta.fetchRaw()
3. span: fetch.nimble      → nimbleEvents.fetchRaw()
4. span: normalize         → normalizeEvent() on all results combined
5. span: dedupe            → dedupeEvents()
6. span: score             → scoreSeverity() on each event
7. span: clickhouse.insert → insertEvents()
8. span: feed.publish      → return AgentSummary
```

Each step wrapped in Datadog span or `console.log` fallback.

```typescript
type AgentSummary = {
  fetched: number;
  deduped: number;
  inserted: number;
  durationMs: number;
};
```

**Done when:** `runAgent()` completes, returns summary, spans log to Datadog or console.

---

### TICKET 5 — API Routes

**Goal:** Two routes. No business logic — just call lib functions.

#### `POST /api/ingest`

- Calls `runAgent()`
- Returns `{ success: true, summary: AgentSummary }`

#### `GET /api/feed`

- Params: `lat`, `lng`, `radiusMiles`, `category` (optional), `line` (optional)
- `lat` and `lng` may be omitted or set to `all`/`null` for All NYC mode
- Calls `queryFeed()`; ClickHouse pulls recent rows, JS handles radius and line filtering
- If empty → return `DEMO_EVENTS` (5 hardcoded, never blank)
- Returns `{ events: CityEvent[] }`

DEMO_EVENTS: 5 events covering all 3 categories and all 3 severities.

**Done when:** both routes return valid JSON, feed never blank.

### Scheduled Ingest

- `vercel.json` schedules `POST /api/ingest` hourly.
- This depends on Ticket 5 creating `app/api/ingest/route.ts`; until then the cron target 404s.

---

### TICKET 6 — Auth (Supabase)

**Goal:** Simple email/password auth. Do not block the feed behind this during demo.

- Supabase project already created manually (see setup docs)
- `app/login/page.tsx` — email + password form, no signup (create account in Supabase dashboard)
- On success → redirect to `/`
- Auth state in React context, checked on mount
- If not logged in → redirect to `/login`

**`app/profile/page.tsx`:**

- Shows current user email
- Location override input (saves to React state or Supabase user metadata)
- "Favorites" tab — Coming Soon placeholder, no backend needed
- Logout button

shadcn used here: `card`, `button`, `badge` only

**Done when:** login works, profile page loads, favorites tab shows "Coming Soon".

---

### TICKET 7 — Frontend Feed

**Goal:** Mobile-first TikTok-style feed. Simple. No extra libraries beyond shadcn.

Layout:

```
max-w-sm mx-auto          ← centers on desktop, full width on mobile
h-screen overflow-y-scroll scroll-snap-type-y-mandatory
```

Each card: `min-h-screen scroll-snap-align-start`

#### `components/FeedCard.tsx`

Uses shadcn `card` and `badge`. Shows in order:

1. Category badge — red=problem, blue=transit, green=event
2. Severity badge — red=high, yellow=medium, gray=low
3. Title (large, bold)
4. Summary (2-3 lines)
5. Distance if coords available ("0.3 mi away")
6. Borough / Neighborhood
7. Timestamp (relative: "2 hours ago")
8. Source label (small, muted)
9. "View Source →" if `sourceUrl` exists

#### `components/FeedFilters.tsx`

- shadcn `button` pills: All | Problems | Transit | Events
- Active state styled

#### `components/RadiusSelector.tsx`

- shadcn `select`: 0.5mi | 1mi | 2mi | 5mi | 10mi
- Default: 2mi

#### `components/LocationSearch.tsx`

- Text input + "Use my location" button
- Falls back to NYC center `(40.7128, -74.0060)` if denied

#### `app/page.tsx`

- Fetches `/api/feed` on mount and filter/radius change
- "Run Agent" button → calls `/api/ingest` → shows live step log
- Loading state between fetches
- Requires auth (redirect to `/login` if no session)

**Done when:** feed renders, scrolls, filters work, Run Agent fires, works on mobile and desktop.

---

### TICKET 8 — README

Sections:

1. What NYC Pulse does (2 sentences)
2. Sponsor tools and exactly how each is used
3. How the autonomous agent works (pipeline steps)
4. Setup: env vars, ClickHouse schema, Supabase project, run locally
5. Demo walkthrough (step by step)
6. Disclaimer: not for emergency response

---

## Rules — Both Agents Must Follow

1. Never change `CityEvent` type
2. Never add a library without a comment explaining why
3. Never leave a ticket half-done — stub with `// TODO:` and exact env var
4. Feed is never blank — demo fallback always fires
5. Sponsor tools must actually connect — not just stubbed forever
6. Files stay small — over ~100 lines, split it
7. One concern per file — fetchers fetch, normalizers normalize
8. Geo filter in JS using `lib/geo.ts`, not in SQL
9. All dates are ISO strings in `CityEvent`
10. `summarizeEvent.ts` does not exist — trimming is in `normalizeEvent.ts`

---

## Environment Variables

| Variable                        | File                          | Required                     |
| ------------------------------- | ----------------------------- | ---------------------------- |
| `CLICKHOUSE_HOST`               | `lib/clickhouse.ts`           | Yes                          |
| `CLICKHOUSE_USERNAME`           | `lib/clickhouse.ts`           | Yes                          |
| `CLICKHOUSE_PASSWORD`           | `lib/clickhouse.ts`           | Yes                          |
| `CLICKHOUSE_DATABASE`           | `lib/clickhouse.ts`           | Yes                          |
| `NIMBLE_API_KEY`                | `lib/sources/nimbleEvents.ts` | No (stubs if missing)        |
| `MTA_API_KEY`                   | `lib/sources/mta.ts`          | No (optional legacy key)     |
| `DATADOG_API_KEY`               | `lib/agent/runAgent.ts`       | No (console logs if missing) |
| `NEXT_PUBLIC_SUPABASE_URL`      | `app/login/page.tsx`          | Yes                          |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `app/login/page.tsx`          | Yes                          |

---

## Definition of Done

1. `npm run dev` starts without errors
2. `/api/ingest` runs full pipeline, returns `AgentSummary`
3. `/api/feed?lat=40.71&lng=-74.00&radiusMiles=2` returns events
4. Frontend scrolls, filters work, Run Agent fires
5. Datadog or console shows named spans for every step
6. ClickHouse Cloud shows rows in `city_events` after ingest
7. Feed never blank
8. Login works, profile page loads
