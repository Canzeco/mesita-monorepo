import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SignalGraphic } from "./SignalGraphic";

describe("signal graphics live on Signals", () => {
  it("draws the name graphic without a weight", () => {
    const html = renderToStaticMarkup(
      <SignalGraphic signal="name" maxKm={25} closedFloor={0.2} />,
    );
    expect(html).toContain("Search query");
    expect(html).toContain("Preview");
    expect(html).not.toContain("Effective contribution");
    expect(html).not.toContain("Weight");
  });

  it("keeps the graphic off Modes", () => {
    const modes = readFileSync(join(__dirname, "modes/page.tsx"), "utf8");
    const signals = readFileSync(join(__dirname, "SignalsConfigClient.tsx"), "utf8");
    expect(modes).not.toContain("ModeSignals");
    expect(modes).not.toContain("SignalGraphic");
    expect(modes).not.toContain("Effective contribution");
    expect(signals).toContain("SignalGraphic");
  });
});
