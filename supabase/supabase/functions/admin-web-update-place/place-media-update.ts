import { json } from "../_shared/http.ts";
import { isUrl } from "./place-urls.ts";
import { optString } from "./place-update-utils.ts";

type MediaUpdateBody = {
  /** The one gallery is written by Create, Enrich and Update only (MESITA-2794). */
  photos?: unknown;
  mesita_photos?: unknown;
  menu_pdf_url?: unknown;
  menu_pdf_name?: unknown;
  products?: (Record<string, unknown> & { menu?: unknown }) | null;
};

const MENU_NAME_MAX = 80;
const MENU_MAX_COUNT = 20;

type MenuNutrition = {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

type MenuRow = { name: string | null; url: string; nutrition?: MenuNutrition };

function menuNutrition(raw: unknown): MenuNutrition | undefined {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return undefined;
  }
  const o = raw as Record<string, unknown>;
  const read = (key: string): number | null => {
    const v = o[key];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 20000) {
      return null;
    }
    return Math.round(v);
  };
  const kcal = read("kcal");
  const proteinG = read("proteinG");
  const carbsG = read("carbsG");
  const fatG = read("fatG");
  if (kcal == null || proteinG == null || carbsG == null || fatG == null) {
    return undefined;
  }
  return { kcal, proteinG, carbsG, fatG };
}

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
      nutrition?: unknown;
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
    const nutrition = menuNutrition(row.nutrition);
    cleaned.push({
      name: optString(row.name, MENU_NAME_MAX),
      url: rawUrl,
      ...(nutrition ? { nutrition } : {}),
    });
  }
  return { ok: true, value: cleaned };
}

export function applyMediaUpdates(
  body: MediaUpdateBody,
  update: Record<string, unknown>,
): Response | null {
  if ("photos" in body || "mesita_photos" in body) {
    return json({
      ok: false,
      code: "gallery_not_editable",
      error:
        "The gallery is not edited here: Create sets Google's hero, Enrich rebuilds it, and Update refreshes the hero while it is one photo.",
    }, 400);
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
  if ("menu_pdf_name" in body) {
    update.menu_pdf_name = optString(body.menu_pdf_name, MENU_NAME_MAX);
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
        // Rewrite products with the sanitized menu so any sibling key a
        // future product rail adds stays intact and garbage entries never
        // land. Routing is NOT one of them: reservation/order routing left
        // this blob for typed columns in MESITA-1208.
        update.products = { ...p, menu: normalized.value };
        update.menus = normalized.value;
      } else {
        update.products = p;
      }
    }
  }

  return null;
}
