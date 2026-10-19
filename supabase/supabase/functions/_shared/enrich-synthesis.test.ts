// Unit tests for the synthesis output guards (no network, no DB).
//   deno test supabase/functions/_shared/enrich-synthesis.test.ts

import { assertEquals } from "jsr:@std/assert@1";
import {
  applyProfileToUpdate,
  asProfileText,
  formatDescriptionParagraphs,
  PRESENTATION_INSTRUCTIONS,
  type ProfileResult,
} from "./enrich-synthesis.ts";

Deno.test("asProfileText: trims strings, joins arrays and string-valued objects, drops the rest", () => {
  assertEquals(asProfileText("  hola  "), "hola");
  assertEquals(asProfileText(["Para uno.", " Para dos. "]), "Para uno.\n\nPara dos.");
  // gpt-4o-mini emits object-shaped descriptions under thin grounding — flatten them.
  assertEquals(
    asProfileText({ intro: "Un lugar.", ambiente: "Cálido." }),
    "Un lugar.\n\nCálido.",
  );
  assertEquals(asProfileText([{ paragraph: "objeto" }, "y texto"]), "objeto\n\ny texto");
  assertEquals(asProfileText({ n: 42 }), null);
  assertEquals(asProfileText(42), null);
  assertEquals(asProfileText(null), null);
  assertEquals(asProfileText([]), null);
  assertEquals(asProfileText("   "), null);
});

Deno.test("applyProfileToUpdate: off-type LLM fields never throw — dropped or coerced", () => {
  const update: Record<string, unknown> = {};
  // The MESITA-122 crash shape: json_object mode returned non-string fields.
  const parsed = {
    description: [{ paragraph: "objeto" }],
    zone: 7,
    city: null,
    editorial_summary: { text: "x" },
    products: { menu: [] },
    popular_times: "busy",
  } as unknown as ProfileResult;
  applyProfileToUpdate(update, parsed);
  assertEquals(update.description, "objeto");
  assertEquals("zone" in update, false);
  assertEquals("city" in update, false);
  assertEquals("products" in update, false);
  assertEquals("popular_times" in update, false);
});

Deno.test("applyProfileToUpdate: a paragraph ARRAY description is joined, not crashed on", () => {
  const update: Record<string, unknown> = {};
  applyProfileToUpdate(update, {
    description: ["Primer párrafo.", "Segundo párrafo."],
  } as unknown as ProfileResult);
  assertEquals(update.description, "Primer párrafo.\n\nSegundo párrafo.");
});

Deno.test("applyProfileToUpdate: happy path unchanged (trimmed, capped, typed)", () => {
  const update: Record<string, unknown> = {};
  applyProfileToUpdate(update, {
    description: "  Un lugar con historia.  ",
    zone: "San Pedro",
  } as ProfileResult);
  assertEquals(update.description, "Un lugar con historia.");
  assertEquals("zone" in update, false);
});

// MESITA-2420: the model could only guess busy hours from review text, and
// the guest card says "From Google". The prompt no longer asks, and a stale
// reply that still carries them writes nothing.
Deno.test("synthesis neither asks for nor writes popular times", () => {
  const update: Record<string, unknown> = {};
  applyProfileToUpdate(update, {
    description: "Un lugar.",
    popular_times: [{ day: "Fri", range: "8-11pm" }],
  } as ProfileResult);
  assertEquals("popular_times" in update, false);
  assertEquals(PRESENTATION_INSTRUCTIONS.includes("popular_times"), false);
});

// MESITA-2144: the editorial blurb stays in the LLM schema as classifier
// INPUT (the contents stage reads it off `parsed`), but it is no longer a
// place column — and the three retired keys never reach the patch either,
// even when a stale model reply still carries them.
Deno.test("applyProfileToUpdate: never writes editorial_summary or the retired profile keys", () => {
  const update: Record<string, unknown> = {};
  applyProfileToUpdate(update, {
    description: "A warm brunch spot.",
    editorial_summary: "Brunch institution.",
    established_year: 1998,
    executive_chef: "Ana",
    details: { dress_code: "casual" },
  } as unknown as ProfileResult);
  assertEquals(update.description, "A warm brunch spot.");
  for (const key of ["editorial_summary", "established_year", "executive_chef", "details"]) {
    assertEquals(key in update, false, key);
  }
});

Deno.test("applyProfileToUpdate: ignores description_es — English only for now", () => {
  const update: Record<string, unknown> = {};
  applyProfileToUpdate(update, {
    description: "A warm brunch spot.",
    description_es: "Un rincón cálido para brunch.",
  } as ProfileResult);
  assertEquals(update.description, "A warm brunch spot.");
  assertEquals(update.description_es, undefined);
});

Deno.test("applyProfileToUpdate does not write location from the model", () => {
  const update: Record<string, unknown> = {};
  applyProfileToUpdate(update, {
    zone: "Condesa",
    city: "CDMX",
    description: "A terrace.",
  } as unknown as ProfileResult);
  assertEquals(update.description, "A terrace.");
  assertEquals("zone" in update, false);
  assertEquals("city" in update, false);
});

Deno.test("formatDescriptionParagraphs: keeps blank-line paragraphs, collapses inner whitespace", () => {
  assertEquals(
    formatDescriptionParagraphs("Para uno.\n\n  Para   dos.  "),
    "Para uno.\n\nPara dos.",
  );
  // Single newlines also become paragraph breaks (models often omit the blank line).
  assertEquals(
    formatDescriptionParagraphs("Line one.\nLine two."),
    "Line one.\n\nLine two.",
  );
});

Deno.test("formatDescriptionParagraphs: splits a long wall of text into sentence packs", () => {
  const wall =
    "Alpha is a warm neighborhood spot with wood tables and soft light. " +
    "The kitchen leans Mexican with a few Japanese touches. " +
    "Regulars come for the tasting menu and the mezcal list. " +
    "Weekends fill early so reservations help. " +
    "The patio is quieter after nine. " +
    "Staff know the regulars by name.";
  const out = formatDescriptionParagraphs(wall);
  const paras = out.split("\n\n");
  assertEquals(paras.length >= 2, true);
  assertEquals(paras.every((p) => p.length > 0), true);
  assertEquals(out.includes("\n\n"), true);
});

Deno.test("applyProfileToUpdate: wall-of-text description becomes multi-paragraph", () => {
  const update: Record<string, unknown> = {};
  const wall =
    "Alpha is a warm neighborhood spot with wood tables and soft light. " +
    "The kitchen leans Mexican with a few Japanese touches. " +
    "Regulars come for the tasting menu and the mezcal list. " +
    "Weekends fill early so reservations help. " +
    "The patio is quieter after nine. " +
    "Staff know the regulars by name.";
  applyProfileToUpdate(update, { description: wall } as ProfileResult);
  assertEquals(typeof update.description, "string");
  assertEquals((update.description as string).includes("\n\n"), true);
});
