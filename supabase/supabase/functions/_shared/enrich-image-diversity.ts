import type { Img } from "./enrich-config.ts";

// Pick the final photo set with a SOURCE-DIVERSITY floor: reserve up to
// reservePerSource of each non-Google source's best (in `ordered` order), then
// fill the remaining slots by overall order, capped at `cap`.
export function selectWithDiversity(
  ordered: string[],
  srcOf: Map<string, Img["source"]>,
  cap: number,
): string[] {
  const reservePerSource = Math.min(3, Math.max(1, Math.floor(cap / 4)));
  const picked: string[] = [];
  const seen = new Set<string>();
  const take = (u: string) => {
    if (u && !seen.has(u) && picked.length < cap) {
      seen.add(u);
      picked.push(u);
    }
  };
  for (const src of ["instagram", "website"] as const) {
    let n = 0;
    for (const u of ordered) {
      if (n >= reservePerSource) break;
      if (srcOf.get(u) === src && !seen.has(u)) {
        take(u);
        n += 1;
      }
    }
  }
  for (const u of ordered) take(u);
  return picked;
}
