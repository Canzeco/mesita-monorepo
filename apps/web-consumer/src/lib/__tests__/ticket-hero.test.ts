import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..", "..");
const REWARDS = join(SRC, "components", "consumer", "rewards");

function read(rel: string): string {
  return readFileSync(join(SRC, rel), "utf8");
}

// MESITA-1350: one primitive owns the named hero corner. The token must
// exist; its pixel value must not be frozen here (brand tweaks live in CSS
// + Design §D).
describe("TicketHero owns rounded-panel (MESITA-1350)", () => {
  it("exports the named radius class, not a raw px corner", () => {
    const hero = read("components/consumer/rewards/TicketHero.tsx");
    expect(hero).toContain('TICKET_HERO_RADIUS_CLASS = "rounded-panel"');
    expect(hero).not.toMatch(/rounded-\[\d+px\]/);
  });

  it("--radius-panel exists in the consumer stylesheet", () => {
    // Existence only — do not pin the pixel integer (MESITA-1350 / A5 close).
    const css = read("app/globals.css");
    expect(css).toMatch(/--radius-panel:/);
  });

  it("the three live heroes and the silhouette import TicketHero", () => {
    expect(read("components/consumer/rewards/TicketScreen.tsx")).toContain(
      'from "@/components/consumer/rewards/TicketHero"',
    );
    expect(read("components/consumer/rewards/ticket-steps.tsx")).toContain(
      'from "@/components/consumer/rewards/TicketHero"',
    );
    expect(read("components/consumer/rewards/SavingsReveal.tsx")).toContain(
      'from "@/components/consumer/rewards/TicketHero"',
    );
    expect(read("components/consumer/rewards/TicketSkeleton.tsx")).toContain(
      "TICKET_HERO_RADIUS_CLASS",
    );
  });

  it("rewards/ does not hand-roll rounded-panel outside TicketHero", () => {
    const files = readdirSync(REWARDS).filter((f) => f.endsWith(".tsx"));
    const offenders = files.filter((f) => {
      if (f === "TicketHero.tsx") return false;
      return readFileSync(join(REWARDS, f), "utf8").includes("rounded-panel");
    });
    expect(offenders).toEqual([]);
  });
});
