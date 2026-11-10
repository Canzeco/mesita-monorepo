import { json } from "./http.ts";
import { isUrl } from "./place-urls.ts";
import { optString } from "./input.ts";
import { ENRICH_FIELD_LIMITS } from "./enrich-field-limits.ts";

type MediaUpdateBody = {
  /** The one gallery, hero first. Create, Enrich and Update write it; since
   *  MESITA-3504 the place's Profile does too (reorder, remove, upload). */
  photos?: unknown;
  /** The profile picture (MESITA-3528): a URL, or null to follow the cover. */
  profile_photo?: unknown;
  mesita_photos?: unknown;
  menu_pdf_url?: unknown;
  menu_pdf_name?: unknown;
  products?: (Record<string, unknown> & { menu?: unknown }) | null;
};

const MENU_NAME_MAX = 80;
/** The most photos a gallery holds: the same cap as Enrich's gallery. */
export const GALLERY_MAX = ENRICH_FIELD_LIMITS.photos.max;
const PLACE_IMAGES_BUCKET = "place-images";

/** Where Profile's uploads for this place live (business-web-upload-place-photo). */
export function businessPhotoPrefix(supabaseUrl: string, placeId: string): string {
  return `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${PLACE_IMAGES_BUCKET}/business/${placeId}/`;
}

/**
 * The first photo a gallery save may not hold, or null (MESITA-3504). A saved
 * gallery only reorders and drops what the place already shows, plus what its
 * own Profile uploaded: an owner can never point the gallery at an outside
 * URL. Pure.
 */
export function firstForeignPhoto(
  photos: readonly string[],
  ctx: { current: readonly string[]; placeId: string; supabaseUrl: string },
): string | null {
  const current = new Set(ctx.current);
  const prefix = businessPhotoPrefix(ctx.supabaseUrl, ctx.placeId);
  for (const url of photos) {
    if (current.has(url)) continue;
    const rest = url.startsWith(prefix) ? url.slice(prefix.length) : null;
    if (rest && /^[A-Za-z0-9._-]+$/.test(rest) && !rest.includes("..")) continue;
    return url;
  }
  return null;
}
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
  if ("mesita_photos" in body) {
    return json({
      ok: false,
      code: "gallery_not_editable",
      error: "mesita_photos is gone (MESITA-2794): the gallery is photos.",
    }, 400);
  }
  if ("photos" in body) {
    const raw = body.photos;
    if (!Array.isArray(raw) || raw.some((u) => typeof u !== "string")) {
      return json({ ok: false, code: "invalid_photos", error: "photos must be a list of URLs" }, 400);
    }
    const seen = new Set<string>();
    const photos: string[] = [];
    for (const u of raw as string[]) {
      const url = u.trim();
      if (!url || seen.has(url)) continue;
      if (!isUrl(url)) {
        return json({ ok: false, code: "invalid_photos", error: "each photo needs a valid https:// url" }, 400);
      }
      seen.add(url);
      photos.push(url);
    }
    if (photos.length > GALLERY_MAX) {
      return json({ ok: false, code: "too_many_photos", error: `a gallery holds at most ${GALLERY_MAX} photos` }, 400);
    }
    update.photos = photos;
  }

  if ("profile_photo" in body) {
    const raw = body.profile_photo;
    if (raw == null || (typeof raw === "string" && raw.trim() === "")) {
      update.profile_photo = null;
    } else if (!isUrl(raw)) {
      return json({ ok: false, code: "invalid_profile_photo", error: "profile_photo must be an https:// URL or null" }, 400);
    } else {
      update.profile_photo = (raw as string).trim();
    }
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
