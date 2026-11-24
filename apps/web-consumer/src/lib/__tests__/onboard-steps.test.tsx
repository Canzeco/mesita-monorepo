import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// MESITA-2746: /onboard is one screen; since MESITA-4312 it asks first name,
// last name, sex and year of birth. This
// suite runs in the `node` environment with no jsdom (vitest.config.ts), so the
// form cannot be clicked through — only static markup is checked.

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    refresh: () => {},
    back: () => {},
    forward: () => {},
    prefetch: () => {},
  }),
}));

import { OnboardForm } from "@/app/onboard/OnboardForm";
import {
  ONBOARD_FIELDS,
  ONBOARD_PAGE_HEADLINE,
} from "@/lib/consumer-onboarding";

function markup(initial?: {
  firstName: string;
  lastName: string;
  birthYear: number | null;
  sex: string;
}) {
  return renderToStaticMarkup(<OnboardForm initial={initial} />);
}

describe("the onboarding form renders all fields on one screen", () => {
  it("shows the page headline and every field label together", () => {
    const html = markup();
    expect(html).toContain(ONBOARD_PAGE_HEADLINE);
    for (const { label } of ONBOARD_FIELDS) {
      expect(html).toContain(label);
    }
    expect(html).toContain('name="first_name"');
    expect(html).toContain('name="last_name"');
    expect(html).toContain('role="radiogroup"');
    expect(html.match(/role="radio"/g) ?? []).toHaveLength(3);
  });

  it("does not render a stepped progress bar", () => {
    const html = markup();
    expect(html).not.toContain('role="progressbar"');
    expect(html).not.toContain('aria-label="Back"');
  });

  it("prefills stored values while still showing every field", () => {
    const initial = {
      firstName: "Ana",
      lastName: "Ruiz",
      birthYear: 1998,
      sex: "",
    };
    const html = markup(initial);
    expect(html).toContain('value="Ana"');
    expect(html).toContain('value="Ruiz"');
    expect(html).toMatch(/<option[^>]*value="1998"[^>]*selected/);
    for (const { label } of ONBOARD_FIELDS) {
      expect(html).toContain(label);
    }
  });

  it("asks each name half with a label; any placeholder is an example, never the label echoed", () => {
    const html = markup();
    for (const field of ["first_name", "last_name"]) {
      const input =
        new RegExp(`<input\\b[^>]*name="${field}"[^>]*>`).exec(html)?.[0] ?? "";
      expect(input).toBeTruthy();
      expect(input).not.toMatch(/placeholder="(first|last) name"/i);
    }
  });
});
