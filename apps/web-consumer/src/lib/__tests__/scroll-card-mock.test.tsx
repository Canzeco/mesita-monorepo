import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import {
  SAMPLE_PLACE_TOAST,
  ScrollCard,
  scrollCardActions,
} from "@/components/consumer/home/scroll/scroll-card";
import { scrollMockPlaces } from "@/lib/mock/scroll-places";
import type { Place } from "@/lib/api/places";

// A mock card must never reach real data (MESITA-2105, design 3A): a `mock-`
// id in Favs outlives the mock as a ghost place, one in analytics pollutes the
// funnel, one in a URL is a 404, and one in GoSheet opens a ticket at a place
// that does not exist. `scrollCardActions` is the one router every card goes
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
    openGo: vi.fn(),
    profileHref: (p: Place) => `/place/${p.slug}`,
    ...over,
  };
}

describe("a mock card's actions", () => {
  it("toast for Profile, Share and Go, and touch nothing real", () => {
    const d = deps({ isMock: true });
    const a = scrollCardActions(mock, 3, d);
    expect(a.profileHref).toBeNull();
    a.onProfile();
    a.onShare();
    a.onGo();
    expect(d.toast).toHaveBeenCalledTimes(3);
    expect(d.toast).toHaveBeenCalledWith(SAMPLE_PLACE_TOAST);
    for (const spy of [d.track, d.share, d.openGo, d.saveReal]) {
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
  it("open the place page, the share sheet and GoSheet, with today's events", () => {
    const d = deps();
    const a = scrollCardActions(real, 7, d);
    expect(a.profileHref).toBe("/place/real-lupita");
    a.onShare();
    expect(d.share).toHaveBeenCalledWith(real);
    a.onGo();
    expect(d.track).toHaveBeenCalledWith("home_card_open", {
      mode: "scroll",
      place_id: real.id,
      position: 7,
    });
    expect(d.openGo).toHaveBeenCalledWith(real);
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
        onGo={noop}
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
    for (const label of [`Save ${mock.name}`, `Share ${mock.name}`, `Go to ${mock.name}`]) {
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
