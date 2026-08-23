import { getDiscoveryConfig } from "./actions";
import { DiscoveryConfigClient } from "./DiscoveryConfigClient";
import { DEFAULT_CONFIG } from "./catalog";

// Discovery — the ranking model (MESITA-1196).
//
// This page rendered the words "hello world" from the MESITA-1183 teardown
// until now: the whole filter surface was deleted and Discovery was left as an
// empty lot on purpose, with a note not to add config ahead of the rebuild.
// This IS the rebuild — the weights table Docs › Discovery §A asks for, plus
// the bought lane it deliberately keeps out of the blend.
export const dynamic = "force-dynamic";

export default async function DiscoveryPage() {
  const res = await getDiscoveryConfig();
  return (
    <DiscoveryConfigClient
      initialConfig={res.ok ? res.config : DEFAULT_CONFIG}
      initialUpdatedAt={res.ok ? res.updatedAt : null}
      loadError={res.ok ? null : res.error}
    />
  );
}
