// MVP test rule (MESITA-2600): only the money guard stays; UI pins were removed (MESITA-2601).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { GuestRow } from "./actions";
import { GuestsClient } from "./GuestsClient";

vi.mock("./actions", () => ({ listGuests: vi.fn(), setGuestStanding: vi.fn() }));

const base: GuestRow = {
  id: "g1",
  name: "Valeria Soto",
  code: "0000-0042",
  instagram: null,
  guestClass: "regular",
  plan: "free",
  guestClassSetAt: null,
  guestClassSetByEmail: null,
  guestClassNote: null,
  reservationCapOverride: null,
  planReservationCap: 10,
  createdAt: "2026-10-21T00:00:00Z",
};

const page = (guests: GuestRow[]) =>
  renderToStaticMarkup(<GuestsClient initialGuests={guests} loadError={null} />);

describe("Manage › Guests: Class and Plan (MESITA-2553)", () => {
  it("never uses a retired name, sells VIP, or states a price", () => {
    const src = readFileSync(join(__dirname, "GuestsClient.tsx"), "utf8");
    const html = page([{ ...base, guestClass: "vip" }]);
    for (const s of [src, html]) {
      expect(s).not.toMatch(/Diamond|\bPremium\b|\bPremier\b|Mesita Select/);
      expect(s).not.toMatch(/\$\s?\d|\d+\s?% off/);
    }
    expect(html).toContain("never sold");
  });
});
