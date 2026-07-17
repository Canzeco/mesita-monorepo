export const MAX_INLINE_IMAGE_BYTES = 2 * 1024 * 1024; // ~2 MB cap per image

// Download an image inside the EF and return it as a base64 data: URL. Returns
// null (caller falls back to the remote URL) on any failure, oversize body, or
// missing/non-image content. Shares the per-image AbortController so the 25 s
// timeout covers download + describe together.
//
// The 2 MB cap is enforced by STREAMING the body: we read chunk-by-chunk and
// bail (cancelling the reader) the moment the running total exceeds the cap, so
// an oversized body is never fully buffered. This matters because IG/FB signed
// CDN links use chunked transfer with NO content-length — the declared-length
// fast-path below can't see their size, and visionDescribe downloads a batch of
// these concurrently, so buffering whole oversized bodies could breach the
// ~256 MB Edge Function memory ceiling and OOM-kill the isolate (uncatchable —
// a try/catch could not then fall back to the remote URL). Exported for tests.
export async function fetchAsDataUrl(
  url: string,
  signal: AbortSignal,
): Promise<string | null> {
  try {
    const r = await fetch(url, { signal });
    if (!r.ok) {
      await r.body?.cancel();
      return null;
    }
    const contentType = r.headers.get("content-type") ?? "";
    if (!/^image\//i.test(contentType)) {
      await r.body?.cancel();
      return null;
    }
    // Fast-path early reject when the server declares an oversized length.
    const declared = Number(r.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_INLINE_IMAGE_BYTES) {
      await r.body?.cancel();
      return null;
    }
    if (!r.body) return null;

    // Stream the body with a hard byte ceiling, independent of content-length.
    const reader = r.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value || value.byteLength === 0) continue;
        total += value.byteLength;
        if (total > MAX_INLINE_IMAGE_BYTES) {
          // Oversized: stop reading, release the connection, fall back to URL.
          await reader.cancel();
          return null;
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    if (total === 0) return null;

    // Concatenate the collected chunks and base64-encode (same style as before).
    const buf = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      buf.set(chunk, offset);
      offset += chunk.byteLength;
    }
    let binary = "";
    for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
    return `data:${contentType.split(";")[0]};base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}
