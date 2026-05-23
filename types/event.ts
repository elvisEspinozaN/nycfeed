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
  occurredAt: string;
  fetchedAt: string;
};
