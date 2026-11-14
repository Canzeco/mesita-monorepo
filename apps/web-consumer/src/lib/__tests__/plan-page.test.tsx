import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PlanModal } from "@/components/consumer/me/PlanModal";

// MeScreen calls useRouter(); the plan page itself needs no router.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: () => {}, replace: () => {} }),
}));

const text = (html: string) => html.replace(/<[^>]*>/g, " ");

// Plan is sold (MESITA-3870, Pato: "make it 2 dollar per month"): the one
// price on the page is Pro's $1 a month (MESITA-3881), and nothing is sold before the
// server says which plan the guest is on (MVP test rule: money).
describe("Me › Plan (MESITA-3870)", () => {
  const html = renderToStaticMarkup(<PlanModal />);

  it("prices Pro at $1 a month and offers no Upgrade before the plan is known", () => {
    expect(text(html).match(/\$\s?\d+(\.\d+)?/g)).toEqual(["$1"]);
    expect(text(html)).toContain("$1 USD a month");
    expect(text(html)).not.toMatch(/MX\$/);
    // The header's back arrow is the only button until the read lands.
    expect(html.match(/<button\b/g) ?? []).toHaveLength(1);
    expect(html).not.toMatch(/<(form|input)\b/);
  });

  it("never names Class, VIP, Premier, Premium or Diamond", () => {
    expect(text(html)).not.toMatch(
      /\b(Class|VIP|Regular|Premier|Premium|Diamond|Select)\b/,
    );
  });
});
