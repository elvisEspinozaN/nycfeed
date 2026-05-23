// gtfs-realtime-bindings decodes MTA's GTFS-RT protobuf alert feed.
import { transit_realtime } from "gtfs-realtime-bindings";
import type { MTARawAlert } from "@/types/mta";

const MTA_ALERTS_URL =
  "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/camsys%2Fsubway-alerts";

const DEMO_ALERTS: MTARawAlert[] = [
  {
    _demo: true,
    id: "mta_demo_a_delay",
    alert: {
      headerText: {
        translation: [{ language: "en", text: "Demo: A trains are delayed" }],
      },
      descriptionText: {
        translation: [
          {
            language: "en",
            text: "Demo fallback alert shown because the public MTA feed could not be fetched.",
          },
        ],
      },
      informedEntity: [{ agencyId: "MTA NYCT", routeId: "A" }],
      cause: "UNKNOWN_CAUSE",
      effect: "SIGNIFICANT_DELAYS",
    },
  },
  {
    _demo: true,
    id: "mta_demo_l_service_change",
    alert: {
      headerText: {
        translation: [{ language: "en", text: "Demo: L service change" }],
      },
      descriptionText: {
        translation: [
          {
            language: "en",
            text: "Demo fallback alert for planned subway service changes.",
          },
        ],
      },
      informedEntity: [{ agencyId: "MTA NYCT", routeId: "L" }],
      cause: "CONSTRUCTION",
      effect: "MODIFIED_SERVICE",
    },
  },
  {
    _demo: true,
    id: "mta_demo_7_slow",
    alert: {
      headerText: {
        translation: [{ language: "en", text: "Demo: 7 trains running slow" }],
      },
      descriptionText: {
        translation: [
          {
            language: "en",
            text: "Demo fallback alert for minor subway delays.",
          },
        ],
      },
      informedEntity: [{ agencyId: "MTA NYCT", routeId: "7" }],
      cause: "UNKNOWN_CAUSE",
      effect: "SIGNIFICANT_DELAYS",
    },
  },
];

function demoAlerts(reason: string): MTARawAlert[] {
  console.warn(`[mta] using demo alerts: ${reason}`);
  return DEMO_ALERTS;
}

export async function fetchRaw(): Promise<MTARawAlert[]> {
  const apiKey = process.env.MTA_API_KEY;

  try {
    const response = await fetch(MTA_ALERTS_URL, {
      headers: apiKey ? { "x-api-key": apiKey } : undefined,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`MTA request failed: ${response.status}`);
    }

    const buffer = new Uint8Array(await response.arrayBuffer());
    const feed = transit_realtime.FeedMessage.decode(buffer);

    return feed.entity
      .filter((entity) => entity.alert !== null && entity.alert !== undefined)
      .map((entity) => {
        // The package types expose entity.alert as IAlert, while toObject needs
        // an Alert instance.
        const alert = transit_realtime.Alert.fromObject(entity.alert!);

        return {
          id: entity.id,
          alert: transit_realtime.Alert.toObject(alert, {
            defaults: false,
            enums: String,
            longs: String,
          }) as Record<string, unknown>,
        };
      });
  } catch (error) {
    console.error("[mta] fetchRaw failed", error);
    return demoAlerts("feed fetch or decode failed");
  }
}
