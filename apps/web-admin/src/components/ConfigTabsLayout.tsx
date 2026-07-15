"use client";

import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/PageContainer";
import { ConfigTabNav, type ConfigSubRoute } from "@/components/ConfigTabNav";

// Shared chrome for the admin sections that own sub-tabs (Scoring, Enricher,
// Manage Multiple): a header whose description tracks the active tab, the tab
// strip, then the section body. Flat sections compose ConfigPageLayout instead.
//
// `subroutes` carries LucideIcon components, and lucide-react ships no
// "use client" — so a server layout cannot pass a nav module across the client
// boundary ("Functions cannot be passed directly to Client Components"). Every
// caller is therefore a client shell that imports its own nav module and hands
// it to this component client-to-client; the route's layout.tsx (server, and
// async under Scoring) renders only the shell.
export function ConfigTabsLayout({
  title,
  subroutes,
  descriptions,
  children,
}: {
  title: string;
  subroutes: ReadonlyArray<ConfigSubRoute>;
  descriptions: Record<string, string>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const match = subroutes.find(
    (r) => pathname === r.href || pathname.startsWith(`${r.href}/`),
  );
  // The first tab is the section's landing description — used until the
  // pathname resolves to a tab that has one.
  const description =
    (match && descriptions[match.href]) ?? descriptions[subroutes[0].href];

  return (
    <>
      <PageHeader title={title} description={description} />
      <ConfigTabNav ariaLabel={title} subroutes={subroutes} />
      <div className="mt-6 sm:mt-8">{children}</div>
    </>
  );
}
