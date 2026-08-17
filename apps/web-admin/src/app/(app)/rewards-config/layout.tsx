import { PageContainer } from "@/components/PageContainer";
import { PromosLayoutShell } from "./PromosLayoutShell";
import { PromosState } from "./PromosState";
import { PromosSaveFooter } from "./PromosSaveFooter";
import { getPromosConfig } from "./actions";
import { DEFAULT_PROMOS } from "./promos";

// Promos Config — tabbed (Visits · Orders · Distribution). CONTEXT cuts before
// identity (Notion §2.8), so the tabs split by context first.
//
// The layout owns the DOCUMENT: it server-seeds the config, holds the dirty
// flag and the Save action, and mounts one Save footer under whichever tab is
// open. Visits and Orders are views onto that one blob, never separate
// documents — a Save per tab would revert the other tab's unsaved edits (D5).
//
// Server-seeded like the other blob editors so a failed GET surfaces as
// loadError and Save stays blocked (MESITA-737) — never silently edit code
// defaults over the live singleton.
export const dynamic = "force-dynamic";

export default async function PromosConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const res = await getPromosConfig();
  return (
    <PageContainer>
      <PromosLayoutShell>
        <PromosState
          initialConfig={res.ok ? res.config : DEFAULT_PROMOS}
          initialUpdatedAt={res.ok ? res.updatedAt : null}
          initialSeeded={res.ok ? res.seeded : false}
          loadError={res.ok ? null : res.error}
        >
          {children}
          <PromosSaveFooter />
        </PromosState>
      </PromosLayoutShell>
    </PageContainer>
  );
}
