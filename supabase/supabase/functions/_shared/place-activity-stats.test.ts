import { assertEquals } from "jsr:@std/assert@1";
import { fetchPlaceProfileStats } from "./place-activity-stats.ts";

// MESITA-3422: views are every open (place_view_counts over place_events);
// likes stay one per member (place_activity, kind saved).
Deno.test("fetchPlaceProfileStats counts every open and each like", async () => {
  const calls: string[] = [];
  const admin = {
    rpc(fn: string, args: { p_place_ids: string[] }) {
      assertEquals(fn, "place_view_counts");
      assertEquals(args.p_place_ids, ["p1"]);
      return Promise.resolve({ data: [{ place_id: "p1", views: "3" }], error: null });
    },
    from(table: string) {
      assertEquals(table, "place_activity");
      return {
        select(_cols: string, opts: { count: string; head: boolean }) {
          assertEquals(opts.count, "exact");
          assertEquals(opts.head, true);
          return {
            eq(col: string, val: string) {
              calls.push(`${col}=${val}`);
              return {
                eq(col2: string, kind: string) {
                  calls.push(`${col2}=${kind}`);
                  return Promise.resolve({ count: 1, error: null });
                },
              };
            },
          };
        },
      };
    },
  };
  const stats = await fetchPlaceProfileStats(admin as never, "p1");
  assertEquals(stats, { viewed: 3, saved: 1 });
  assertEquals(calls, ["place_id=p1", "kind=saved"]);
});

Deno.test("fetchPlaceProfileStats reads 0 views when the place has none", async () => {
  const admin = {
    rpc: () => Promise.resolve({ data: [], error: null }),
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => Promise.resolve({ count: 0, error: null }) }) }),
    }),
  };
  assertEquals(await fetchPlaceProfileStats(admin as never, "p1"), { viewed: 0, saved: 0 });
});
