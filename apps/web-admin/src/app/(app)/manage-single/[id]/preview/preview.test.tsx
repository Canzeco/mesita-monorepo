import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlaceProfile } from "@mesita/place-profile";
import type { AdminPlace, PlaceTagOption } from "@/components/place-manage/actions";
import { memberPreviewDetail } from "./member-preview";

const ROOT = join(__dirname, "../../../../../../../..");

function place(over: Partial<AdminPlace> = {}): AdminPlace {
  return {
    id: "p-1",
    slug: "lupita",
    name: "Lupita",
    category: "restaurant",
    category_label: "Restaurant",
    state: "active",
    currency: "MXN",
    price_level: 2,
    address: "Centro",
    lat: 19.4,
    lng: -99.1,
    zone: "Centro",
    google_address: null,
    source_sync: null,
    city: "CDMX",
    timezone: "America/Mexico_City",
    description: "A long lunch.",
    phone: null,
    hours: null,
    photos: [],
    tags: ["tacos"],
    website_url: null,
    instagram_url: null,
    facebook_url: null,
    whatsapp_url: null,
    google_maps_url: null,
    opentable_url: null,
    resy_url: null,
    uber_eats_url: null,
    menu_pdf_url: null,
    menu_pdf_name: null,
    google_stars_overall: null,
    google_review_count: null,
    google_reviews: null,
    instagram_followers_count: null,
    facebook_followers: null,
    created_at: "2026-01-01",
    updated_at: "2026-01-02",
    enriched_at: "2026-01-02",
    enriched: true,
    requested: true,
    request_count: 4,
    request_threshold: 9,
    ...over,
  };
}

const TAGS: PlaceTagOption[] = [
  {
    slug: "tacos",
    label_es: "Tacos",
    label_en: "Tacos",
    facet: "food",
    sort_order: 1,
  },
  {
    slug: "unknown-not-on-place",
    label_es: "Otro",
    label_en: "Other",
    facet: "food",
    sort_order: 2,
  },
];

describe("admin member preview", () => {
  it("shows the saved place, not a member vote, at the settings threshold", () => {
    const detail = memberPreviewDetail(place(), TAGS);
    expect(detail.requested).toBe(false);
    expect(detail.distance_km).toBe(0);
    expect(detail.request_threshold).toBe(9);
    expect(detail.tags.map((tag) => tag.label)).toEqual(["Tacos"]);
    const html = renderToStaticMarkup(
      <PlaceProfile place={detail} scrollLabel="Member profile preview" />,
    );
    expect(html).toContain("Lupita");
    expect(html).not.toContain("- km");
    expect(html).toContain("Overview");
    const nav = html.slice(html.indexOf("<nav"), html.indexOf(">", html.indexOf("<nav")) + 1);
    expect(nav).toContain('aria-label="Place sections"');
    expect(nav).toContain("bg-card");
    expect(nav).not.toContain("bg-background");
    expect(html).not.toContain("Phone emulator");
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("Families");
  });

  it("keeps the four sections, the vote atop Overview, with no photos and a long name", () => {
    const name = "Taquería de los Compadres del Centro Histórico de la Ciudad";
    const detail = memberPreviewDetail(
      place({
        name,
        mesita_name: name,
        enriched_at: null,
        enriched: false,
        photos: null,
        tags: [],
        website_url: "https://example.com",
      }),
      [],
    );
    expect(detail.is_enriched).toBe(false);
    expect(detail.photos).toEqual([]);
    const html = renderToStaticMarkup(<PlaceProfile place={detail} />);
    expect(html).toContain(name);
    expect(html).toContain('aria-label="Place sections"');
    expect(html).toContain("Overview");
    expect(html).toContain("Vote to enrich");
    expect(html).not.toContain("<a ");
  });

  it("renders the consumer place module, and a package change deploys both apps", () => {
    const preview = readFileSync(join(__dirname, "PlacePreview.tsx"), "utf8");
    const consumer = readFileSync(
      join(ROOT, "apps/web-consumer/src/components/consumer/PlaceDetailPageBody.tsx"),
      "utf8",
    );
    const adminIgnore = readFileSync(join(ROOT, "apps/web-admin/vercel.json"), "utf8");
    const consumerIgnore = readFileSync(join(ROOT, "apps/web-consumer/vercel.json"), "utf8");
    for (const src of [preview, consumer]) {
      expect(src).toContain('from "@mesita/place-profile"');
      expect(src).not.toContain("function PlaceProfile");
    }
    expect(adminIgnore).toContain("packages/place-profile");
    expect(consumerIgnore).toContain("packages/place-profile");
  });

  it("keeps Profile mounted and the phone photos allowed", () => {
    const scroll = readFileSync(join(__dirname, "../PlaceScroll.tsx"), "utf8");
    const profilePage = readFileSync(join(__dirname, "../profile/page.tsx"), "utf8");
    const shell = readFileSync(join(__dirname, "../PlaceManageShell.tsx"), "utf8");
    const nextConfig = readFileSync(join(ROOT, "apps/web-admin/next.config.ts"), "utf8");
    const adminCss = readFileSync(join(ROOT, "apps/web-admin/src/app/globals.css"), "utf8");
    const consumerCss = readFileSync(
      join(ROOT, "apps/web-consumer/src/app/globals.css"),
      "utf8",
    );
    expect(scroll).toContain("<ProfileTab />");
    expect(scroll).toContain("inert=");
    expect(profilePage).not.toContain("<ProfileTab");
    expect(shell).toContain('tab === "preview"');
    expect(nextConfig).toContain('hostname: "**"');
    expect(adminCss).toContain("--page: oklch(0.952 0 0)");
    expect(consumerCss).toContain("--page: oklch(0.952 0 0)");
    expect(adminCss).toContain("--foreground: oklch(0.205 0 0)");
    expect(consumerCss).toContain("--foreground: oklch(0.205 0 0)");
  });
});
