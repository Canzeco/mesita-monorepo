// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlaceScopeProvider } from "@/components/console/PlaceScope";
import { PLACES } from "@/mock/fixtures";
import { MenuView } from "./MenuView";

function renderMenu() {
  return render(
    <PlaceScopeProvider
      value={{ place: PLACES[0]!, pool: null, tabs: [], pages: [], readFailed: false }}
    >
      <MenuView />
    </PlaceScopeProvider>,
  );
}

describe("Digital Menu nutrition", () => {
  it("puts the headline facts above the blurb, and a dash where nothing was estimated", () => {
    renderMenu();

    const tomahawk = screen.getByText("Tomahawk 1.2kg").closest("tr");
    expect(tomahawk?.textContent).toContain(
      "1,860 kcal · 168 g protein · 0 g carbs · 128 g fat",
    );
    const facts = tomahawk?.textContent ?? "";
    expect(facts.indexOf("1,860 kcal")).toBeLessThan(
      facts.indexOf("Dry-aged 40 days"),
    );

    const paloma = screen.getByText("Paloma de la casa").closest("tr");
    expect(paloma?.textContent).not.toContain("kcal");
    expect(paloma?.textContent).toContain("—");
  });
});
