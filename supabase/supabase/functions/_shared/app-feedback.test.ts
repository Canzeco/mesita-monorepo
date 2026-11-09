// Guards what consumer-web-send-feedback may write into public.app_feedback
// (MESITA-3029): words, trimmed, within the table's 1–1000 character CHECK.
import { assertEquals } from "jsr:@std/assert@1";

import { APP_FEEDBACK_NOTE_MAX, parseAppFeedback } from "./app-feedback.ts";

Deno.test("app feedback: the cap is the table's CHECK", async () => {
  const sql = await Deno.readTextFile(
    new URL("../../migrations/20261109105000_app_feedback.sql", import.meta.url),
  );
  assertEquals(
    sql.includes(`check (char_length(note) between 1 and ${APP_FEEDBACK_NOTE_MAX})`),
    true,
  );
});

Deno.test("app feedback: words pass trimmed; blank, missing or too long refuse", () => {
  assertEquals(parseAppFeedback({ note: "  love it  " }), { ok: true, note: "love it" });
  for (const note of [undefined, null, 42, "", "   "]) {
    assertEquals(parseAppFeedback({ note }), { ok: false, error: "note_required" });
  }
  assertEquals(parseAppFeedback({ note: "x".repeat(APP_FEEDBACK_NOTE_MAX) }).ok, true);
  assertEquals(parseAppFeedback({ note: "x".repeat(APP_FEEDBACK_NOTE_MAX + 1) }).ok, false);
});
