import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { AdminPlace } from "../../actions";

// Effects never run under renderToStaticMarkup (vitest is environment:"node"
// here — no jsdom), so these assert on MARKUP, which is exactly what catches
// the regression that matters: someone rewriting a hidden config as
// `{enabled && <Config/>}`. The decision logic itself is unit-tested directly
// in offerings.test.ts.
vi.mock("../../actions", () => ({
  getPlacePaymentAccount: vi.fn(async () => ({ ok: false, error: "not called in SSR" })),
  setPlacePlan: vi.fn(),
  setPlaceRails: vi.fn(),
  setPlaceStrategy: vi.fn(),
  setCheckGates: vi.fn(),
  listTeam: vi.fn(async () => ({ ok: true, data: { members: [], pendingBusinessInvites: [] } })),
  inviteEditor: vi.fn(),
  removeMember: vi.fn(),
  updateMemberRole: vi.fn(),
}));

vi.mock("../../PlaceContext", () => ({
  usePlaceContext: () => ({
    dirtyLabels: [] as string[],
    savePending: false,
    setSectionDirty: () => {},
    registerDiscardHandler: () => {},
    registerSaver: () => {},
  }),
}));

vi.mock("next/image", () => ({
  default: (p: Record<string, unknown>) =>
    // eslint-disable-next-line @next/next/no-img-element
    <img alt="" src={String(p.src ?? "")} />,
}));

import { PromosSection } from "../PromosSection";

function place(over: Partial<AdminPlace> = {}): AdminPlace {
  return {
    id: "11111111-2222-3333-4444-555555555555",
    slug: "la-docena",
    name: "La Docena Polanco",
    category: null,
    category_label: null,
    status: "active",
    currency: "MXN",
    listing_type: "partner",
    price_level: null,
    address: null,
    lat: null,
    lng: null,
    zone: null,
    city: null,
    timezone: null,
    description: null,
    phone: "+528112345678",
    email: null,
    hours: null,
    photos: null,
    tags: null,
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
    plan: "free",
    fiscal_type: null,
    welcome_free_rate: null,
    welcome_premium_rate: null,
    free_rate: null,
    premium_rate: null,
    monthly_promo_cap: null,
    google_stars_overall: null,
    google_review_count: null,
    google_reviews: null,
    mesita_stars_overall: null,
    mesita_stars_food: null,
    mesita_stars_service: null,
    mesita_stars_ambience: null,
    mesita_stars_value: null,
    mesita_review_count: null,
    mesita_visitors: null,
    instagram_followers_count: null,
    facebook_followers: null,
    created_at: null,
    updated_at: null,
    enriched_at: null,
    ...over,
  } as AdminPlace;
}

const render = (p: AdminPlace) =>
  renderToStaticMarkup(<PromosSection place={p} onSaved={() => {}} />);

describe("Controls is two zones", () => {
  it("renders an OFFERINGS zone and a SETTINGS zone, in that order", () => {
    const html = render(place());
    const offerings = html.indexOf("Offerings");
    const settings = html.indexOf("Settings");
    expect(offerings).toBeGreaterThan(-1);
    expect(settings).toBeGreaterThan(-1);
    // What a guest can do comes before how the place is run.
    expect(offerings).toBeLessThan(settings);
  });

  it("states the ladder in dependency order", () => {
    const html = render(place());
    const at = (s: string) => html.indexOf(s);
    expect(at("Mesita Partnership")).toBeLessThan(at("Mesita Stripe Account"));
    expect(at("Mesita Stripe Account")).toBeLessThan(at("Mesita Pay"));
    expect(at("Mesita Pay")).toBeLessThan(at("Accept Prepays"));
    expect(at("Accept Prepays")).toBeLessThan(at("Sell Prepays"));
  });

  it("never ships a bare disabled switch — locked rows name their prerequisite", () => {
    // A non-partner has four locked rungs; every one must say why.
    const html = render(place({ plan: "free" }));
    expect(html).toContain("Needs the partnership");
    // Mesita Capital lost its permanently-locked ROW (MESITA-1399 #3) and
    // survives as one clause in the card foot: a row that can never change
    // trains operators to skip the bottom of the list.
    expect(html).not.toContain("Working-capital advances");
    expect(html).toContain("Mesita Capital is not live yet");
  });

  it("keeps the banned words out of rendered copy", () => {
    const html = render(place({ plan: "pro_discount" }));
    // "promo" / "membership" are banned in copy (Pato, 2026-08-30); "Credits"
    // as a consumer-facing balance is banned by MESITA-1380.
    const text = html.replace(/<[^>]+>/g, " ");
    expect(text).not.toMatch(/\bmembership\b/i);
    expect(text).toContain("never buys rank");
  });
});

describe("CRITICAL — the nested config is hidden, never unmounted", () => {
  it("still renders the Orders channel markup while both order rails are OFF", () => {
    // THE regression: `{enabled && <OrdersCard/>}` unmounts the section, which
    // runs registerSaver(section, null) and silently discards a pending edit.
    // The markup must be present and merely hidden.
    const html = render(
      place({ pickup_orders_enabled: false, delivery_orders_enabled: false }),
    );
    expect(html).toContain("Order channel");
    expect(html).toContain("Ordering links on file");
    // ...and it is hidden by CSS, not absent.
    expect(html).toMatch(/class="[^"]*\bhidden\b[^"]*"[^>]*aria-hidden="true"/);
  });

  it("renders the Reservation channel regardless of any switch", () => {
    const html = render(place());
    expect(html).toContain("Reservation channel");
  });
});
