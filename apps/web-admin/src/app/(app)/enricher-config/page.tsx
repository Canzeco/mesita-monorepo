import { Wand2 } from "lucide-react";
import { ConfigSoon } from "@/components/admin-ui/ConfigSoon";

// Enrichment — EMPTY on purpose (Pato, 2026-08-23: "Fuck this page. Just write
// it as soon"), the same call Visits and Orders took on 2026-08-21: "make the
// fucking page empty… just leave a soon… don't hide the current configurations
// in the html. Literally delete it from the html."
//
// This is NOT the Visits case, and the difference is why the file says so out
// loud. Visits and Orders emptied because ZERO of their knobs were enforced.
// Enrichment's ARE: the trigger grid gated on_create and on_schedule and the
// four $$ subprocesses, and the caps under it bound real Apify / Firecrawl /
// Perplexity / OpenAI spend. Emptying the page unplugs none of that — every
// value keeps the setting it has and every EF keeps reading it — but the
// console can no longer CHANGE it. A previous session refused that trade and
// kept the grid on exactly those grounds; Pato has now made the call a second
// time, so the grid goes with the page. The write door survives: until this
// page is rebuilt, a config change is an admin-web-update-enricher-config call.
//
// THE STORED CONFIG IS UNTOUCHED. app_config.enrichment_triggers and the
// atlas_* columns, `_shared/enrich-triggers.ts` and both EFs stay — with no
// client there is nothing to save, so nothing can overwrite the stored values,
// and the day this page comes back the controls come back with it. The sibling
// modules stay for the same reason they were always shared: Manage Multiple
// reads `actions.ts` for the settings and `cost-model.ts` to price a bulk
// enrich. What every setting means lives in Notion Docs › Enrichment.
export const dynamic = "force-dynamic";

export default function EnrichmentPage() {
  return (
    <ConfigSoon
      Icon={Wand2}
      title="Enrichment settings are coming soon"
      body="The Enricher runs today on the triggers, caps and models stored the last time this page was saved — nothing about a run changed. What is gone is the wall of knobs that asked an operator to hold nine functions in their head to move one number. They come back as a page worth reading."
      doc="Notion Docs › Enrichment"
    />
  );
}
