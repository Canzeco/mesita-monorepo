// @vitest-environment jsdom
//
// COMPONENT-RENDER TESTS (MESITA-2034, Eng Review D20). This app's other
// tests are all pure-logic (`environment: "node"`, no rendered component
// ever existed here before this file); the `@vitest-environment` docblock
// above opts THIS file alone into jsdom, so the rest of the suite is
// untouched. Covers the conditional-render branches the setup-grammar
// string-slice gate (T9) cannot see.
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Group } from "./Group";

describe("Group", () => {
  it("renders the heading, description and one card of children", () => {
    render(
      <Group title="Channels" description="Where an order can come from.">
        <div>Mesita app</div>
        <div>Rappi</div>
      </Group>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Channels" })).toBeTruthy();
    expect(screen.getByText("Where an order can come from.")).toBeTruthy();
    expect(screen.getByText("Mesita app")).toBeTruthy();
  });

  it("renders no description paragraph when absent", () => {
    render(
      <Group title="Sources">
        <div>Google</div>
        <div>Instagram</div>
      </Group>,
    );
    expect(screen.queryByText(/where the stars/i)).toBeNull();
  });

  it("renders no trailing node when `right` is absent", () => {
    const { container } = render(
      <Group title="Rules">
        <div>Prep time</div>
        <div>Minimum order</div>
      </Group>,
    );
    // The header row has exactly one child (the title block) when `right` is absent.
    const header = container.querySelector("section > div");
    expect(header?.children.length).toBe(1);
  });

  it("renders `right` trailing on the title line", () => {
    render(
      <Group title="The menu" right={<button>Add a dish</button>}>
        <div>Row</div>
      </Group>,
    );
    expect(screen.getByRole("button", { name: "Add a dish" })).toBeTruthy();
  });

  it("renders the footer when present, omits it when absent", () => {
    const { rerender } = render(
      <Group title="Campaigns" footer="Every campaign says the same thing plainly.">
        <div>Row</div>
      </Group>,
    );
    expect(screen.getByText(/every campaign says/i)).toBeTruthy();

    rerender(
      <Group title="Campaigns">
        <div>Row</div>
      </Group>,
    );
    expect(screen.queryByText(/every campaign says/i)).toBeNull();
  });

  it("warns in dev when a non-Locked Group holds exactly one row", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(
      <Group title="Who can work orders">
        <div>Every owner and editor</div>
      </Group>,
    );
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("Who can work orders");
    warn.mockRestore();
  });

  it("does not warn when `allowOneRow` is set (Locked's sanctioned exception)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(
      <Group title="Needs Mesita Ultra" allowOneRow>
        <div>This place is on Mesita Pro</div>
      </Group>,
    );
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("does not warn when a Group holds two or more rows", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(
      <Group title="Rules">
        <div>Row one</div>
        <div>Row two</div>
      </Group>,
    );
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
