export type NimbleEventRaw = {
  _demo?: true;
  event_name?: string;
  date?: string;
  location?: string;
  borough?: string;
  url?: string;
  raw?: unknown;
};

export type NimbleExtractResponse = {
  status?: string;
  status_code?: number;
  data?: {
    html?: string;
  };
};
