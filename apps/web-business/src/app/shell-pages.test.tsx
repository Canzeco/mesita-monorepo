// Render harness for the (shell) pages: async Server Components rendered
// with react-dom/server against BOTH mock orgs. No jsdom, no new deps —
// next/navigation is mocked so notFound()/redirect() throw sentinels.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("SENTINEL_NOT_FOUND");
  },
  redirect: (url: string) => {
    throw new Error(`SENTINEL_REDIRECT:${url}`);
  },
}));

import AccountPage from "./(shell)/account/page";
import CommercialPage from "./(shell)/commercial/page";
import FinancesPage from "./(shell)/finances/page";
import MembersPage from "./(shell)/members/page";
import OrgHomePage from "./(shell)/page";
import PlaceIndexPage from "./(shell)/places/[id]/page";
import PlaceProfilePage from "./(shell)/places/[id]/profile/page";
import PlaceServicesPage from "./(shell)/places/[id]/services/page";
import PlaceStatusPage from "./(shell)/places/[id]/status/page";
import PlacesPage from "./(shell)/places/page";

const sp = (org?: string, extra: Record<string, string> = {}) =>
  Promise.resolve({ ...(org ? { org } : {}), ...extra });
const params = (id: string) => Promise.resolve({ id });

async function render(el: Promise<React.ReactNode> | Promise<void>) {
  return renderToStaticMarkup(<>{await el}</>);
}

describe("org home", () => {
  it("renders the established org with anchor band and stream", async () => {
    const html = await render(OrgHomePage({ searchParams: sp() }));
    expect(html).toContain("Grupo Ruiz");
    expect(html).toContain("Partner");
    expect(html).toContain("Covers today");
    expect(html).toContain("check honored");
  });
  it("renders the day-one org with empty state", async () => {
    const html = await render(OrgHomePage({ searchParams: sp("nuevo") }));
    expect(html).toContain("La Nueva");
    expect(html).toContain("Nothing yet");
  });
  it("filters the stream by place and survives a garbage filter", async () => {
    const filtered = await render(
      OrgHomePage({ searchParams: sp(undefined, { place: "p-roma" }) }),
    );
    expect(filtered).not.toContain("Pickup · prepaid");
    const garbage = await render(
      OrgHomePage({ searchParams: sp("garbage", { place: "nope" }) }),
    );
    expect(garbage).toContain("Grupo Ruiz");
  });
});

describe("org sections", () => {
  it("finances shows live account + credits terms", async () => {
    const html = await render(FinancesPage({ searchParams: sp() }));
    expect(html).toContain("Live");
    expect(html).toContain("Credits owed");
    expect(html).toContain("90 days");
  });
  it("finances shows the connect empty state on day one", async () => {
    const html = await render(FinancesPage({ searchParams: sp("nuevo") }));
    expect(html).toContain("No payment account yet");
  });
  it("commercial shows dial for partner, lock for non-partner", async () => {
    expect(await render(CommercialPage({ searchParams: sp() }))).toContain(
      "Aggression",
    );
    expect(
      await render(CommercialPage({ searchParams: sp("nuevo") })),
    ).toContain("Locked at Zero");
  });
  it("members renders both orgs", async () => {
    expect(await render(MembersPage({ searchParams: sp() }))).toContain(
      "All places",
    );
    expect(await render(MembersPage({ searchParams: sp("nuevo") }))).toContain(
      "Just you so far",
    );
  });
  it("account renders the owner", async () => {
    expect(await render(AccountPage({ searchParams: sp() }))).toContain(
      "Patricia Ruiz",
    );
  });
});

describe("places", () => {
  it("lists places and the day-one empty state", async () => {
    expect(await render(PlacesPage({ searchParams: sp() }))).toContain(
      "Polanco",
    );
    expect(await render(PlacesPage({ searchParams: sp("nuevo") }))).toContain(
      "No places yet",
    );
  });
  it("bare place path redirects to profile", async () => {
    await expect(
      render(PlaceIndexPage({ params: params("p-roma"), searchParams: sp() })),
    ).rejects.toThrow("SENTINEL_REDIRECT:/places/p-roma/profile");
  });
  it("tabs render for a real place", async () => {
    expect(
      await render(
        PlaceProfilePage({ params: params("p-polanco"), searchParams: sp() }),
      ),
    ).toContain("Av. Presidente Masaryk");
    expect(
      await render(
        PlaceServicesPage({ params: params("p-santafe"), searchParams: sp() }),
      ),
    ).toContain("Reservations");
    expect(
      await render(
        PlaceStatusPage({ params: params("p-roma"), searchParams: sp() }),
      ),
    ).toContain("Verified");
  });
  it("unknown place id hits notFound on every tab", async () => {
    for (const Page of [PlaceProfilePage, PlaceServicesPage, PlaceStatusPage]) {
      await expect(
        render(Page({ params: params("nope"), searchParams: sp() })),
      ).rejects.toThrow("SENTINEL_NOT_FOUND");
    }
  });
});
