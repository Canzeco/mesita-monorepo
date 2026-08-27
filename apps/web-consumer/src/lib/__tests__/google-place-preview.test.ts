import { describe, expect, it, vi } from "vitest";

import {
  fetchGooglePlacePreview,
  GOOGLE_PREVIEW_FIELD_MASK,
  isDisplayablePlacePhoto,
  type PlacesLibraryLike,
} from "@/lib/google-place-preview";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("isDisplayablePlacePhoto", () => {
  it("accepts googleusercontent and rejects the Places media URL", () => {
    expect(
      isDisplayablePlacePhoto("https://lh3.googleusercontent.com/p/hero"),
    ).toBe(true);
    expect(
      isDisplayablePlacePhoto(
        "https://places.googleapis.com/v1/places/ChIJ/photos/x/media?key=k",
      ),
    ).toBe(false);
  });
});

describe("fetchGooglePlacePreview", () => {
  it("prefers the Maps JS photo URI so the sheet hero can render", async () => {
    const get = vi.fn();
    const loadPlaces = vi.fn(async (): Promise<PlacesLibraryLike> => ({
      Place: class {
        formattedAddress?: string;
        googleMapsURI?: string;
        photos?: Array<{ getURI: (opts: { maxWidth: number }) => string }>;
        constructor(public opts: { id: string }) {}
        async fetchFields() {
          this.formattedAddress = "Ignacio Zaragoza 226, Monterrey";
          this.googleMapsURI = "https://maps.google.com/?cid=1";
          this.photos = [
            { getURI: () => "https://lh3.googleusercontent.com/p/eden" },
          ];
        }
      },
    }));

    const preview = await fetchGooglePlacePreview(
      "ChIJ1",
      "test-key",
      get,
      loadPlaces,
    );

    expect(get).not.toHaveBeenCalled();
    expect(preview).toEqual({
      photoUrl: "https://lh3.googleusercontent.com/p/eden",
      formattedAddress: "Ignacio Zaragoza 226, Monterrey",
      googleMapsUri: "https://maps.google.com/?cid=1",
    });
  });

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

    const preview = await fetchGooglePlacePreview(
      "ChIJ1",
      "test-key",
      get,
      async () => null,
      () => null,
    );

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
    const preview = await fetchGooglePlacePreview(
      "ChIJ2",
      "test-key",
      get,
      async () => null,
      () => null,
    );
    expect(get).toHaveBeenCalledTimes(1);
    expect(preview.photoUrl).toBeUndefined();
  });

  it("does not put the Places media URL in the img when skipHttpRedirect fails", async () => {
    const get = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/media")) {
        return jsonResponse({}, 403);
      }
      return jsonResponse({ photos: [{ name: "places/ChIJ3/photos/xyz" }] });
    });
    const preview = await fetchGooglePlacePreview(
      "ChIJ3",
      "test-key",
      get,
      async () => null,
      () => null,
    );
    expect(preview.photoUrl).toBeUndefined();
  });

  it("uses PlacesService getUrl when the new Place class is missing", async () => {
    const get = vi.fn();
    const loadService = vi.fn(() => {
      return class {
        getDetails(
          _req: { placeId: string; fields: string[] },
          cb: (
            result: {
              photos?: Array<{ getUrl: (opts: { maxWidth: number }) => string }>;
              formatted_address?: string;
              url?: string;
            } | null,
            status: string,
          ) => void,
        ) {
          cb(
            {
              photos: [
                { getUrl: () => "https://lh3.googleusercontent.com/p/service" },
              ],
              formatted_address: "Ignacio Zaragoza 226, Monterrey",
              url: "https://maps.google.com/?cid=2",
            },
            "OK",
          );
        }
      };
    });

    const preview = await fetchGooglePlacePreview(
      "ChIJ1",
      "test-key",
      get,
      async () => null,
      loadService,
    );

    expect(get).not.toHaveBeenCalled();
    expect(preview).toEqual({
      photoUrl: "https://lh3.googleusercontent.com/p/service",
      formattedAddress: "Ignacio Zaragoza 226, Monterrey",
      googleMapsUri: "https://maps.google.com/?cid=2",
    });
  });
});
