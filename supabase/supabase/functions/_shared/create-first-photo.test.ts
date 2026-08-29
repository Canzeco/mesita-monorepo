import { assertEquals, assertStringIncludes } from "jsr:@std/assert";

// CREATE Details saves the first Google photo to storage so a Created
// (not-yet-Enriched) place still has a thumb. Enrich Images later ranks
// the gallery. This is a source contract: the create run must await one
// mirror, never the full enrich image funnel.

Deno.test("create fetches one Google photo and awaits a storage mirror", async () => {
  const create = await Deno.readTextFile(new URL("./create-place.ts", import.meta.url));
  const basics = await Deno.readTextFile(
    new URL("./enrich-google-basics.ts", import.meta.url),
  );
  const store = await Deno.readTextFile(
    new URL("./store-place-images.ts", import.meta.url),
  );

  assertStringIncludes(create, "storeFirstPlaceImage");
  assertStringIncludes(create, "maxPhotos: 1");
  assertStringIncludes(create, "first Google photo");
  assertEquals(create.includes("runInBackground(storeFirstPlaceImage"), false);
  assertEquals(create.includes("supabase-edgefunc-store-place-images"), false);

  assertStringIncludes(basics, "maxPhotos?: number");
  assertStringIncludes(store, "export async function storeFirstPlaceImage");
  assertStringIncludes(store, "via: \"create\"");
  // Create's first-photo helper is awaited. The import of runInBackground is for
  // the later enrich-gallery path (storePlaceImages), not this helper.
  const firstPhotoFn = store.match(
    /export async function storeFirstPlaceImage[\s\S]*?^}/m,
  );
  assertEquals(firstPhotoFn !== null, true);
  assertEquals(/runInBackground/.test(firstPhotoFn ?? ""), false);
});
