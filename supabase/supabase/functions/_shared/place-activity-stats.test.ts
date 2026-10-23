import { assertEquals } from "jsr:@std/assert@1";
import { fetchPlaceProfileStats } from "./place-activity-stats.ts";

Deno.test("fetchPlaceProfileStats queries viewed and saved kinds", async () => {
  const calls: string[] = [];
  const admin = {
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
                  return Promise.resolve({
                    count: kind === "viewed" ? 3 : 1,
                    error: null,
                  });
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
  assertEquals(calls.includes("place_id=p1"), true);
  assertEquals(calls.includes("kind=viewed"), true);
  assertEquals(calls.includes("kind=saved"), true);
});
