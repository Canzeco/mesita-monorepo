// Guards what consumer-web-report-place may write into public.place_reports
// (MESITA-2684): only a Mesita place, only a reason the table's CHECK allows,
// and a note that fits its 1–500 character CHECK. MESITA-3024: `other` needs
// a note, admin-web-list-place-reports lists one place or all of them and
// nothing in between, and the two apps label exactly these reasons.
import { assertEquals } from "jsr:@std/assert@1";

import {
  parsePlaceReport,
  parseReportListBody,
  PLACE_REPORT_REASONS,
} from "./place-reports.ts";

const PLACE = "7b0a1c52-3f4e-4d6a-9b8c-1e2f3a4b5c6d";

Deno.test("place report: the reasons are the table's CHECK", async () => {
  const sql = await Deno.readTextFile(
    new URL("../../migrations/20261029040000_place_reports_feedback_log.sql", import.meta.url),
  );
  const check = sql.slice(sql.indexOf("check (reason in ("));
  const keys = [...check.slice(0, check.indexOf("))")).matchAll(/'([a-z_]+)'/g)]
    .map((m) => m[1]);
  assertEquals(keys, [...PLACE_REPORT_REASONS]);
});

Deno.test("place report: both apps label exactly the table's reasons", async () => {
  const consumer = await Deno.readTextFile(
    new URL("../../../../apps/web-consumer/src/lib/api/reports.ts", import.meta.url),
  );
  const consumerKeys = [...consumer.matchAll(/key: "([a-z_]+)"/g)].map((m) => m[1]);
  assertEquals(consumerKeys, [...PLACE_REPORT_REASONS], "web-consumer reports.ts");

  const admin = await Deno.readTextFile(
    new URL("../../../../apps/web-admin/src/lib/report-reasons.ts", import.meta.url),
  );
  const adminKeys = [...admin.matchAll(/^\s+([a-z_]+): "/gm)].map((m) => m[1]);
  assertEquals(adminKeys, [...PLACE_REPORT_REASONS], "web-admin report-reasons.ts");
});

Deno.test("place report: a valid report passes, an empty note is no note", () => {
  assertEquals(parsePlaceReport({ place_id: PLACE, reason: "closed" }), {
    ok: true,
    report: { placeId: PLACE, reason: "closed", note: null },
  });
  assertEquals(
    parsePlaceReport({ place_id: PLACE, reason: "wrong_links", note: "  Instagram  " }),
    { ok: true, report: { placeId: PLACE, reason: "wrong_links", note: "Instagram" } },
  );
  assertEquals(
    parsePlaceReport({ place_id: PLACE, reason: "wrong_info", note: "   " }),
    { ok: true, report: { placeId: PLACE, reason: "wrong_info", note: null } },
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

Deno.test("place report: Something else needs words", () => {
  for (const note of [undefined, "", "   "]) {
    assertEquals(
      parsePlaceReport({ place_id: PLACE, reason: "other", note }),
      { ok: false, error: "note_required" },
    );
  }
});

Deno.test("report list: one place or every place, nothing in between", () => {
  const cases: [Record<string, unknown>, string][] = [
    [{ placeId: PLACE }, "place"],
    [{ projectId: PLACE }, "place"],
    [{ placeId: ` ${PLACE} ` }, "place"],
    [{ all: true }, "all"],
    [{}, "400"],
    [{ all: "true" }, "400"],
    [{ all: false }, "400"],
    [{ placeId: "x" }, "400"],
    [{ placeId: 123 }, "400"],
    [{ placeId: "" }, "400"],
    [{ placeId: 123, all: true }, "400"],
    [{ placeId: PLACE, all: true }, "400"],
  ];
  for (const [body, want] of cases) {
    const r = parseReportListBody(body);
    const got = r.ok ? r.scope.kind : "400";
    assertEquals(got, want, JSON.stringify(body));
    if (r.ok && r.scope.kind === "place") assertEquals(r.scope.placeId, PLACE);
  }
});
