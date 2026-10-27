import { assertEquals } from "jsr:@std/assert@1";
import { aggregate, readMonth, readRunPage } from "./usage.ts";

// Money: the spend per scraper has to add up to what Apify billed.
Deno.test("aggregate: spend, outcomes and the window per scraper", () => {
  const since = Date.parse("2026-10-01T00:00:00Z");
  const { rows } = readRunPage({
    data: {
      items: [
        { actId: "G", status: "SUCCEEDED", startedAt: "2026-10-20T00:00:00Z", finishedAt: "2026-10-20T00:01:30Z", usageTotalUsd: 0.2 },
        { actId: "G", status: "TIMED-OUT", startedAt: "2026-10-21T00:00:00Z", finishedAt: "2026-10-21T00:05:00Z", usageTotalUsd: 0.3 },
        { actId: "I", status: "FAILED", startedAt: "2026-10-22T00:00:00Z", finishedAt: null, usageTotalUsd: 0.01 },
        { actId: "X", status: "SUCCEEDED", startedAt: "2026-10-22T00:00:00Z", usageTotalUsd: 1 },
        { actId: "G", status: "SUCCEEDED", startedAt: "2026-09-20T00:00:00Z", usageTotalUsd: 9 },
        { status: "SUCCEEDED" },
      ],
    },
  });
  const { scrapers, other } = aggregate(rows, { googleMaps: "G", instagramProfile: "I", instagramPosts: null, facebookPages: "F" }, since);
  const g = scrapers.find((s) => s.key === "googleMaps")!;
  assertEquals([g.runs, g.succeeded, g.timedOut, g.spendUsd, g.successRate], [2, 1, 1, 0.5, 0.5]);
  assertEquals(g.avgDurationSec, 195);
  assertEquals([g.lastFailureStatus, g.lastFailureAt], ["TIMED-OUT", "2026-10-21T00:00:00Z"]);
  const i = scrapers.find((s) => s.key === "instagramProfile")!;
  assertEquals([i.runs, i.failed, i.successRate, i.avgDurationSec], [1, 1, 0, null]);
  assertEquals(scrapers.find((s) => s.key === "instagramPosts")!.runs, 0);
  assertEquals(other, { runs: 1, spendUsd: 1 });
});

Deno.test("readMonth: spend after discount, the limit, daily in date order", () => {
  const m = readMonth(
    {
      data: {
        usageCycle: { startAt: "2026-10-05T00:00:00Z", endAt: "2026-11-04T23:59:59Z" },
        totalUsageCreditsUsdAfterVolumeDiscount: 12.5,
        dailyServiceUsages: [
          { date: "2026-10-07T00:00:00Z", totalUsageCreditsUsd: 2 },
          { date: "2026-10-06T00:00:00Z", totalUsageCreditsUsd: 1 },
        ],
      },
    },
    { data: { limits: { maxMonthlyUsageUsd: 49 }, current: { monthlyUsageUsd: 12 } } },
  );
  assertEquals([m.spendUsd, m.limitUsd], [12.5, 49]);
  assertEquals(m.daily.map((d) => d.date), ["2026-10-06", "2026-10-07"]);
  assertEquals(readMonth(null, null).spendUsd, null);
});
