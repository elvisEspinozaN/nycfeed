import { fetchRaw as fetch311 } from "@/lib/sources/nyc311";
import { fetchRaw as fetchMta } from "@/lib/sources/mta";
import { fetchRaw as fetchNimble } from "@/lib/sources/nimbleEvents";
import { normalizeEvent } from "@/lib/agent/normalizeEvent";
import { dedupeEvents } from "@/lib/agent/dedupeEvents";
import { scoreSeverity } from "@/lib/scoring";
import { insertEvents } from "@/lib/clickhouse";

import { AgentSummary } from "@/types/agent";

// TODO: real integration — swap body for dd-trace span when DATADOG_API_KEY is set
async function withSpan<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  console.log(`[span:start] ${name}`);
  const result = await fn();
  console.log(`[span:end]   ${name} (${Date.now() - start}ms)`);
  return result;
}

export async function runAgent(): Promise<AgentSummary> {
  const start = Date.now();

  const [raw311, rawMta, rawNimble] = await Promise.all([
    withSpan("fetch.nyc311", fetch311),
    withSpan("fetch.mta", fetchMta),
    withSpan("fetch.nimble", fetchNimble),
  ]);

  const allRaw = [
    ...raw311.map((r) => ({ raw: r, source: "nyc_311" as const })),
    ...rawMta.map((r) => ({ raw: r, source: "mta" as const })),
    ...rawNimble.map((r) => ({ raw: r, source: "nimble_events" as const })),
  ];

  const normalized = await withSpan("normalize", async () =>
    allRaw
      .map(({ raw, source }) => normalizeEvent(raw, source))
      .filter((e): e is NonNullable<typeof e> => e !== null),
  );

  const deduped = await withSpan("dedupe", async () =>
    dedupeEvents(normalized),
  );

  const scored = await withSpan("score", async () =>
    deduped.map((e) => ({ ...e, severity: scoreSeverity(e) })),
  );

  await withSpan("clickhouse.insert", () => insertEvents(scored));

  return withSpan("feed.publish", async () => ({
    fetched: allRaw.length,
    deduped: deduped.length,
    inserted: scored.length,
    durationMs: Date.now() - start,
  }));
}
