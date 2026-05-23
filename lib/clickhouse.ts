import { createClient } from "@clickhouse/client";

import { haversineDistance } from "@/lib/geo";
import type { CityEvent } from "@/types/event";
import type { CHRow } from "@/types/clickhouse";

let client: ReturnType<typeof createClient> | undefined;

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getClient() {
  client ??= createClient({
    url: requireEnv("CLICKHOUSE_HOST"),
    username: requireEnv("CLICKHOUSE_USERNAME"),
    password: requireEnv("CLICKHOUSE_PASSWORD"),
    database: requireEnv("CLICKHOUSE_DATABASE"),
  });

  return client;
}

const VALID_CATEGORIES = new Set(["problem", "transit", "event"]);

// ClickHouse DateTime → ISO string
function toIso(dt: string): string {
  return new Date(dt.replace(" ", "T") + "Z").toISOString();
}

// ISO string → ClickHouse DateTime format
function toCHDatetime(iso: string): string {
  return new Date(iso)
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d{3}Z$/, "");
}

export async function insertEvents(events: CityEvent[]): Promise<void> {
  if (events.length === 0) return;

  const rows = events.map((e) => ({
    id: e.id,
    source: e.source,
    category: e.category,
    title: e.title,
    summary: e.summary,
    borough: e.borough ?? null,
    neighborhood: e.neighborhood ?? null,
    latitude: e.latitude ?? null,
    longitude: e.longitude ?? null,
    address: e.address ?? null,
    source_url: e.sourceUrl ?? null,
    severity: e.severity,
    status: e.status ?? null,
    occurred_at: toCHDatetime(e.occurredAt),
    fetched_at: toCHDatetime(e.fetchedAt),
  }));

  await getClient().insert({
    table: "city_events",
    values: rows,
    format: "JSONEachRow",
  });
}

export async function queryFeed(
  lat: number,
  lng: number,
  radiusMiles: number,
  category?: string,
): Promise<CityEvent[]> {
  const safeCategory =
    category && VALID_CATEGORIES.has(category) ? category : null;
  const categoryClause = safeCategory
    ? `WHERE category = '${safeCategory}'`
    : "";

  const result = await getClient().query({
    query: `SELECT * FROM city_events ${categoryClause} ORDER BY fetched_at DESC LIMIT 200`,
    format: "JSONEachRow",
  });

  const rows = await result.json<CHRow>();

  return rows
    .map((row) => ({
      id: row.id,
      source: row.source as CityEvent["source"],
      category: row.category as CityEvent["category"],
      title: row.title,
      summary: row.summary,
      borough: row.borough ?? undefined,
      neighborhood: row.neighborhood ?? undefined,
      latitude: row.latitude ?? undefined,
      longitude: row.longitude ?? undefined,
      address: row.address ?? undefined,
      sourceUrl: row.source_url ?? undefined,
      severity: row.severity as CityEvent["severity"],
      status: row.status ?? undefined,
      occurredAt: toIso(row.occurred_at),
      fetchedAt: toIso(row.fetched_at),
    }))
    .filter((event) => {
      if (event.latitude === undefined || event.longitude === undefined) {
        // MTA alerts usually do not include coordinates, so keep events we
        // cannot distance-filter instead of removing whole categories.
        return true;
      }

      return (
        haversineDistance(lat, lng, event.latitude, event.longitude) <=
        radiusMiles
      );
    });
}
