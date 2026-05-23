// Cheerio parses Nimble-rendered NYC Parks HTML into raw event records.
import { load } from "cheerio";
import { NimbleEventRaw, NimbleExtractResponse } from "@/types/nimble";

const PARKS_EVENTS_URL = "https://www.nycgovparks.org/events";
const NIMBLE_EXTRACT_URL = "https://sdk.nimbleway.com/v1/extract";

const DEMO_EVENTS: NimbleEventRaw[] = [
  {
    _demo: true,
    event_name: "Demo: Bryant Park outdoor concert",
    date: "2026-06-01",
    location: "Bryant Park",
    borough: "Manhattan",
    url: PARKS_EVENTS_URL,
  },
  {
    _demo: true,
    event_name: "Demo: Prospect Park volunteer cleanup",
    date: "2026-06-03",
    location: "Prospect Park",
    borough: "Brooklyn",
    url: PARKS_EVENTS_URL,
  },
  {
    _demo: true,
    event_name: "Demo: Queens family movie night",
    date: "2026-06-05",
    location: "Flushing Meadows Corona Park",
    borough: "Queens",
    url: PARKS_EVENTS_URL,
  },
];

function demoEvents(reason: string): NimbleEventRaw[] {
  console.warn(`[nimble] using demo events: ${reason}`);
  return DEMO_EVENTS;
}

function absoluteUrl(path: string | undefined): string | undefined {
  if (!path) {
    return undefined;
  }

  return new URL(path, PARKS_EVENTS_URL).toString();
}

function extractEvents(html: string): NimbleEventRaw[] {
  const $ = load(html);

  return $(".row.event")
    .toArray()
    .slice(0, 25)
    .map((element) => {
      const event = $(element);
      const titleLink = event.find(".event-title a").first();
      const location = event.find(".location [itemprop='name']").first();
      const borough = event.find("[itemprop='addressLocality']").first();

      return {
        event_name: titleLink.text().trim() || undefined,
        date: event.find("meta[itemprop='startDate']").attr("content"),
        location: location.text().trim() || undefined,
        borough: borough.text().trim() || undefined,
        url: absoluteUrl(titleLink.attr("href")),
        raw: {
          html: $.html(element),
        },
      };
    })
    .filter(
      (event) =>
        event.event_name !== undefined ||
        event.date !== undefined ||
        event.location !== undefined,
    );
}

export async function fetchRaw(): Promise<NimbleEventRaw[]> {
  const apiKey = process.env.NIMBLE_API_KEY;

  if (!apiKey) {
    return demoEvents("NIMBLE_API_KEY is not set");
  }

  try {
    const response = await fetch(NIMBLE_EXTRACT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: PARKS_EVENTS_URL,
        render: true,
        driver: "vx10",
        formats: ["html"],
        country: "US",
        state: "NY",
        city: "new_york",
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Nimble request failed: ${response.status}`);
    }

    const data = (await response.json()) as NimbleExtractResponse;
    const html = data.data?.html;

    if (!html) {
      return demoEvents("Nimble returned no HTML");
    }

    const events = extractEvents(html);

    if (events.length === 0) {
      return demoEvents("Nimble returned no parseable events");
    }

    return events;
  } catch (error) {
    console.error("[nimble] fetchRaw failed", error);
    return demoEvents("extract request failed");
  }
}
