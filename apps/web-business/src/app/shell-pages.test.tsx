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

import AccountPage from "./(shell)/account/page";
import OrganizationPage from "./(shell)/page";
import PlacePage from "./(shell)/places/[id]/page";
import PlacesPage from "./(shell)/places/page";

const sp = (org?: string) => Promise.resolve(org ? { org } : {});
const params = (id: string) => Promise.resolve({ id });

async function render(el: Promise<React.ReactNode>) {
  return renderToStaticMarkup(<>{await el}</>);
}

describe("organization page (the / layer)", () => {
  it("renders identity + finances + members + commercial for the partner org", async () => {
    const html = await render(OrganizationPage({ searchParams: sp() }));
    expect(html).toContain("Grupo Ruiz");
    expect(html).toContain("RFC-MOCK-GR2024");
    expect(html).toContain("Credits owed");
    expect(html).toContain("Patricia Ruiz");
    expect(html).toContain("Aggression");
  });
  it("renders the day-one org: no account, commercial locked", async () => {
    const html = await render(OrganizationPage({ searchParams: sp("nuevo") }));
    expect(html).toContain("La Nueva");
    expect(html).toContain("No payment account yet");
    expect(html).toContain("Locked at Zero");
  });
  it("survives a garbage org param", async () => {
    const html = await render(
      OrganizationPage({ searchParams: sp("garbage") }),
    );
    expect(html).toContain("Grupo Ruiz");
  });
});

describe("places layer", () => {
  it("lists places and the day-one empty state", async () => {
    expect(await render(PlacesPage({ searchParams: sp() }))).toContain(
      "Polanco",
    );
    expect(await render(PlacesPage({ searchParams: sp("nuevo") }))).toContain(
      "No places yet",
    );
  });
  it("renders one place with profile, services and status sections", async () => {
    const html = await render(
      PlacePage({ params: params("p-polanco"), searchParams: sp() }),
    );
    expect(html).toContain("Av. Presidente Masaryk");
    expect(html).toContain("Reservations");
    expect(html).toContain("Verified");
  });
  it("unknown place id hits notFound", async () => {
    await expect(
      render(PlacePage({ params: params("nope"), searchParams: sp() })),
    ).rejects.toThrow("SENTINEL_NOT_FOUND");
  });
});

describe("account layer", () => {
  it("renders the owner", async () => {
    expect(await render(AccountPage({ searchParams: sp() }))).toContain(
      "Patricia Ruiz",
    );
  });
});
