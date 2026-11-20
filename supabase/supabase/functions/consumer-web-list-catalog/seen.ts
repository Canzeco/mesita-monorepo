// Home's light seen memory (MESITA-4459). The browser sends place ids it
// has already shown 3 or more times. Those sink to the end of the first
// page. They stay in the catalog. An empty fresh set leaves the page as
// ranked: a guest who has seen everything still gets a page.

import { isUuid } from "../_shared/place-id.ts";

/** How many seen ids a request may send. */
export const SEEN_CAP = 40;

/** Ids the guest has already been shown, capped, invalid ones dropped. */
export function readSeen(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const ids: string[] = [];
  for (const id of v) {
    if (typeof id !== "string" || !isUuid(id) || ids.includes(id)) continue;
    ids.push(id);
    if (ids.length >= SEEN_CAP) break;
  }
  return ids;
}

/**
 * Move seen ids to the end of the first page. The tail after the page is
 * untouched. When every first-page id is seen, the page stays put.
 */
export function demoteSeen(
  order: readonly string[],
  seen: readonly string[],
  pageSize: number,
): string[] {
  const n = Math.min(order.length, Math.max(0, Math.floor(pageSize)));
  if (n < 2 || seen.length === 0) return [...order];
  const heavy = new Set(seen);
  const head = order.slice(0, n);
  const fresh = head.filter((id) => !heavy.has(id));
  if (fresh.length === 0 || fresh.length === head.length) return [...order];
  const old = head.filter((id) => heavy.has(id));
  return [...fresh, ...old, ...order.slice(n)];
}
