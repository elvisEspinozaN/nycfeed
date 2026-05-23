const NYC_311_URL = "https://data.cityofnewyork.us/resource/erm2-nwe9.json";

export type NYC311RawRow = {
  unique_key?: string;
  created_date?: string;
  closed_date?: string;
  agency?: string;
  agency_name?: string;
  complaint_type?: string;
  descriptor?: string;
  incident_zip?: string;
  incident_address?: string;
  street_name?: string;
  city?: string;
  status?: string;
  resolution_description?: string;
  borough?: string;
  latitude?: string;
  longitude?: string;
  location?: {
    latitude?: string;
    longitude?: string;
  };
  [key: string]: unknown;
};

export async function fetchRaw(): Promise<NYC311RawRow[]> {
  const url = new URL(NYC_311_URL);
  url.searchParams.set("$limit", "50");
  url.searchParams.set("$order", "created_date DESC");

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`NYC 311 request failed: ${response.status}`);
    }

    const data: unknown = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("NYC 311 response was not an array");
    }

    return data as NYC311RawRow[];
  } catch (error) {
    console.error("[nyc311] fetchRaw failed", error);
    return [];
  }
}
