// One Google request (MESITA-2976): every Places (New) and Maps call goes
// through here, so each one sends the same headers and none can hang. A call
// without a deadline held its Edge Function open until the platform's wall
// clock killed it, and the guest saw a spinner instead of the lane's own
// "unavailable" answer. A timeout rejects like any network failure, so it
// lands in the caller's existing catch and every reply shape stays its own.

/** The deadline when a caller names none. Interactive search sees Google
 *  answer in 1-3 s; 10 s is a stall, not a slow page. */
export const GOOGLE_TIMEOUT_MS = 10_000;

export type GoogleFetchInit = {
  /** Sent as `X-Goog-Api-Key`. The legacy Maps web services (Geocoding,
   *  Time Zone) carry the key in the URL instead and leave this out. */
  apiKey?: string;
  /** Sent as `X-Goog-FieldMask`: what Places (New) bills by. */
  fieldMask?: string;
  /** POSTed as JSON when present; a GET otherwise. */
  body?: unknown;
  timeoutMs?: number;
};

export function googleFetch(
  url: string,
  init: GoogleFetchInit = {},
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (init.apiKey) headers["X-Goog-Api-Key"] = init.apiKey;
  if (init.fieldMask) headers["X-Goog-FieldMask"] = init.fieldMask;
  const post = init.body !== undefined;
  if (post) headers["Content-Type"] = "application/json";
  return fetch(url, {
    method: post ? "POST" : "GET",
    headers,
    ...(post ? { body: JSON.stringify(init.body) } : {}),
    signal: AbortSignal.timeout(init.timeoutMs ?? GOOGLE_TIMEOUT_MS),
  });
}
