import { Bot, Globe, Users } from "lucide-react";
import { ConfigSoon } from "@/components/admin-ui/ConfigSoon";
import { GeneralConfigClient } from "../GeneralConfigClient";
import { GoogleModuleCards } from "../GoogleModuleCards";
import { SignalsConfigClient } from "../SignalsConfigClient";
import { getDiscoveryConfig } from "../actions";
import { DEFAULT_CONFIG } from "../catalog";

// Discovery Modules — seven boxes after the shared Google types strip:
// Autocomplete · Text Search · Nearby · Perplexity Search · Perplexity
// Agent · Mesita Places Lineup · Social Lineup. Signals are not a
// module. General is not a module.
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
      <div id="s-perplexity" className="scroll-mt-16">
        <ConfigSoon
          Icon={Globe}
          title="Perplexity Search is coming soon"
          body="Perplexity Search API — ranked web results. Not Agent. Chat is not a Perplexity thread."
          doc="Notion Docs › Discovery"
        />
      </div>
      <div id="s-perplexity-agent" className="scroll-mt-16">
        <ConfigSoon
          Icon={Bot}
          title="Perplexity Agent is coming soon"
          body="A Perplexity agent turn, not Search. Chat may call it later. Not an Atlas page."
          doc="Notion Docs › Discovery"
        />
      </div>
      <SignalsConfigClient
        initialConfig={initialConfig}
        initialUpdatedAt={initialUpdatedAt}
        loadError={loadError}
      />
      <div id="s-social-lineup" className="scroll-mt-16">
        <ConfigSoon
          Icon={Users}
          title="Mesita Social Lineup is coming soon"
          body="Events and happenings, not venues. Places Lineup Social is a place-feed signal; this module is the event feed."
          doc="Notion Docs › Discovery"
        />
      </div>
    </div>
  );
}
