import { ConfigPageLayout } from "@/components/ConfigPageLayout";
import { PromosState } from "./PromosState";
import { getPromosConfig } from "./actions";
import { DEFAULT_PROMOS } from "./promos";

// Rewards — one flat page. Chrome is ConfigPageLayout, the same shared kit
// Visits, Controls and Intake use; a route-local shim of PageContainer +
// PageHeader is what the package rules forbid, and it is all this file would
// otherwise be. The title is the rail label alone — a label never repeats its
// section heading, and the eyebrow already says Product · Rewards. The
// description is the ONE scope line governing all three boxes: no box on the
// page restates it (MESITA-1421).
//
// The layout owns the DOCUMENT: server-seed, dirty flag, one Save. Save sits
// on the page after the knobs so the simulator below does not own a control.
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
    <ConfigPageLayout
      eyebrow="Product · Rewards"
      title="Rewards"
      description="Visit rewards only — not orders, not prepaid."
    >
      <PromosState
        initialConfig={res.ok ? res.config : DEFAULT_PROMOS}
        initialUpdatedAt={res.ok ? res.updatedAt : null}
        initialSeeded={res.ok ? res.seeded : false}
        loadError={res.ok ? null : res.error}
      >
        {children}
      </PromosState>
    </ConfigPageLayout>
  );
}
