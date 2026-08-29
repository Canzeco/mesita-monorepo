import { assertEquals } from "jsr:@std/assert";
import {
  placeHasOrderCatalog,
  placeOrderActionEnabled,
  placeReserveActionEnabled,
} from "./place-profile-actions.ts";

Deno.test("placeHasOrderCatalog: products.menu", () => {
  assertEquals(
    placeHasOrderCatalog({ products: { menu: [{ url: "https://x/menu.pdf" }] } }),
    true,
  );
});

Deno.test("placeHasOrderCatalog: legacy menus and menu_pdf_url", () => {
  assertEquals(placeHasOrderCatalog({ menus: [{ url: "u" }] }), true);
  assertEquals(placeHasOrderCatalog({ menu_pdf_url: "https://m.pdf" }), true);
  assertEquals(placeHasOrderCatalog({}), false);
});

Deno.test("placeOrderActionEnabled: flag or live menu", () => {
  assertEquals(placeOrderActionEnabled({ orders_enabled: true }), true);
  assertEquals(
    placeOrderActionEnabled({ menu_pdf_url: "https://m.pdf", orders_enabled: false }),
    true,
  );
  assertEquals(placeOrderActionEnabled({ orders_enabled: false }), false);
});

Deno.test("placeReserveActionEnabled: only true when explicitly set", () => {
  assertEquals(placeReserveActionEnabled({ reservations_enabled: true }), true);
  assertEquals(placeReserveActionEnabled({ reservations_enabled: false }), false);
  assertEquals(placeReserveActionEnabled({}), false);
});
