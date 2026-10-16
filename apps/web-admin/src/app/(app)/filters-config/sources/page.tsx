import { SourcesBoard } from "../SourcesBoard";
import { getDiscoveryConfig } from "../actions";
import { DEFAULT_CONFIG } from "../catalog";

// Search Sources — one card per source the runtime actually has.
export const dynamic = "force-dynamic";

export default async function SearchSourcesPage() {
  const r = await getDiscoveryConfig();
  const initialConfig = r.ok ? r.config : DEFAULT_CONFIG;
  const initialUpdatedAt = r.ok ? r.updatedAt : null;
  const loadError = r.ok ? null : r.error;
  return (
    <SourcesBoard seed={{ initialConfig, initialUpdatedAt, loadError }} />
  );
}
