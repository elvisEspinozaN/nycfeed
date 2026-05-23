import type { CityEvent } from "@/types/event";

const WINDOW_MS = 24 * 60 * 60 * 1000;

export function dedupeEvents(events: CityEvent[]): CityEvent[] {
  const seen = new Map<string, CityEvent>();

  // Sort newest first so the first write to the Map is always the most recent
  const sorted = [...events].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );

  for (const event of sorted) {
    const bucket = Math.floor(new Date(event.occurredAt).getTime() / WINDOW_MS);
    const key = `${event.source}::${event.title.toLowerCase().trim()}::${bucket}`;
    if (!seen.has(key)) seen.set(key, event);
  }

  return Array.from(seen.values());
}
