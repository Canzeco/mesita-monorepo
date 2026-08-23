import { assertEquals } from "jsr:@std/assert";
import { applyMediaUpdates } from "./project-media-update.ts";

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
    10,
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

Deno.test("products.menu: rejects non-https urls", async () => {
  const update: Record<string, unknown> = {};
  const res = applyMediaUpdates(
    {
      products: {
        menu: [{ name: "Bad", url: "http://insecure.example/menu.pdf" }],
      },
    },
    update,
    10,
  );
  assertEquals(res?.status, 400);
  const body = await res!.json();
  assertEquals(body.ok, false);
  assertEquals(
    body.error,
    "each products.menu entry needs a valid https:// url",
  );
});

Deno.test("products.menu: rejects non-object entries", async () => {
  const update: Record<string, unknown> = {};
  const res = applyMediaUpdates(
    { products: { menu: ["https://example.com/menu.pdf"] } },
    update,
    10,
  );
  assertEquals(res?.status, 400);
  const body = await res!.json();
  assertEquals(body.error, "each products.menu entry must be an object");
});
