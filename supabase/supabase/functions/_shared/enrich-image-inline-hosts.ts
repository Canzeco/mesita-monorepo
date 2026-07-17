// Hosts whose signed/CDN links reject OpenAI's third-party image fetcher, so we
// must download the bytes inside the EF and inline them as a base64 data: URL.
// Extend this predicate as new blocking hosts surface.
const FETCHER_BLOCKED_HOST = /(^|\.)(cdninstagram\.com|fbcdn\.net)$/i;

export function needsInlineImage(url: string): boolean {
  try {
    return FETCHER_BLOCKED_HOST.test(new URL(url).hostname);
  } catch {
    return false;
  }
}
