import { json } from "../_shared/http.ts";
import { isUrl } from "./project-urls.ts";
import { optString } from "./project-update-utils.ts";

type MediaUpdateBody = {
  photos?: unknown;
  menu_pdf_url?: unknown;
  menu_pdf_name?: unknown;
  product_catalog_url?: unknown;
  product_catalog_name?: unknown;
  products?: (Record<string, unknown> & { menu?: unknown }) | null;
};

const MENU_NAME_MAX = 80;
const MENU_MAX_COUNT = 20;

type MenuRow = { name: string | null; url: string };

/** Normalize products.menu to [{ name, url }] with https URLs only. */
function normalizeMenuEntries(
  menu: unknown[],
): { ok: true; value: MenuRow[] } | { ok: false; error: string } {
  if (menu.length > MENU_MAX_COUNT) {
    return {
      ok: false,
      error: `products.menu accepts at most ${MENU_MAX_COUNT} entries`,
    };
  }
  const cleaned: MenuRow[] = [];
  for (const item of menu) {
    if (item == null) continue;
    if (typeof item !== "object" || Array.isArray(item)) {
      return {
        ok: false,
        error: "each products.menu entry must be an object",
      };
    }
    const row = item as {
      name?: unknown;
      url?: unknown;
      pdf_url?: unknown;
      source_url?: unknown;
    };
    const rawUrl =
      typeof row.url === "string"
        ? row.url.trim()
        : typeof row.pdf_url === "string"
        ? row.pdf_url.trim()
        : typeof row.source_url === "string"
        ? row.source_url.trim()
        : "";
    if (!rawUrl) {
      // Empty draft rows are dropped (clients filter the same way).
      continue;
    }
    if (!isUrl(rawUrl)) {
      return {
        ok: false,
        error: "each products.menu entry needs a valid https:// url",
      };
    }
    cleaned.push({
      name: optString(row.name, MENU_NAME_MAX),
      url: rawUrl,
    });
  }
  return { ok: true, value: cleaned };
}

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
    update.menu_pdf_name = optString(body.menu_pdf_name, MENU_NAME_MAX);
  }
  if ("product_catalog_name" in body) {
    update.menu_pdf_name = optString(body.product_catalog_name, MENU_NAME_MAX);
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
      if (Array.isArray(menu)) {
        const normalized = normalizeMenuEntries(menu);
        if (!normalized.ok) {
          return json({ ok: false, error: normalized.error }, 400);
        }
        // Rewrite products with the sanitized menu so sibling keys
        // (e.g. reservations) stay intact and garbage entries never land.
        update.products = { ...p, menu: normalized.value };
        update.menus = normalized.value;
      } else {
        update.products = p;
      }
    }
  }

  return null;
}
