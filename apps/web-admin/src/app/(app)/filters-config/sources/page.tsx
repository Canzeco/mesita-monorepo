import type { ConfigSeed } from "@/components/admin-ui/use-config-editor";
import { SourcesBoard } from "../SourcesBoard";
import type { DiscoveryConfig } from "../catalog";

// Search Sources — one card per source the runtime actually has.
export function SearchSourcesView({ seed }: { seed: ConfigSeed<DiscoveryConfig> }) {
  return (
    <SourcesBoard seed={seed} />
  );
}

export default function SearchSourcesPage() {
  return null;
}
