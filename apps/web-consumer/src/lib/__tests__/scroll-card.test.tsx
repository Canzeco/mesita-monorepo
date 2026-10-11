import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import {
  REFLECTION_MIN_PX,
  ReflectedPhoto,
  ScrollCard,
  needsReflection,
  reflectionBandHeight,
  scrollCardActions,
} from "@/components/consumer/home/scroll/scroll-card";
import type { Place } from "@/lib/api/places";
import { testPlace } from "./fixtures/place";

// `scrollCardActions` is the one router every Scroll card goes through, so
// where Save, Profile, Share and Reserve lead is tested here once.
const place = testPlace();

function deps(over: Partial<Parameters<typeof scrollCardActions>[2]> = {}) {
  return {
    savedIds: new Set<string>(),
    save: vi.fn(),
    track: vi.fn(),
    share: vi.fn(),
    openReserve: vi.fn(),
    profileHref: (p: Place) => `/place/${p.slug}`,
    ...over,
  };
}

describe("a card's actions", () => {
  it("open the place page, the share sheet and the reservation sheet, with today's events", () => {
    const d = deps();
    const a = scrollCardActions(place, 7, d);
    expect(a.profileHref).toBe("/place/taqueria-test");
    a.onShare();
    expect(d.share).toHaveBeenCalledWith(place);
    expect(a.onReserve).not.toBeNull();
    a.onReserve?.();
    expect(d.track).toHaveBeenCalledWith("home_card_open", {
      mode: "scroll",
      place_id: place.id,
      position: 7,
    });
    expect(d.openReserve).toHaveBeenCalledWith(place);
  });

  // The place page's bar steps aside for a place that takes no bookings
  // (PlaceActionBar); a Home card must not reopen that door.
  it("offer no Reserve for a place that takes no bookings", () => {
    const d = deps();
    const walkIn = testPlace({ reservations_enabled: false });
    expect(scrollCardActions(walkIn, 0, d).onReserve).toBeNull();
    expect(d.openReserve).not.toHaveBeenCalled();
    expect(d.track).not.toHaveBeenCalled();
    // Unset or null is not an opt-out.
    for (const flag of [true, null, undefined]) {
      expect(scrollCardActions(testPlace({ reservations_enabled: flag }), 0, d).onReserve).not.toBeNull();
    }
  });

  it("save writes Favs and tracks; unsave writes Favs only", () => {
    const d = deps();
    scrollCardActions(place, 0, d).onToggleSave();
    expect(d.save).toHaveBeenCalledWith(place, true);
    expect(d.track).toHaveBeenCalledWith("home_card_save", {
      mode: "scroll",
      place_id: place.id,
    });
    const s = deps({ savedIds: new Set([place.id]) });
    const a = scrollCardActions(place, 0, s);
    expect(a.saved).toBe(true);
    a.onToggleSave();
    expect(s.save).toHaveBeenCalledWith(place, false);
    expect(s.track).not.toHaveBeenCalled();
  });
});

describe("the card", () => {
  const noop = () => {};
  const render = (p: Place, extra: Partial<Parameters<typeof ScrollCard>[0]> = {}) =>
    renderToStaticMarkup(
      <ScrollCard
        place={p}
        index={0}
        total={50}
        near
        saved={false}
        profileHref={`/place/${p.slug}`}
        onToggleSave={noop}
        onShare={noop}
        onReserve={noop}
        {...extra}
      />,
    );

  it("draws no Reserve disc when the place takes no bookings", () => {
    const html = render(place, { onReserve: null });
    expect(html).not.toContain(`Reserve at ${place.name}`);
    expect(html).not.toContain(">Reserve<");
    expect(html).toContain(`aria-label="Share ${place.name}"`);
  });

  it("the avatar is the place page", () => {
    const html = render(place);
    expect(html).toContain('href="/place/taqueria-test"');
    expect(html).toContain(`aria-label="Open ${place.name}"`);
  });

  it("names itself and labels every action", () => {
    const html = render(place, { index: 4 });
    expect(html).toContain(`aria-label="${place.name}, 5 of 50"`);
    for (const label of [`Save ${place.name}`, `Share ${place.name}`, `Reserve at ${place.name}`]) {
      expect(html).toContain(`aria-label="${label}"`);
    }
    expect(html).toContain('aria-pressed="false"');
    expect(render(place, { saved: true })).toContain('aria-pressed="true"');
  });

  // Eng review R3: only the card on screen and its neighbours fetch photos up
  // front; the rest of the fifty wait until the guest gets close.
  it("a far card loads every photo lazily", () => {
    const html = render(place, { near: false });
    const imgs = html.match(/<img [^>]*>/g) ?? [];
    expect(imgs.length).toBe(place.photos.length);
    for (const img of imgs) expect(img).toContain('loading="lazy"');
  });

  it("a near card loads its first photos eagerly", () => {
    const html = render(place, { near: true });
    const imgs = html.match(/<img [^>]*>/g) ?? [];
    expect(imgs[0]).not.toContain('loading="lazy"');
  });

  // A place with no photos (or, at runtime, a dead photo URL) is an ink field
  // with its initial — never a broken image across a whole screen.
  it("a place without photos gets the ink placeholder", () => {
    const html = render({ ...place, photos: [] });
    expect(html).not.toContain("<img");
    expect(html).toContain(">T</span>");
  });
});

// Square and wide photos wear the old swipe card's reflection instead of being
// cropped to a sliver of themselves (Pato, 2026-10-10: "because squares").
describe("the reflection", () => {
  const phone = { width: 390, height: 671 };

  it("tall photos cover the card; square and wide ones reflect", () => {
    expect(needsReflection(9 / 16, phone)).toBe(false);
    expect(needsReflection(3 / 4, phone)).toBe(false);
    expect(needsReflection(1, phone)).toBe(true);
    expect(needsReflection(3 / 2, phone)).toBe(true);
    expect(needsReflection(16 / 9, phone)).toBe(true);
  });

  it("a square photo shows whole, and the reflection fills the rest", () => {
    expect(reflectionBandHeight(1, phone)).toBe(390);
  });

  // The reflection is a mirror of the band, so it can only cover as much as
  // the band is tall. A band shorter than the space below leaves a bare strip.
  it("the reflection is never taller than the photo it mirrors", () => {
    for (const ratio of [0.8, 1, 4 / 3, 3 / 2, 16 / 9, 3]) {
      const band = reflectionBandHeight(ratio, phone);
      expect(phone.height - band).toBeLessThanOrEqual(band);
    }
    expect(reflectionBandHeight(3 / 2, phone)).toBe(phone.height / 2);
  });

  it("the reflection never gets shorter than the name needs", () => {
    // 4:5 at full width would be 487px tall; the floor keeps 152px below.
    expect(reflectionBandHeight(1 / 2, phone)).toBe(phone.height - REFLECTION_MIN_PX);
    expect(phone.height - reflectionBandHeight(0.8, phone)).toBeGreaterThanOrEqual(
      REFLECTION_MIN_PX,
    );
  });

  it("draws the photo once for people and once, flipped, for decoration", () => {
    const html = renderToStaticMarkup(
      <ReflectedPhoto src="https://images.unsplash.com/photo-1-a?w=10" alt="Lupita" bandHeight={390} />,
    );
    const imgs = html.match(/<img [^>]*>/g) ?? [];
    expect(imgs).toHaveLength(2);
    expect(imgs[0]).toContain('alt="Lupita"');
    expect(imgs[1]).toContain('alt=""');
    const mirror = html.slice(html.indexOf("data-reflection"));
    expect(html).toMatch(/aria-hidden="true" data-reflection="true" class="[^"]*\[transform:scaleY\(-1\)\]/);
    expect(mirror).toContain("top:390px;height:390px");
  });
});
