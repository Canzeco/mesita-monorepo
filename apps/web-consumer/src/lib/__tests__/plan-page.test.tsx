import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PlanModal } from "@/components/consumer/me/PlanModal";
import { FREE_RESERVATIONS_PER_MONTH } from "@/lib/plan-perks";

// MeScreen calls useRouter(); the plan page itself needs no router.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: () => {}, replace: () => {} }),
}));

const text = (html: string) => html.replace(/<[^>]*>/g, " ");
// The visible line of every <li>, in order.
const perks = (section: string) =>
  [...section.matchAll(/<li[^>]*>(.*?)<\/li>/g)].map((m) =>
    text(m[1]).trim(),
  );

describe("Me › Plan (MESITA-2167)", () => {
  const html = renderToStaticMarkup(<PlanModal />);
  // Free ends where Premium's row begins.
  const free = html.slice(html.indexOf(">Free<"), html.indexOf(">Premium<"));
  const premium = html.slice(html.indexOf(">Premium<"));

  it("lists exactly what Free gives, with the monthly reservation limit", () => {
    expect(perks(free)).toEqual([
      "Browse and save places",
      "Mesita calls the place to book your table",
      `${FREE_RESERVATIONS_PER_MONTH} reservations a month`,
    ]);
  });

  it("promises Premium exactly more reservations and the connector — and not on Free", () => {
    expect(perks(premium)).toEqual([
      "More reservations every month",
      "Use Mesita from your AI assistant (MCP connector)",
    ]);
    expect(free).not.toMatch(/MCP|AI assistant|More reservations/);
  });

  it("keeps Premium behind ONE Soon tag — no per-perk Soon, anywhere", () => {
    expect(html.match(/soon/gi)).toHaveLength(1);
    expect(premium).toContain(">Soon<");
  });

  it("marks only what is true today with a check", () => {
    // Positive control first: if lucide ever renames the class, this fails
    // loudly instead of the Premium assertion passing for the wrong reason.
    expect(free).toContain("lucide-check");
    // Premium's row icon is Sparkles; none of its perks wears a check.
    expect(premium).not.toContain("lucide-check");
  });

  it("states no number and no price for Premium — neither is decided", () => {
    // Visible text only: class names carry digits (h-[18px], gap-1.5).
    const words = text(premium);
    expect(words).not.toMatch(/\d/);
    expect(words).not.toMatch(/\$|MX|price|per month|\/mo/i);
  });

  it("exposes each list as a named list", () => {
    expect(html).toContain('aria-label="Included in Free"');
    expect(html).toContain('aria-label="Coming with Premium"');
    expect(html.match(/<ul[^>]*role="list"/g)).toHaveLength(2);
  });
});
