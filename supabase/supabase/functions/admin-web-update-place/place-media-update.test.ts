import { assertEquals } from "jsr:@std/assert";
import { applyMediaUpdates } from "./place-media-update.ts";

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

Deno.test("the gallery is not editable here, under either name", async () => {
  for (const body of [
    { photos: ["https://example.com/a.jpg"] },
    { mesita_photos: ["https://example.com/a.jpg"] },
  ]) {
    const update: Record<string, unknown> = {};
    const res = applyMediaUpdates(body, update);
    assertEquals(res?.status, 400);
    assertEquals((await res!.json()).code, "gallery_not_editable");
    assertEquals(Object.keys(update), []);
  }
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
