import { assertEquals } from "jsr:@std/assert@1";
import {
  galleryUrls,
  mesitaGalleryFromPatch,
  patchWithoutPhotoCatalogs,
} from "./photos.ts";

Deno.test("the gallery keeps ten http links and drops the rest", () => {
  const urls = Array.from({ length: 12 }, (_, i) => `https://example.com/${i}.jpg`);
  assertEquals(galleryUrls([...urls, "not-a-url", "https://example.com/0.jpg"]).length, 10);
  assertEquals(galleryUrls("https://example.com/a.jpg"), []);
});

Deno.test("mesitaGalleryFromPatch prefers mesita_photos over legacy photos", () => {
  assertEquals(
    mesitaGalleryFromPatch({
      mesita_photos: ["https://example.com/m.jpg"],
      photos: ["https://example.com/legacy.jpg"],
    }),
    ["https://example.com/m.jpg"],
  );
  assertEquals(
    mesitaGalleryFromPatch({ photos: ["https://example.com/legacy.jpg"] }),
    ["https://example.com/legacy.jpg"],
  );
});

Deno.test("patchWithoutPhotoCatalogs drops photos and mesita_photos", () => {
  assertEquals(
    patchWithoutPhotoCatalogs({
      google_name: "Pujol",
      photos: ["x"],
      mesita_photos: ["y"],
      description: "d",
    }),
    { google_name: "Pujol", description: "d" },
  );
});
