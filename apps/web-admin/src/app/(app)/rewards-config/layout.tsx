import { PageContainer } from "@/components/PageContainer";
import { PromosLayoutShell } from "./PromosLayoutShell";
import { PromosState } from "./PromosState";
import { getPromosConfig } from "./actions";
import { DEFAULT_PROMOS } from "./promos";

// Rewards Config — one page. The layout owns the DOCUMENT: server-seed, dirty
// flag, one Save. Save sits on the page after the knobs so the simulator
// below does not own a control.
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
        </PromosState>
      </PromosLayoutShell>
    </PageContainer>
  );
}
