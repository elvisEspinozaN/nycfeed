import { NextRequest, NextResponse } from "next/server";
import { queryFeed } from "@/lib/clickhouse";
import type { CityEvent } from "@/types/event";

const now = () => new Date().toISOString();
const future = () => new Date(Date.now() + 86_400_000).toISOString();

// Shown when ClickHouse is empty — covers all 3 categories and all 3 severities
const DEMO_EVENTS: CityEvent[] = [
  {
    id: "demo_1",
    source: "nyc_311",
    category: "problem",
    title: "Water main break on Broadway",
    summary: "Large water main break causing street flooding near Times Square.",
    borough: "Manhattan",
    neighborhood: "Midtown",
    latitude: 40.758,
    longitude: -73.9855,
    severity: "high",
    status: "Open",
    occurredAt: now(),
    fetchedAt: now(),
  },
  {
    id: "demo_2",
    source: "mta",
    category: "transit",
    title: "A/C/E: Delays due to signal problems",
    summary: "Trains running with delays in both directions due to signal problems at Jay St.",
    neighborhood: "A C E",
    severity: "medium",
    occurredAt: now(),
    fetchedAt: now(),
  },
  {
    id: "demo_3",
    source: "nimble_events",
    category: "event",
    title: "Prospect Park Summer Concert",
    summary: "Free outdoor concert at the Bandshell. Bring a blanket.",
    borough: "Brooklyn",
    neighborhood: "Prospect Park",
    latitude: 40.6602,
    longitude: -73.969,
    severity: "low",
    sourceUrl: "https://www.nycgovparks.org/events",
    occurredAt: future(),
    fetchedAt: now(),
  },
  {
    id: "demo_4",
    source: "mta",
    category: "transit",
    title: "L train: Weekend service suspended",
    summary: "L train suspended between 8th Ave and Bedford Av for track maintenance.",
    neighborhood: "L",
    severity: "high",
    occurredAt: now(),
    fetchedAt: now(),
  },
  {
    id: "demo_5",
    source: "nyc_311",
    category: "problem",
    title: "Noise complaint – after-hours construction",
    summary: "Excessive construction noise reported after hours in residential area.",
    borough: "Queens",
    neighborhood: "Astoria",
    latitude: 40.7721,
    longitude: -73.9302,
    severity: "low",
    status: "In Progress",
    occurredAt: now(),
    fetchedAt: now(),
  },
];

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;

  const lat = p.get("lat") ? parseFloat(p.get("lat")!) : null;
  const lng = p.get("lng") ? parseFloat(p.get("lng")!) : null;
  const radiusMiles = p.get("radiusMiles") ? parseFloat(p.get("radiusMiles")!) : 2;
  const line = p.get("line") ?? undefined;
  const category = line ? "transit" : p.get("category") ?? undefined;

  try {
    const events = await queryFeed(lat, lng, radiusMiles, category, line);
    return NextResponse.json({ events: events.length > 0 ? events : DEMO_EVENTS });
  } catch (error) {
    console.error("[feed] queryFeed failed", error);
    return NextResponse.json({ events: DEMO_EVENTS });
  }
}
