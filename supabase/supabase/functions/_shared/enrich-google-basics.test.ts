// deno test supabase/functions/_shared/enrich-google-basics.test.ts
import { assertEquals } from "jsr:@std/assert@1";
import { fetchGoogleBasics, fetchGoogleDetails } from "./enrich-google-basics.ts";

// A network failure on Place Details is transient (503 google_unavailable on
// create-place / update-from-Google), never a throw out of a handler that has
// no catch of its own (MESITA-2855).
Deno.test("fetchGoogleDetails: a network failure is a transient error, not a throw", async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = () => Promise.reject(new TypeError("network down"));
  try {
    const res = await fetchGoogleDetails("ChIJ-x", "k");
    assertEquals("error" in res && res.transient, true);
  } finally {
    globalThis.fetch = orig;
  }
});

Deno.test("fetchGoogleBasics: an unreadable 200 body answers 503 google_unavailable", async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = () => Promise.resolve(new Response("<html>", { status: 200 }));
  try {
    const res = await fetchGoogleBasics("ChIJ-x", "k");
    assertEquals(res.ok, false);
    if (!res.ok) {
      assertEquals(res.code, "google_unavailable");
      assertEquals(res.status, 503);
    }
  } finally {
    globalThis.fetch = orig;
  }
});
