import { json } from "../_shared/http.ts";
import { isUrl } from "./project-urls.ts";
import { optString } from "./project-update-utils.ts";

type MediaUpdateBody = {
  photos?: unknown;
  menu_pdf_url?: unknown;
  menu_pdf_name?: unknown;
  product_catalog_url?: unknown;
  product_catalog_name?: unknown;
  products?: { menu?: unknown } | null;
};

export function applyMediaUpdates(
  body: MediaUpdateBody,
  update: Record<string, unknown>,
  maxPhotos: number,
): Response | null {
  if ("photos" in body) {
    if (!Array.isArray(body.photos)) {
      return json({
        ok: false,
        error: "photos must be an array of URL strings",
      }, 400);
    }
    update.photos = body.photos.filter(isUrl).slice(0, maxPhotos);
  }

  if ("menu_pdf_url" in body) {
    const raw = body.menu_pdf_url;
    if (raw == null || (typeof raw === "string" && raw.trim() === "")) {
      update.menu_pdf_url = null;
    } else if (!isUrl(raw)) {
      return json({
        ok: false,
        error: "menu_pdf_url must be a valid https:// URL",
      }, 400);
    } else {
      update.menu_pdf_url = raw.trim();
    }
  }
  if ("product_catalog_url" in body) {
    const raw = body.product_catalog_url;
    if (raw == null || (typeof raw === "string" && raw.trim() === "")) {
      update.menu_pdf_url = null;
    } else if (!isUrl(raw)) {
      return json({
        ok: false,
        error: "product_catalog_url must be a valid https:// URL",
      }, 400);
    } else {
      update.menu_pdf_url = raw.trim();
    }
  }
  if ("menu_pdf_name" in body) {
    update.menu_pdf_name = optString(body.menu_pdf_name, 80);
  }
  if ("product_catalog_name" in body) {
    update.menu_pdf_name = optString(body.product_catalog_name, 80);
  }

  if ("products" in body) {
    const p = body.products;
    if (p == null) {
      update.products = null;
    } else if (typeof p !== "object" || Array.isArray(p)) {
      return json(
        { ok: false, error: "products must be an object or null" },
        400,
      );
    } else {
      const menu = (p as { menu?: unknown }).menu;
      if (menu != null && !Array.isArray(menu)) {
        return json({
          ok: false,
          error: "products.menu must be an array or null",
        }, 400);
      }
      update.products = p;
      // Keep legacy menus in sync while consumers/business migrate.
      if (Array.isArray(menu)) update.menus = menu;
    }
  }

  return null;
}
