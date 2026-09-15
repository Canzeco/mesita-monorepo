import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// WHY THIS FILE EXISTS. MESITA-1830 turned /onboard from one screen with three
// questions into three screens with one each, and the whole promise of that
// change is a negative: at any moment exactly ONE question is on screen, and
// the progress control says truthfully which one. A regression here does not
// throw and does not fail typecheck — it just shows two questions again, or
// shows a Back on the first screen that leads out of the flow.
//
// This suite runs in the `node` environment with no jsdom and no
// testing-library (vitest.config.ts), so the step cannot be CLICKED through.
// What is provable statically is the part that matters: which step a given
// stored profile opens on, and what that step renders. `renderToStaticMarkup`
// is the established pattern in this package (see
// components/consumer/search/search-overlays.test.tsx).
//
// `useRouter` is stubbed because next/navigation's hook throws outside an app
// router provider. Nothing here exercises navigation — that only happens after
// a successful write, which this environment cannot make.
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
import { ONBOARD_STEPS } from "@/lib/consumer-onboarding";

/** React escapes apostrophes in text nodes, so "When's" lands in the markup as
 *  "When&#x27;s". Compare headlines through the same transform rather than
 *  keeping an escaped copy that can drift from the real one. */
const asHtml = (s: string) => s.replace(/'/g, "&#x27;");

const headlines = ONBOARD_STEPS.map((s) => s.headline);

/** Every headline the rendered markup actually contains. The assertions are
 *  written against this list rather than a single `toContain`, so "shows the
 *  right question" and "shows only that question" are the same check. */
function shown(initial?: {
  firstName: string;
  birthday: string;
  sex: string;
}): string[] {
  const html = renderToStaticMarkup(<OnboardForm initial={initial} />);
  return headlines.filter((h) => html.includes(asHtml(h)));
}

function markup(initial?: {
  firstName: string;
  birthday: string;
  sex: string;
}) {
  return renderToStaticMarkup(<OnboardForm initial={initial} />);
}

describe("the onboarding stepper renders one question at a time", () => {
  it("opens on the first question when nothing is stored", () => {
    const html = markup();
    expect(shown()).toEqual([headlines[0]]);
    expect(html).toContain('aria-valuenow="1"');
    expect(html).toContain('aria-label="Step 1 of 3"');
    // Nothing precedes question one inside the flow; the page's "Not you?"
    // footnote is the exit. A Back here would walk the guest out of signup.
    expect(html).not.toContain('aria-label="Back"');
  });

  it("resumes at the birthday when only the name is stored", () => {
    const initial = { firstName: "Ana", birthday: "", sex: "" };
    const html = markup(initial);
    expect(shown(initial)).toEqual([headlines[1]]);
    expect(html).toContain('aria-valuenow="2"');
    expect(html).toContain('aria-label="Back"');
  });

  it("resumes at sex when the name and birthday are already written", () => {
    const initial = { firstName: "Ana", birthday: "1998-03-14", sex: "" };
    const html = markup(initial);
    expect(shown(initial)).toEqual([headlines[2]]);
    expect(html).toContain('aria-valuenow="3"');
    expect(html).toContain('aria-label="Back"');
    // The radiogroup markup the gate's drift alarm also greps for — two
    // options and no third, because the DB check constraint allows two.
    expect(html).toContain('role="radiogroup"');
    expect(html.match(/role="radio"/g) ?? []).toHaveLength(2);
  });

  it("never puts two questions on the screen at once", () => {
    for (const initial of [
      undefined,
      { firstName: "Ana", birthday: "", sex: "" },
      { firstName: "Ana", birthday: "1998-03-14", sex: "" },
      // A legacy sex value the DB would refuse is a gap, not an answer, so
      // this still opens on step 3 rather than rendering nothing.
      { firstName: "Ana", birthday: "1998-03-14", sex: "other" },
    ]) {
      expect(shown(initial), `initial=${JSON.stringify(initial)}`).toHaveLength(
        1,
      );
    }
  });

  it("asks the name with a label, not a placeholder echoing it", () => {
    // The defect this flow was built out of: `<Field label="First name">`
    // wrapping `placeholder="First name"`, the same string twice.
    const html = markup();
    expect(html).toContain('name="first_name"');
    expect(html).not.toContain("placeholder=");
  });
});
