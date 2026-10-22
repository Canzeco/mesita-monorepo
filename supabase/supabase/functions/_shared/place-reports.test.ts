// Guards what consumer-web-report-place may write into public.place_reports
// (MESITA-2684): only a Mesita place, only a reason the table's CHECK allows,
// and a note that fits its 1–500 character CHECK.
import { assertEquals } from "jsr:@std/assert@1";

import { parsePlaceReport, PLACE_REPORT_REASONS } from "./place-reports.ts";

const PLACE = "7b0a1c52-3f4e-4d6a-9b8c-1e2f3a4b5c6d";

Deno.test("place report: the reasons are the table's CHECK", async () => {
  const sql = await Deno.readTextFile(
    new URL("../../migrations/20261022183000_place_reports.sql", import.meta.url),
  );
  for (const reason of PLACE_REPORT_REASONS) {
    assertEquals(sql.includes(`'${reason}'`), true, reason);
  }
});

Deno.test("place report: a valid report passes, an empty note is no note", () => {
  assertEquals(parsePlaceReport({ place_id: PLACE, reason: "closed" }), {
    ok: true,
    report: { placeId: PLACE, reason: "closed", note: null },
  });
  assertEquals(
    parsePlaceReport({ place_id: PLACE, reason: "other", note: "   " }),
    { ok: true, report: { placeId: PLACE, reason: "other", note: null } },
  );
  assertEquals(
    parsePlaceReport({ place_id: PLACE, reason: "other", note: "  moved  " }),
    { ok: true, report: { placeId: PLACE, reason: "other", note: "moved" } },
  );
});

Deno.test("place report: refuses what the table must never hold", () => {
  for (
    const body of [
      { place_id: "g:ChIJx", reason: "closed" },
      { place_id: PLACE, reason: "spam" },
      { place_id: PLACE },
      { place_id: PLACE, reason: "other", note: 42 },
      { place_id: PLACE, reason: "other", note: "x".repeat(501) },
    ]
  ) {
    assertEquals(parsePlaceReport(body).ok, false, JSON.stringify(body));
  }
});
