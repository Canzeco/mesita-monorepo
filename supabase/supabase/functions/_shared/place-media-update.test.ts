import { assertEquals } from "jsr:@std/assert";
import { applyMediaUpdates, businessPhotoPrefix, firstForeignPhoto, GALLERY_MAX } from "./place-media-update.ts";

Deno.test("products.menu: sanitizes name/url and keeps sibling keys", () => {
  const update: Record<string, unknown> = {};
  const res = applyMediaUpdates(
    {
      products: {
        catalog_note: "keep me",
        menu: [
          { name: "  Dinner  ", url: "https://example.com/menu.pdf" },
          { name: "", url: "" }, // empty draft — dropped
          { name: "Wine", pdf_url: "https://example.com/wine.pdf" },
        ],
      },
    },
    update,
  );
  assertEquals(res, null);
  assertEquals(update.products, {
    catalog_note: "keep me",
    menu: [
      { name: "Dinner", url: "https://example.com/menu.pdf" },
      { name: "Wine", url: "https://example.com/wine.pdf" },
    ],
  });
  assertEquals(
    update.menus,
    update.products && (update.products as { menu: unknown }).menu,
  );
});

Deno.test("products.menu: keeps headline nutrition and drops a broken estimate", () => {
  const update: Record<string, unknown> = {};
  const res = applyMediaUpdates(
    {
      products: {
        menu: [
          {
            name: "Dinner",
            url: "https://example.com/menu.pdf",
            nutrition: { kcal: 640, proteinG: 54, carbsG: 6, fatG: 44 },
          },
          {
            name: "Bar",
            url: "https://example.com/bar.pdf",
            nutrition: { kcal: 10 },
          },
        ],
      },
    },
    update,
  );
  assertEquals(res, null);
  assertEquals((update.products as { menu: unknown }).menu, [
    {
      name: "Dinner",
      url: "https://example.com/menu.pdf",
      nutrition: { kcal: 640, proteinG: 54, carbsG: 6, fatG: 44 },
    },
    { name: "Bar", url: "https://example.com/bar.pdf" },
  ]);
});

Deno.test("products.menu: rejects non-https urls", async () => {
  const update: Record<string, unknown> = {};
  const res = applyMediaUpdates(
    {
      products: {
        menu: [{ name: "Bad", url: "http://insecure.example/menu.pdf" }],
      },
    },
    update,
  );
  assertEquals(res?.status, 400);
  const body = await res!.json();
  assertEquals(body.ok, false);
  assertEquals(
    body.error,
    "each products.menu entry needs a valid https:// url",
  );
});

Deno.test("mesita_photos stays refused", async () => {
  const update: Record<string, unknown> = {};
  const res = applyMediaUpdates({ mesita_photos: ["https://example.com/a.jpg"] }, update);
  assertEquals(res?.status, 400);
  assertEquals((await res!.json()).code, "gallery_not_editable");
  assertEquals(Object.keys(update), []);
});

Deno.test("photos: trims, drops blanks and repeats, keeps the order (hero first)", () => {
  const update: Record<string, unknown> = {};
  const res = applyMediaUpdates(
    { photos: [" https://x.co/b.jpg ", "", "https://x.co/a.jpg", "https://x.co/b.jpg"] },
    update,
  );
  assertEquals(res, null);
  assertEquals(update.photos, ["https://x.co/b.jpg", "https://x.co/a.jpg"]);
});

Deno.test("photos: refuses a non-list, a non-https URL and more than the cap", async () => {
  const many = Array.from({ length: GALLERY_MAX + 1 }, (_, i) => `https://x.co/${i}.jpg`);
  for (const photos of [null, "https://x.co/a.jpg", ["http://x.co/a.jpg"], many]) {
    const update: Record<string, unknown> = {};
    const res = applyMediaUpdates({ photos }, update);
    assertEquals(res?.status, 400);
    assertEquals("photos" in update, false);
    await res!.body?.cancel();
  }
});

Deno.test("firstForeignPhoto: only the place's own photos and its own uploads", () => {
  const supabaseUrl = "https://abc.supabase.co";
  const placeId = "11111111-1111-1111-1111-111111111111";
  const other = "22222222-2222-2222-2222-222222222222";
  const ctx = { current: ["https://abc.supabase.co/storage/v1/object/public/place-images/images/h.jpg"], placeId, supabaseUrl };
  const own = `${businessPhotoPrefix(supabaseUrl, placeId)}1700-abc.jpg`;
  assertEquals(firstForeignPhoto([...ctx.current, own], ctx), null);
  assertEquals(firstForeignPhoto(["https://evil.example/x.jpg"], ctx), "https://evil.example/x.jpg");
  const theirs = `${businessPhotoPrefix(supabaseUrl, other)}1700-abc.jpg`;
  assertEquals(firstForeignPhoto([theirs], ctx), theirs);
  const climb = `${businessPhotoPrefix(supabaseUrl, placeId)}../x.jpg`;
  assertEquals(firstForeignPhoto([climb], ctx), climb);
});

Deno.test("products.menu: rejects non-object entries", async () => {
  const update: Record<string, unknown> = {};
  const res = applyMediaUpdates(
    { products: { menu: ["https://example.com/menu.pdf"] } },
    update,
  );
  assertEquals(res?.status, 400);
  const body = await res!.json();
  assertEquals(body.error, "each products.menu entry must be an object");
});
