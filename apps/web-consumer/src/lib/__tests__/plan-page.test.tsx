import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PlanModal } from "@/components/consumer/me/PlanModal";
import { FREE_RESERVATIONS_PER_MONTH } from "@/lib/plan-perks";

// MeScreen calls useRouter(); the plan page itself needs no router.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: () => {}, replace: () => {} }),
}));

const text = (html: string) => html.replace(/<[^>]*>/g, " ");
// The visible line of every <li>, in order, without its Soon tag.
const perks = (section: string) =>
  // `<li(\s|>)`, not `<li`: lucide's CreditCard draws an svg <line>.
  [...section.matchAll(/<li(?:\s[^>]*)?>(.*?)<\/li>/g)].map((m) =>
    text(m[1]).replace(/\bSoon\b/, "").replace(/\s+/g, " ").trim(),
  );
const soonCount = (section: string) =>
  (section.match(/data-perk-soon/g) ?? []).length;

const render = (plan: "free" | "pro" | null) => {
  const html = renderToStaticMarkup(<PlanModal plan={plan} />);
  // Free ends where Pro's row begins.
  const free = html.slice(html.indexOf('data-plan-row="Free"'), html.indexOf('data-plan-row="Pro"'));
  const pro = html.slice(html.indexOf('data-plan-row="Pro"'));
  return { html, free, pro };
};

describe("Me › Plan (MESITA-2167, MESITA-2553)", () => {
  const { html, free, pro } = render(null);

  it("lists exactly what Free gives, with the monthly reservation limit", () => {
    expect(perks(free)).toEqual([
      "Browse and save places",
      "Mesita calls the place to book your table",
      `${FREE_RESERVATIONS_PER_MONTH} reservations a month`,
    ]);
    expect(soonCount(free)).toBe(0);
  });

  it("gives Pro everything in Free today, then its unbuilt perks, each tagged Soon", () => {
    expect(perks(pro)).toEqual([
      `Everything in Free, including ${FREE_RESERVATIONS_PER_MONTH} reservations a month`,
      "More reservations every month",
      "Ask your AI assistant, like ChatGPT, to find and book places for you",
    ]);
    expect(soonCount(pro)).toBe(2);
    expect(free).not.toMatch(/ChatGPT|AI assistant|More reservations/);
  });

  it("marks only what is true today with a check", () => {
    // Positive control first: if lucide ever renames the class, this fails
    // loudly instead of a count passing for the wrong reason.
    expect(free.match(/lucide-check/g)).toHaveLength(3);
    expect(pro.match(/lucide-check/g)).toHaveLength(1);
  });

  it("states no price and no hypothesis for Pro — neither is decided", () => {
    const words = text(pro).replace(`${FREE_RESERVATIONS_PER_MONTH}`, "");
    expect(words).not.toMatch(/\d/);
    expect(words).not.toMatch(/\$|MX|price|per month|\/mo|\/yr|year/i);
  });

  it("never names Class, VIP, Premium or Diamond", () => {
    expect(text(html)).not.toMatch(/\b(Class|VIP|Regular|Premium|Diamond|Select)\b/);
  });

  it("exposes each list as a named list", () => {
    expect(html).toContain('aria-label="Included in Free"');
    expect(html).toContain('aria-label="Included in Pro"');
    expect(html.match(/<ul[^>]*role="list"/g)).toHaveLength(2);
  });

  it("claims no plan while it is unknown", () => {
    expect(html).not.toContain("data-plan-mine");
    expect(html).not.toContain("Your plan.");
  });

  it("marks the guest's own plan, and only that one", () => {
    const f = render("free");
    expect(f.free).toContain("Your plan.");
    expect(f.pro).not.toContain("Your plan.");
    const p = render("pro");
    expect(p.pro).toContain("Your plan.");
    expect(p.free).not.toContain("Your plan.");
    expect(p.free).toContain("The free plan.");
  });
});
