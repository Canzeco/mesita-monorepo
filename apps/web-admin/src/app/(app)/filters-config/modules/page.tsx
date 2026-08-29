import { Globe, Users } from "lucide-react";
import { ConfigSoon } from "@/components/admin-ui/ConfigSoon";
import { GeneralConfigClient } from "../GeneralConfigClient";
import { GoogleModuleCards } from "../GoogleModuleCards";
import { SignalsConfigClient } from "../SignalsConfigClient";
import { getDiscoveryConfig } from "../actions";
import { DEFAULT_CONFIG } from "../catalog";

// Discovery Modules — six boxes. Google types (shared hyper) · Autocomplete ·
// Nearby · Text Search · Mesita Places Lineup · Social Lineup · Perplexity.
// Signals are not a module. General is not a module.
export const dynamic = "force-dynamic";

export default async function SearchModulesPage() {
  const seed = await getDiscoveryConfig();
  const initialConfig = seed.ok ? seed.config : DEFAULT_CONFIG;
  const initialUpdatedAt = seed.ok ? seed.updatedAt : null;
  const loadError = seed.ok ? null : seed.error;
  return (
    <div className="flex flex-col gap-10">
      <GeneralConfigClient
        initialConfig={initialConfig}
        initialUpdatedAt={initialUpdatedAt}
        loadError={loadError}
      />
      <GoogleModuleCards />
      <SignalsConfigClient
        initialConfig={initialConfig}
        initialUpdatedAt={initialUpdatedAt}
        loadError={loadError}
      />
      <div id="s-social-lineup" className="scroll-mt-16">
        <ConfigSoon
          Icon={Users}
          title="Mesita Social Lineup is coming soon"
          body="Events and happenings, not venues. Does not reuse the eight place signals."
          doc="Notion Docs › Discovery"
        />
      </div>
      <div id="s-perplexity" className="scroll-mt-16">
        <ConfigSoon
          Icon={Globe}
          title="Perplexity Search is coming soon"
          body="Perplexity Search API — ranked web results. Not Agent. Agent stays Atlas. Chat is not a Perplexity thread."
          doc="Notion Docs › Discovery"
        />
      </div>
    </div>
  );
}
