import type { MyPlace } from "@/lib/api/places";
import type { PlaceFormState } from "@/components/business/place";
import { MAX_PHOTOS } from "@/components/business/place/place-upload-utils";
import { placeHoursToForm } from "./place-hours";

export function nullableUrl(v: string): string | null {
  const t = v.trim();
  if (t === "") return null;
  if (/^https:\/\//i.test(t)) return t;
  if (/^http:\/\//i.test(t)) return t.replace(/^http:/i, "https:");
  if (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(t)) return `https://${t}`;
  return t;
}

export function nullable(v: string): string | null {
  const t = v.trim();
  return t === "" ? null : t;
}

export function placeToFormState(place: MyPlace): PlaceFormState {
  return {
    name: place.name ?? "",
    category: place.category ?? "",
    description: place.description ?? "",
    hours: placeHoursToForm(place.hours),
    menu_links: (() => {
      // Prefer products.menu (canonical); fall back to legacy menu_pdf_*.
      const raw = place.products?.menu;
      const fromProducts = Array.isArray(raw)
        ? raw
            .map((m) => {
              if (!m || typeof m !== "object") return null;
              const row = m as {
                name?: unknown;
                url?: unknown;
                pdf_url?: unknown;
              };
              const url =
                typeof row.url === "string"
                  ? row.url.trim()
                  : typeof row.pdf_url === "string"
                    ? row.pdf_url.trim()
                    : "";
              const name = typeof row.name === "string" ? row.name : "";
              if (!url && !name) return null;
              return { name, url };
            })
            .filter((m): m is { name: string; url: string } => m != null)
        : [];
      if (fromProducts.length > 0) return fromProducts;
      if (place.menu_pdf_url) {
        return [{ name: place.menu_pdf_name ?? "", url: place.menu_pdf_url }];
      }
      return [{ name: "", url: "" }];
    })(),
    photos: (place.photos ?? []).slice(0, MAX_PHOTOS),
    tags: place.tags ?? [],
    phone: place.phone ?? "",
    whatsapp_url: place.whatsapp_url ?? "",
    email: place.email ?? "",
    website_url: place.website_url ?? "",
    instagram_url: place.instagram_url ?? "",
    facebook_url: place.facebook_url ?? "",
    threads_url: place.threads_url ?? "",
    reddit_url: place.reddit_url ?? "",
    opentable_url: place.opentable_url ?? "",
    resy_url: place.resy_url ?? "",
    google_maps_url: place.google_maps_url ?? "",
    uber_eats_url: place.uber_eats_url ?? "",
    didi_food_url: place.didi_food_url ?? "",
  };
}
