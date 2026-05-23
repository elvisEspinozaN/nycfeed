import type { CityEvent } from "@/types/event";
import type { NYC311RawRow } from "@/lib/sources/nyc311";
import type { MTARawAlert } from "@/types/mta";
import type { NimbleEventRaw } from "@/types/nimble";

function simpleHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

function trim200(s: string): string {
  return s.length > 200 ? s.slice(0, 197) + "..." : s;
}

function normalize311(raw: NYC311RawRow): CityEvent {
  const title = raw.complaint_type ?? raw.descriptor ?? "311 Complaint";
  const summary = trim200(raw.resolution_description ?? raw.descriptor ?? raw.complaint_type ?? "");
  const occurredAt = raw.created_date
    ? new Date(raw.created_date).toISOString()
    : new Date().toISOString();

  return {
    id: `nyc_311_${simpleHash(title + occurredAt)}`,
    source: "nyc_311",
    category: "problem",
    title,
    summary,
    borough: raw.borough ?? undefined,
    latitude: raw.latitude ? parseFloat(raw.latitude) : undefined,
    longitude: raw.longitude ? parseFloat(raw.longitude) : undefined,
    address: raw.incident_address,
    severity: "low",
    status: raw.status,
    occurredAt,
    fetchedAt: new Date().toISOString(),
  };
}

function normalizeMta(raw: MTARawAlert): CityEvent {
  const alert = raw.alert as Record<string, unknown>;
  const translations = (alert?.headerText as { translation?: { text?: string }[] })
    ?.translation ?? [];
  const descTranslations = (alert?.descriptionText as { translation?: { text?: string }[] })
    ?.translation ?? [];

  const title = translations[0]?.text ?? "MTA Alert";
  const summary = trim200(descTranslations[0]?.text ?? "");
  const now = new Date().toISOString();

  return {
    id: `mta_${raw.id || simpleHash(title)}`,
    source: "mta",
    category: "transit",
    title,
    summary,
    severity: "low",
    occurredAt: now,
    fetchedAt: now,
  };
}

function normalizeNimble(raw: NimbleEventRaw): CityEvent {
  const title = raw.event_name ?? "NYC Parks Event";
  const summary = trim200(
    [raw.location, raw.borough].filter(Boolean).join(", ") || "NYC Parks Event",
  );
  const occurredAt = raw.date
    ? new Date(raw.date).toISOString()
    : new Date().toISOString();

  return {
    id: `nimble_events_${simpleHash(title + occurredAt)}`,
    source: "nimble_events",
    category: "event",
    title,
    summary,
    borough: raw.borough,
    sourceUrl: raw.url,
    severity: "low",
    occurredAt,
    fetchedAt: new Date().toISOString(),
  };
}

export function normalizeEvent(raw: unknown, source: CityEvent["source"]): CityEvent | null {
  try {
    if (source === "nyc_311") return normalize311(raw as NYC311RawRow);
    if (source === "mta") return normalizeMta(raw as MTARawAlert);
    if (source === "nimble_events") return normalizeNimble(raw as NimbleEventRaw);
    return null;
  } catch (err) {
    console.error(`[normalize] failed for source ${source}`, err);
    return null;
  }
}
