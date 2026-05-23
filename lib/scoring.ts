import type { CityEvent } from "@/types/event";

const HIGH = ["suspended", "no service", "emergency", "major delay", "stoppage", "shutdown"];
const MEDIUM = ["delayed", "reduced", "complaint", "disruption", "outage"];

export function scoreSeverity(event: CityEvent): "low" | "medium" | "high" {
  const text = `${event.title} ${event.summary}`.toLowerCase();
  if (HIGH.some((kw) => text.includes(kw))) return "high";
  if (MEDIUM.some((kw) => text.includes(kw))) return "medium";
  return "low";
}
