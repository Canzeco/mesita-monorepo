import { invokeEF } from "@/lib/api/_invoke";
import { createBrowserSupabase } from "@/lib/supabase/browser";

const KEY = "mesita.premier-ad.v1";

/** True the first time this tab reports this place and kind (MESITA-4460). */
export function rememberAd(seen: string[], placeId: string, kind: "impression" | "tap"): string[] | null {
  const mark = `${kind}:${placeId}`;
  if (seen.includes(mark)) return null;
  return [...seen, mark].slice(-200);
}

/** Reports one ad shown or opened. A repeat in this tab does not leave. */
export function notePremierAd(placeId: string, kind: "impression" | "tap"): void {
  if (typeof window === "undefined" || !placeId) return;
  let seen: string[] = [];
  try {
    const raw = JSON.parse(sessionStorage.getItem(KEY) || "[]");
    seen = Array.isArray(raw) ? raw.filter((x) => typeof x === "string") : [];
  } catch {
    seen = [];
  }
  const next = rememberAd(seen, placeId, kind);
  if (!next) return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* a full store still reports this once */
  }
  void invokeEF(createBrowserSupabase(), "consumer-web-record-premier-ad", { place_id: placeId, kind }).catch(() => {});
}
