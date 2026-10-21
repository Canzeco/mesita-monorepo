import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { GuestRow } from "./actions";
import { GuestsClient, vipLine } from "./GuestsClient";

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
  createdAt: "2026-10-21T00:00:00Z",
};

const page = (guests: GuestRow[]) =>
  renderToStaticMarkup(<GuestsClient initialGuests={guests} loadError={null} />);

describe("Manage › Guests: Class and Plan (MESITA-2553)", () => {
  it("gives every guest two separate controls, Class then Plan", () => {
    const html = page([base]);
    expect(html).toContain('aria-label="Class for Valeria Soto"');
    expect(html).toContain('aria-label="Plan for Valeria Soto"');
    expect(html.indexOf("Class for")).toBeLessThan(html.indexOf("Plan for"));
    for (const label of ["Regular", "VIP", "Free", "Pro"]) expect(html).toContain(label);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(2);
  });

  it("marks a VIP with the crown, and shows the note only for VIPs", () => {
    expect(page([base])).not.toContain("data-vip-note");
    const vip = page([{ ...base, guestClass: "vip", plan: "pro", guestClassNote: "Agency" }]);
    expect(vip).toContain('aria-label="VIP"');
    expect(vip).toContain("data-vip-note");
    expect(vip).toContain('value="Agency"');
    expect(vip).toContain("only operators see this");
  });

  it("says who made a VIP and when, only once an operator did", () => {
    const vip = { ...base, guestClass: "vip" as const };
    expect(vipLine(vip)).toBeNull();
    expect(vipLine({ ...vip, guestClassSetAt: "2026-10-21T12:00:00Z" })).toBe("VIP since Oct 21, 2026");
    expect(
      vipLine({ ...vip, guestClassSetAt: "2026-10-21T12:00:00Z", guestClassSetByEmail: "pato@canzeco.com" }),
    ).toBe("VIP since Oct 21, 2026 · by pato@canzeco.com");
    expect(vipLine({ ...base, guestClassSetAt: "2026-10-21T12:00:00Z" })).toBeNull();
  });

  it("never uses a retired name, sells VIP, or states a price", () => {
    const src = readFileSync(join(__dirname, "GuestsClient.tsx"), "utf8");
    const html = page([{ ...base, guestClass: "vip" }]);
    for (const s of [src, html]) {
      expect(s).not.toMatch(/Diamond|Premium|Mesita Select/);
      expect(s).not.toMatch(/\$\s?\d|\d+\s?% off/);
    }
    expect(html).toContain("never sold");
  });
});
