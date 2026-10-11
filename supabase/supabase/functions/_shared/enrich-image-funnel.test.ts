// Unit tests for the streaming byte-cap in fetchAsDataUrl (network stubbed via
// globalThis.fetch) — the inline path the image funnel's vision step uses.
//   deno test --allow-net supabase/functions/_shared/enrich-image-funnel.test.ts

import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { fetchAsDataUrl, MAX_INLINE_IMAGE_BYTES } from "./enrich-image-data-url.ts";

// ── fetchAsDataUrl: streaming byte-cap (the MESITA-132 OOM fix) ─────────────

// Build a Response whose body is a ReadableStream that yields `chunkSize`-byte
// chunks up to `totalBytes`, WITHOUT a content-length header (mimics IG/FB
// chunked CDN transfer). `onPull` observes how many bytes are actually produced
// so a test can prove the whole body is never streamed after the cap trips.
function streamedResponse(opts: {
  totalBytes: number;
  chunkSize: number;
  contentType?: string;
  headers?: Record<string, string>;
  onProduced?: (bytesSoFar: number) => void;
}): Response {
  const { totalBytes, chunkSize, contentType = "image/jpeg", headers = {}, onProduced } = opts;
  let produced = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (produced >= totalBytes) {
        controller.close();
        return;
      }
      const size = Math.min(chunkSize, totalBytes - produced);
      produced += size;
      onProduced?.(produced);
      controller.enqueue(new Uint8Array(size).fill(0x41));
    },
  });
  return new Response(stream, { status: 200, headers: { "content-type": contentType, ...headers } });
}

async function withStubbedFetch(
  response: Response | (() => Response),
  fn: () => Promise<void>,
): Promise<void> {
  const original = globalThis.fetch;
  globalThis.fetch = () => Promise.resolve(typeof response === "function" ? response() : response);
  try {
    await fn();
  } finally {
    globalThis.fetch = original;
  }
}

Deno.test("fetchAsDataUrl: oversized no-content-length body returns null WITHOUT buffering it all", async () => {
  // 6 MB total in 256 KB chunks, no content-length: must bail near the 2 MB cap.
  const chunkSize = 256 * 1024;
  const totalBytes = 6 * 1024 * 1024;
  let maxProduced = 0;
  const res = streamedResponse({
    totalBytes,
    chunkSize,
    onProduced: (n) => {
      maxProduced = Math.max(maxProduced, n);
    },
  });
  await withStubbedFetch(res, async () => {
    const out = await fetchAsDataUrl("https://x.cdninstagram.com/big.jpg", new AbortController().signal);
    assertEquals(out, null); // caller falls back to the remote URL
  });
  // Proves streaming: reading stopped shortly past the cap, not at the full
  // 6 MB. Allow a couple of extra chunks beyond the cap — the ReadableStream's
  // default queuing strategy may pull ahead by a chunk or two before our
  // reader-side ceiling check trips on an already-read chunk.
  const ceiling = MAX_INLINE_IMAGE_BYTES + 2 * chunkSize;
  if (maxProduced > ceiling) {
    throw new Error(
      `expected to stop streaming near the cap (<= ${ceiling} bytes), but produced ${maxProduced} of ${totalBytes}`,
    );
  }
  // And unambiguously less than the full body (the OOM the fix prevents).
  if (maxProduced >= totalBytes) {
    throw new Error(`whole ${totalBytes}-byte body was buffered — streaming cap did not engage`);
  }
});

Deno.test("fetchAsDataUrl: declared oversized content-length is rejected up front", async () => {
  const res = streamedResponse({
    totalBytes: 1024,
    chunkSize: 1024,
    headers: { "content-length": String(MAX_INLINE_IMAGE_BYTES + 1) },
  });
  await withStubbedFetch(res, async () => {
    const out = await fetchAsDataUrl("https://x.cdninstagram.com/big.jpg", new AbortController().signal);
    assertEquals(out, null);
  });
});

Deno.test("fetchAsDataUrl: a small valid image returns a data: URL", async () => {
  const res = streamedResponse({ totalBytes: 8 * 1024, chunkSize: 4 * 1024, contentType: "image/png" });
  await withStubbedFetch(res, async () => {
    const out = await fetchAsDataUrl("https://x.cdninstagram.com/small.png", new AbortController().signal);
    if (out === null) throw new Error("expected a data: URL for a small valid image");
    assertStringIncludes(out, "data:image/png;base64,");
  });
});

Deno.test("fetchAsDataUrl: non-image content-type returns null", async () => {
  const res = streamedResponse({ totalBytes: 512, chunkSize: 512, contentType: "text/html" });
  await withStubbedFetch(res, async () => {
    const out = await fetchAsDataUrl("https://x.cdninstagram.com/page.html", new AbortController().signal);
    assertEquals(out, null);
  });
});

Deno.test("fetchAsDataUrl: empty body returns null", async () => {
  const res = streamedResponse({ totalBytes: 0, chunkSize: 1024 });
  await withStubbedFetch(res, async () => {
    const out = await fetchAsDataUrl("https://x.cdninstagram.com/empty.jpg", new AbortController().signal);
    assertEquals(out, null);
  });
});
