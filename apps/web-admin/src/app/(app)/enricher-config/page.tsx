import { Wand2 } from "lucide-react";
import { ConfigSoon } from "@/components/admin-ui/ConfigSoon";
import { getSourcingConfig } from "../sourcing-config/actions";
import { SourcingConfigClient } from "../sourcing-config/SourcingConfigClient";
import { DEFAULT_CONFIG } from "../sourcing-config/catalog";

// INTAKE — one page for how a place gets into Mesita and becomes a profile
// (Pato, 2026-08-23: "MOVE SOURCING INTO INTAKE TOO").
//
// TWO BANDS, and the split is the whole point. Sourcing is NOT an Intaker
// function — §8.4 lists only CREATE and ENRICH — it is the policy gate that
// decides which surfaces may find and add a place AT ALL, before any row
// exists. Drawn as one undivided list it would teach that a run performs
// sourcing, and the next person would tune a channel floor expecting the next
// enrichment run to honour it. The bands are the same ones the ladder table
// will carry when the knobs come back (MESITA-1287).
//
// The Source band is LIVE and fully enforced. The Intaker band is still the
// Soon panel from MESITA-1285 — its knobs are stored settings every EF reads,
// with admin-web-update-enricher-config as the only door until the ladder
// lands.
//
// THE MODULES DID NOT MOVE. `/sourcing-config` redirects and its sidebar row
// is gone, but `sourcing-config/{actions,catalog,SourcingConfigClient}` stay
// exactly where they are: `catalog.ts` is cited BY PATH from web-consumer,
// mobile-consumer (frozen) and `_shared/sourcing.ts` as the FAMILIES authoring
// source, and moving the file would break four comments to buy nothing. A
// folder with no page.tsx is just a module folder — the same trick
// `enricher-config/atlas-ui` already plays for six other pages.
export const dynamic = "force-dynamic";

function Band({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-muted-foreground type-meta font-bold tracking-wider uppercase">
      {children}
    </h2>
  );
}

export default async function IntakePage() {
  const res = await getSourcingConfig();

  return (
    <div className="flex flex-col gap-8 sm:gap-10">
      <section className="flex flex-col gap-3">
        <Band>Before the place exists</Band>
        <SourcingConfigClient
          initialConfig={res.ok ? res.config : DEFAULT_CONFIG}
          initialUpdatedAt={res.ok ? res.updatedAt : null}
          loadError={res.ok ? null : res.error}
        />
      </section>

      <section className="flex flex-col gap-3">
        <Band>Once it exists</Band>
        <ConfigSoon
          Icon={Wand2}
          title="The Intaker's settings are coming soon"
          body="Create runs once at the door — seed, pulse, details — and the nine enrich functions re-run on each place's own schedule. They run today on the triggers, caps and models stored the last time this page had knobs; nothing about a run changed. What is gone is the wall that asked an operator to hold nine functions in their head to move one number."
          doc="Notion Docs › Intake"
        />
      </section>
    </div>
  );
}
