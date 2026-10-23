import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// MESITA-2746: /onboard is one screen with first name, birthday and sex. This
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
  birthday: string;
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
    expect(html).toContain('role="radiogroup"');
    expect(html.match(/role="radio"/g) ?? []).toHaveLength(2);
  });

  it("does not render a stepped progress bar", () => {
    const html = markup();
    expect(html).not.toContain('role="progressbar"');
    expect(html).not.toContain('aria-label="Back"');
  });

  it("prefills stored values while still showing every field", () => {
    const initial = {
      firstName: "Ana",
      birthday: "1998-03-14",
      sex: "",
    };
    const html = markup(initial);
    expect(html).toContain("Ana");
    expect(html).toContain('value="1998"');
    expect(html).toContain('value="14"');
    for (const { label } of ONBOARD_FIELDS) {
      expect(html).toContain(label);
    }
  });

  it("asks the name with a label, not a placeholder echoing it", () => {
    const html = markup();
    const nameInput = /<input\b[^>]*name="first_name"[^>]*>/.exec(html)?.[0] ?? "";
    expect(nameInput).toBeTruthy();
    expect(nameInput).not.toContain("placeholder=");
  });
});
