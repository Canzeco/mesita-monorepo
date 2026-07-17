// Google Places API error classification + operator-friendly copy.
// Extracted from google-places.ts so call sites that only need error
// handling can import without pulling key/URL helpers.

type GoogleErrorCode =
  | "google_referrer_blocked"
  | "google_api_disabled"
  | "google_quota_exceeded"
  | "google_permission_denied"
  | "google_bad_request"
  | "google_not_found"
  | "google_rate_limited"
  | "google_unavailable"
  | "google_error";

export function classifyGoogleError(status: number, body: string): GoogleErrorCode {
  if (status === 403) {
    if (/referer|referrer/i.test(body)) return "google_referrer_blocked";
    if (/api.+disabled|not.+enabled/i.test(body)) return "google_api_disabled";
    if (/quota|exceeded/i.test(body)) return "google_quota_exceeded";
    return "google_permission_denied";
  }
  if (status === 400) return "google_bad_request";
  if (status === 404) return "google_not_found";
  if (status === 429) return "google_rate_limited";
  if (status >= 500) return "google_unavailable";
  return "google_error";
}

export function friendlyGoogleError(
  code: GoogleErrorCode,
  status: number,
  body: string,
): string {
  switch (code) {
    case "google_referrer_blocked":
      return "Google rejected the request — the API key has a referrer / IP restriction blocking server-to-server calls. Remove the HTTP-referrer restriction on the Mesita backend key (the browser key keeps its restriction).";
    case "google_api_disabled":
      return "Google Places API (New) isn't enabled on the configured key. Enable it in Google Cloud → APIs & Services.";
    case "google_quota_exceeded":
      return "The Google Places quota for today is exhausted. Try again later or raise the daily cap in Google Cloud.";
    case "google_permission_denied":
      return "Google denied the request (permission). Check that the API key is valid and the project is billing-enabled.";
    case "google_bad_request":
      return `Google rejected the request: ${body.slice(0, 200)}`;
    case "google_not_found":
      return "Google can't find that place anymore — pick a different result.";
    case "google_rate_limited":
      return "Too many requests in a short window. Wait a few seconds and try again.";
    case "google_unavailable":
      return "Google Places is unavailable right now (5xx). Try again in a moment.";
    default:
      return `Google ${status}: ${body.slice(0, 200)}`;
  }
}

// Throws an Error with the classified message — used by code paths that
// can't gracefully degrade per-call (e.g., admin-web-discover-places' per-query
// worker, where one bad query shouldn't crash the batch but should be
// reported alongside the others).
export async function googleErrorFromResponse(r: Response): Promise<Error> {
  const text = await r.text();
  const code = classifyGoogleError(r.status, text);
  return new Error(friendlyGoogleError(code, r.status, text));
}
