import { describe, expect, it, vi } from "vitest";

import {
  fetchGooglePlacePreview,
  GOOGLE_PREVIEW_FIELD_MASK,
} from "@/lib/google-place-preview";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("fetchGooglePlacePreview", () => {
  it("asks Places (New) for the field mask, then the first photo only", async () => {
    const detailsHeaders: Array<HeadersInit | undefined> = [];
    const get = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (!url.includes("/media")) detailsHeaders.push(init?.headers);
      if (url.includes("/media")) {
        return jsonResponse({ photoUri: "https://lh3.googleusercontent.com/p/hero" });
      }
      return jsonResponse({
        photos: [{ name: "places/ChIJ1/photos/abc" }],
        formattedAddress: "Carlos Ramírez 641, San Nicolás",
        googleMapsUri: "https://maps.google.com/?cid=1",
      });
    });

    const preview = await fetchGooglePlacePreview("ChIJ1", "test-key", get);

    expect(get).toHaveBeenCalledTimes(2);
    expect(String(get.mock.calls[0][0])).toBe(
      "https://places.googleapis.com/v1/places/ChIJ1",
    );
    expect(detailsHeaders[0]).toEqual({
      "X-Goog-Api-Key": "test-key",
      "X-Goog-FieldMask": GOOGLE_PREVIEW_FIELD_MASK,
    });
    expect(GOOGLE_PREVIEW_FIELD_MASK).toContain("photos");
    expect(String(get.mock.calls[1][0])).toContain(
      "places/ChIJ1/photos/abc/media",
    );
    expect(String(get.mock.calls[1][0])).toContain("skipHttpRedirect=true");
    expect(preview).toEqual({
      photoUrl: "https://lh3.googleusercontent.com/p/hero",
      formattedAddress: "Carlos Ramírez 641, San Nicolás",
      googleMapsUri: "https://maps.google.com/?cid=1",
    });
  });

  it("skips the photo SKU when Details has no photos", async () => {
    const get = vi.fn(async () =>
      jsonResponse({ formattedAddress: "Monterrey" }),
    );
    const preview = await fetchGooglePlacePreview("ChIJ2", "test-key", get);
    expect(get).toHaveBeenCalledTimes(1);
    expect(preview.photoUrl).toBeUndefined();
  });

  it("falls back to the media URL when skipHttpRedirect is unavailable", async () => {
    const get = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/media")) {
        return jsonResponse({}, 403);
      }
      return jsonResponse({ photos: [{ name: "places/ChIJ3/photos/xyz" }] });
    });
    const preview = await fetchGooglePlacePreview("ChIJ3", "test-key", get);
    expect(preview.photoUrl).toContain(
      "places/ChIJ3/photos/xyz/media?maxWidthPx=1200",
    );
    expect(preview.photoUrl).not.toContain("skipHttpRedirect");
  });
});
