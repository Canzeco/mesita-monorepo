// Render harness for the (shell) pages: async Server Components rendered
// with react-dom/server against BOTH mock orgs. No jsdom, no new deps —
// next/navigation is mocked so notFound() throws a sentinel.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("SENTINEL_NOT_FOUND");
  },
}));

// /places is no longer here: it reads the real catalog behind a session,
// so it is covered by the route-contract and middleware tests instead.

import AccountPage from "./(shell)/account/page";
import OrganizationPage from "./(shell)/page";

const sp = (org?: string) => Promise.resolve(org ? { org } : {});

async function render(el: Promise<React.ReactNode>) {
  return renderToStaticMarkup(<>{await el}</>);
}

describe("organization page (the / layer)", () => {
  it("renders identity + finances + members + commercial for the partner org", async () => {
    const html = await render(OrganizationPage({ searchParams: sp() }));
    expect(html).toContain("Grupo Ruiz");
    expect(html).toContain("Connected");
    expect(html).toContain("RFC-MOCK-GR2024");
    expect(html).toContain("Credits owed");
    expect(html).toContain("Patricia Ruiz");
    expect(html).toContain("Aggression");
  });
  it("renders the day-one org: not connected, no account, commercial locked", async () => {
    const html = await render(OrganizationPage({ searchParams: sp("nuevo") }));
    expect(html).toContain("La Nueva");
    expect(html).toContain("Not connected");
    expect(html).toContain("No payment account yet");
    expect(html).toContain("Locked at Zero");
  });

  it("never shows a PLACE state as the organization's status", async () => {
    // Listed / Verified / Partner describe one address, not a legal
    // person. The org header must not borrow them.
    for (const org of [undefined, "nuevo"]) {
      const html = await render(OrganizationPage({ searchParams: sp(org) }));
      const header = html.slice(0, html.indexOf("Identity"));
      expect(header).not.toContain("Listed");
      expect(header).not.toContain("Verified");
      expect(header).not.toContain("Partner");
    }
  });
  it("survives a garbage org param", async () => {
    const html = await render(
      OrganizationPage({ searchParams: sp("garbage") }),
    );
    expect(html).toContain("Grupo Ruiz");
  });
});

describe("account layer", () => {
  it("renders the owner", async () => {
    expect(await render(AccountPage({ searchParams: sp() }))).toContain(
      "Patricia Ruiz",
    );
  });
});
