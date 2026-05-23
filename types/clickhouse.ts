export type CHRow = {
  id: string;
  source: string;
  category: string;
  title: string;
  summary: string;
  borough: string | null;
  neighborhood: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  source_url: string | null;
  severity: string;
  status: string | null;
  occurred_at: string;
  fetched_at: string;
};
