import { assertEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  extFor,
  imageIdFromPath,
  isHttpUrl,
  type PlaceImageAssetInput,
  sanitiseAssets,
  sanitiseUrls,
  storeFirstPlaceImage,
} from "./store-place-images.ts";

Deno.test("sanitiseAssets dedupes and caps invalid rows", () => {
  const assets = sanitiseAssets([
    { source: "google", source_url: "https://a.example/1.jpg" },
    { source: "google", source_url: "https://a.example/1.jpg" },
    { source: "bad", source_url: "https://a.example/2.jpg" } as unknown as PlaceImageAssetInput,
    { source: "website", source_url: "data:image/png;base64,abc" },
    { source: "instagram", source_url: "https://a.example/3.jpg", likes_count: 12.7 },
  ]);
  assertEquals(assets.length, 2);
  assertEquals(assets[0].source_url, "https://a.example/1.jpg");
  assertEquals(assets[1].likes_count, 12);
});

Deno.test("sanitiseUrls keeps http(s) only", () => {
  assertEquals(
    sanitiseUrls([" https://x.test/a ", "ftp://x.test/b", "https://x.test/a"]),
    ["https://x.test/a"],
  );
});

Deno.test("isHttpUrl rejects non-http schemes", () => {
  assertEquals(isHttpUrl("https://ok.test/x"), true);
  assertEquals(isHttpUrl("data:image/png;base64,abc"), false);
});

Deno.test("extFor maps common image types", () => {
  assertEquals(extFor("image/png"), "png");
  assertEquals(extFor("image/jpeg"), "jpg");
});

Deno.test("imageIdFromPath extracts sha256 stem", () => {
  const id = "a".repeat(64);
  assertEquals(imageIdFromPath(`images/${id}.webp`), id);
  assertEquals(imageIdFromPath("images/not-a-hash.jpg"), null);
});

function fakeFirstPhotoAdmin() {
  const calls = {
    upserts: [] as unknown[],
    assetUpdates: [] as unknown[],
    placePatches: [] as unknown[],
    uploads: [] as { path: string; bytes: number; contentType: string }[],
  };

  const client = {
    from(table: string) {
      return {
        upsert(row: unknown) {
          if (table === "place_media_assets") calls.upserts.push(row);
          return Promise.resolve({ error: null });
        },
        update(patch: unknown) {
          if (table === "place_media_assets") calls.assetUpdates.push(patch);
          if (table === "profiles") calls.placePatches.push(patch);
          const chain = {
            eq() {
              return chain;
            },
            then(onfulfilled: (v: { error: null }) => unknown) {
              return Promise.resolve({ error: null }).then(onfulfilled);
            },
          };
          return chain;
        },
      };
    },
    storage: {
      from() {
        return {
          upload(path: string, bytes: Uint8Array, opts: { contentType: string }) {
            calls.uploads.push({
              path,
              bytes: bytes.byteLength,
              contentType: opts.contentType,
            });
            return Promise.resolve({ error: null });
          },
        };
      },
    },
  };

  return { client: client as unknown as SupabaseClient, calls };
}

Deno.test("storeFirstPlaceImage awaits one Google photo into place-images", async () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const source = "https://lh3.googleusercontent.com/p/first";
  const origFetch = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL) => {
    if (String(input) === source) {
      return Promise.resolve(
        new Response(jpeg, { headers: { "content-type": "image/jpeg" } }),
      );
    }
    return Promise.reject(new Error(`unexpected fetch: ${String(input)}`));
  }) as typeof fetch;

  try {
    const { client, calls } = fakeFirstPhotoAdmin();
    const res = await storeFirstPlaceImage(
      client,
      "https://proj.supabase.co",
      "place-1",
      source,
    );

    assertEquals(res.ok, true);
    assertEquals(res.url.startsWith("https://proj.supabase.co/storage/v1/object/public/place-images/images/"), true);
    assertEquals(res.url.endsWith(".jpg"), true);
    assertEquals(calls.upserts.length, 1);
    assertEquals(calls.uploads.length, 1);
    assertEquals(calls.uploads[0].bytes, jpeg.byteLength);
    assertEquals(calls.placePatches, [{ photos: [res.url] }]);
    assertEquals(
      (calls.upserts[0] as { source_metadata: { via: string } }[])[0].source_metadata.via,
      "create",
    );
    assertEquals(
      (calls.assetUpdates[0] as { status: string }).status,
      "saved",
    );
  } finally {
    globalThis.fetch = origFetch;
  }
});

Deno.test("storeFirstPlaceImage keeps the Google URL when the mirror fails", async () => {
  const source = "https://lh3.googleusercontent.com/p/first";
  const origFetch = globalThis.fetch;
  globalThis.fetch = (() =>
    Promise.resolve(new Response("nope", { status: 404 }))) as typeof fetch;

  try {
    const { client, calls } = fakeFirstPhotoAdmin();
    const res = await storeFirstPlaceImage(
      client,
      "https://proj.supabase.co",
      "place-1",
      source,
    );

    assertEquals(res.ok, false);
    assertEquals(res.url, source);
    assertEquals(calls.uploads.length, 0);
    assertEquals(calls.placePatches, [{ photos: [source] }]);
    assertEquals(
      (calls.assetUpdates[0] as { status: string }).status,
      "failed",
    );
  } finally {
    globalThis.fetch = origFetch;
  }
});
