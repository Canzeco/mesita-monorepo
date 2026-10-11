import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import {
  REFLECTION_MIN_PX,
  ReflectedPhoto,
  SAMPLE_PLACE_TOAST,
  ScrollCard,
  needsReflection,
  reflectionBandHeight,
  scrollCardActions,
} from "@/components/consumer/home/scroll/scroll-card";
import { scrollMockPlaces } from "@/lib/mock/scroll-places";
import type { Place } from "@/lib/api/places";

// A mock card must never reach real data (MESITA-2105, design 3A): a `mock-`
// id in Favs outlives the mock as a ghost place, one in analytics pollutes the
// funnel, one in a URL is a 404, and one in the reservation sheet books a
// table at a place that does not exist. `scrollCardActions` is the one router every card goes
// through, so the rule is tested here once.
const mock = scrollMockPlaces()[0] as Place;
const real: Place = {
  ...mock,
  id: "3f2a9c1e-0000-4000-8000-000000000000",
  slug: "real-lupita",
};

function deps(over: Partial<Parameters<typeof scrollCardActions>[2]> = {}) {
  return {
    isMock: false,
    savedIds: new Set<string>(),
    mockSavedIds: new Set<string>(),
    toast: vi.fn(),
    saveReal: vi.fn(),
    setMockSaved: vi.fn(),
    track: vi.fn(),
    share: vi.fn(),
    openReserve: vi.fn(),
    profileHref: (p: Place) => `/place/${p.slug}`,
    ...over,
  };
}

describe("a mock card's actions", () => {
  // Profile opens the sample's own profile (MESITA-2142), answered locally by
  // apiFetchPlaceDetail — it never reaches the EF. Share and Reserve still toast.
  it("open the sample profile, toast for Share and Reserve, and touch nothing real", () => {
    const d = deps({ isMock: true, profileHref: (p: Place) => `/place/${p.id}` });
    const a = scrollCardActions(mock, 3, d);
    expect(a.profileHref).toBe(`/place/${mock.id}`);
    a.onShare();
    a.onReserve();
    expect(d.toast).toHaveBeenCalledTimes(2);
    expect(d.toast).toHaveBeenCalledWith(SAMPLE_PLACE_TOAST);
    for (const spy of [d.track, d.share, d.openReserve, d.saveReal]) {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it("save only flips in-memory state, never Favs or analytics", () => {
    const d = deps({ isMock: true });
    scrollCardActions(mock, 0, d).onToggleSave();
    expect(d.setMockSaved).toHaveBeenCalledWith(mock.id, true);
    const saved = deps({ isMock: true, mockSavedIds: new Set([mock.id]) });
    const a = scrollCardActions(mock, 0, saved);
    expect(a.saved).toBe(true);
    a.onToggleSave();
    expect(saved.setMockSaved).toHaveBeenCalledWith(mock.id, false);
    expect(d.saveReal).not.toHaveBeenCalled();
    expect(d.track).not.toHaveBeenCalled();
  });

  it("a real id in the Favs store does not make a mock card look saved", () => {
    const a = scrollCardActions(mock, 0, deps({ isMock: true, savedIds: new Set([mock.id]) }));
    expect(a.saved).toBe(false);
  });
});

describe("a real card's actions", () => {
  it("open the place page, the share sheet and the reservation sheet, with today's events", () => {
    const d = deps();
    const a = scrollCardActions(real, 7, d);
    expect(a.profileHref).toBe("/place/real-lupita");
    a.onShare();
    expect(d.share).toHaveBeenCalledWith(real);
    a.onReserve();
    expect(d.track).toHaveBeenCalledWith("home_card_open", {
      mode: "scroll",
      place_id: real.id,
      position: 7,
    });
    expect(d.openReserve).toHaveBeenCalledWith(real);
    expect(d.toast).not.toHaveBeenCalled();
  });

  it("save writes Favs and tracks; unsave writes Favs only", () => {
    const d = deps();
    scrollCardActions(real, 0, d).onToggleSave();
    expect(d.saveReal).toHaveBeenCalledWith(real, true);
    expect(d.track).toHaveBeenCalledWith("home_card_save", {
      mode: "scroll",
      place_id: real.id,
    });
    const s = deps({ savedIds: new Set([real.id]) });
    scrollCardActions(real, 0, s).onToggleSave();
    expect(s.saveReal).toHaveBeenCalledWith(real, false);
    expect(s.track).not.toHaveBeenCalled();
  });
});

describe("the card", () => {
  const noop = () => {};
  const render = (place: Place, extra: Partial<Parameters<typeof ScrollCard>[0]> = {}) =>
    renderToStaticMarkup(
      <ScrollCard
        place={place}
        index={0}
        total={50}
        near
        saved={false}
        profileHref={null}
        onProfile={noop}
        onToggleSave={noop}
        onShare={noop}
        onReserve={noop}
        {...extra}
      />,
    );

  it("a mock card links nowhere", () => {
    const html = render(mock);
    expect(html).not.toContain("<a ");
    expect(html).toContain(`aria-label="Open ${mock.name}"`);
  });

  it("a real card's avatar is the place page", () => {
    const html = render(real, { profileHref: "/place/real-lupita" });
    expect(html).toContain('href="/place/real-lupita"');
  });

  it("names itself and labels every action", () => {
    const html = render(mock, { index: 4 });
    expect(html).toContain(`aria-label="${mock.name}, 5 of 50"`);
    for (const label of [`Save ${mock.name}`, `Share ${mock.name}`, `Reserve at ${mock.name}`]) {
      expect(html).toContain(`aria-label="${label}"`);
    }
    expect(html).toContain('aria-pressed="false"');
    expect(render(mock, { saved: true })).toContain('aria-pressed="true"');
  });

  // Eng review R3: only the card on screen and its neighbours fetch photos up
  // front; the rest of the fifty wait until the guest gets close.
  it("a far card loads every photo lazily", () => {
    const html = render(mock, { near: false });
    const imgs = html.match(/<img [^>]*>/g) ?? [];
    expect(imgs.length).toBe(mock.photos.length);
    for (const img of imgs) expect(img).toContain('loading="lazy"');
  });

  it("a near card loads its first photos eagerly", () => {
    const html = render(mock, { near: true });
    const imgs = html.match(/<img [^>]*>/g) ?? [];
    expect(imgs[0]).not.toContain('loading="lazy"');
  });

  // A place with no photos (or, at runtime, a dead photo URL) is an ink field
  // with its initial — never a broken image across a whole screen.
  it("a place without photos gets the ink placeholder", () => {
    const html = render({ ...mock, photos: [] });
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


// THE SAMPLE PROFILE (MESITA-2142). A `mock-` id resolves locally to a full,
// enriched profile built from the same row the card shows.
describe("a sample place's profile", () => {
  it("resolves without the EF, as an enriched profile of the same place", async () => {
    const { apiFetchPlaceDetail } = await import("@/lib/api/places");
    const client = {
      functions: {
        invoke: () => {
          throw new Error("a sample profile must never call an EF");
        },
      },
    } as unknown as Parameters<typeof apiFetchPlaceDetail>[0];
    const detail = await apiFetchPlaceDetail(client, mock.id);
    expect(detail?.name).toBe(mock.name);
    expect(detail?.is_enriched).toBe(true);
    expect(detail?.photos).toEqual(mock.photos);
    expect(detail?.open_now).toBe(true);
    // The card's rating and the profile's are the same number.
    expect(detail?.google.rating).toBe(mock.google_rating);
    expect(detail?.google.count).toBe(mock.google_count);
  });

  it("an unknown mock id is gone, not invented", async () => {
    const { mockPlaceDetail } = await import("@/lib/mock/scroll-place-detail");
    expect(mockPlaceDetail("mock-no-such-place")).toBeNull();
  });
});
