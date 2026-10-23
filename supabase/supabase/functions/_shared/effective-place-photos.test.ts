import { assertEquals } from "jsr:@std/assert@1";
import { effectivePlacePhotos } from "./effective-place-photos.ts";

Deno.test("effectivePlacePhotos prefers mesita, then google, then legacy photos", () => {
  assertEquals(
    effectivePlacePhotos({
      photos: ["legacy.jpg"],
      google_photos: ["g1.jpg"],
      mesita_photos: ["m1.jpg", "m2.jpg"],
    }),
    ["m1.jpg", "m2.jpg"],
  );
  assertEquals(
    effectivePlacePhotos({
      photos: ["legacy.jpg"],
      google_photos: ["g1.jpg"],
      mesita_photos: [],
    }),
    ["g1.jpg"],
  );
  assertEquals(
    effectivePlacePhotos({
      photos: ["legacy.jpg"],
      google_photos: [],
      mesita_photos: [],
    }),
    ["legacy.jpg"],
  );
});
