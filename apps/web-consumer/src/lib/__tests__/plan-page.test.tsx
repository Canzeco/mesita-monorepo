import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PlanModal } from "@/components/consumer/me/PlanModal";

// MeScreen calls useRouter(); the plan page itself needs no router.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: () => {}, replace: () => {} }),
}));

const text = (html: string) => html.replace(/<[^>]*>/g, " ");

// Plan is Soon on screen (MESITA-3835): a guard on money words, the one rule
// this page keeps (MVP test rule: money, never layout or copy).
describe("Me › Plan (MESITA-3835)", () => {
  const html = renderToStaticMarkup(<PlanModal />);

  it("states no price and sells nothing", () => {
    expect(text(html)).not.toMatch(/\$\s?\d|MX\$|\bprice\b|per month/i);
    // The header's back arrow is the only button (MeScreen).
    expect(html.match(/<button\b/g) ?? []).toHaveLength(1);
    expect(html).not.toMatch(/<(form|input)\b/);
  });

  it("never names Class, VIP, Premier, Premium or Diamond", () => {
    expect(text(html)).not.toMatch(
      /\b(Class|VIP|Regular|Premier|Premium|Diamond|Select)\b/,
    );
  });
});
