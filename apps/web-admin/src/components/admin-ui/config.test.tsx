import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NumberField, commitNumberDraft, numberDraftAllowed } from "./config";

const penalty = { decimals: true, min: 0.1, max: 10 };

describe("a typed number inside its range (MESITA-2733)", () => {
  it("keeps an unfinished draft instead of snapping back to the minimum", () => {
    for (const raw of ["", "0", "0.", "0,", "."]) {
      expect(numberDraftAllowed(raw === "0," ? "0." : raw, true, 0.1), raw).toBe(true);
      expect(commitNumberDraft(raw, { ...penalty, clamp: false }), raw).toBeNull();
    }
    expect(commitNumberDraft("0", { ...penalty, clamp: true })).toBe(0.1);
    expect(commitNumberDraft("", { ...penalty, clamp: true })).toBeNull();
    expect(commitNumberDraft("0.", { ...penalty, clamp: true })).toBeNull();
  });

  it("takes 0.5, which the 0.25 spinner could not land on", () => {
    expect(commitNumberDraft("0.5", { ...penalty, clamp: false })).toBe(0.5);
    expect(commitNumberDraft("0,5", { ...penalty, clamp: false })).toBe(0.5);
    expect(commitNumberDraft("10", { ...penalty, clamp: false })).toBe(10);
    expect(commitNumberDraft("10.0", { ...penalty, clamp: false })).toBe(10);
  });

  it("holds an out-of-range draft while typing and clamps it when the field closes", () => {
    expect(commitNumberDraft("99", { ...penalty, clamp: false })).toBeNull();
    expect(commitNumberDraft("99", { ...penalty, clamp: true })).toBe(10);
    expect(commitNumberDraft("1", { ...penalty, clamp: false })).toBe(1);
    expect(commitNumberDraft("15", { ...penalty, clamp: false })).toBeNull();
    expect(commitNumberDraft("15", { ...penalty, clamp: true })).toBe(10);
  });

  it("refuses letters, a second dot, and a minus when the range starts at 0 or above", () => {
    expect(numberDraftAllowed("0.5a", true, 0.1)).toBe(false);
    expect(numberDraftAllowed("0.5.1", true, 0.1)).toBe(false);
    expect(numberDraftAllowed("-1", true, 0.1)).toBe(false);
    expect(numberDraftAllowed("-1", true, -5)).toBe(true);
    expect(numberDraftAllowed("1.5", false, 0)).toBe(false);
    expect(commitNumberDraft("4", { decimals: false, min: 1, max: 80, clamp: false })).toBe(4);
  });

  it("renders a text field with the range and no spinner", () => {
    const html = renderToStaticMarkup(
      <NumberField
        label="Map distance penalty"
        value={0.1}
        min={0.1}
        max={10}
        decimals
        disabled={false}
        onChange={() => {}}
        hint="Bigger favours nearer places; smaller favours popular places."
      />,
    );
    expect(html).toContain('type="text"');
    expect(html).toContain('inputMode="decimal"');
    expect(html).toContain('value="0.1"');
    expect(html).toContain("0.1–10");
    expect(html).toContain(">Map distance penalty<");
    expect(html).not.toContain('type="number"');
    expect(html).not.toContain("step=");
  });
});
