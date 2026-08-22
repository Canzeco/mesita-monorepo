import { getFiltersConfig } from "../actions";
import { getMemoConfig } from "../memo-actions";
import { EnginesClient } from "../EnginesClient";
import { MemoConfigClient } from "../MemoConfigClient";
import { DEFAULT_FILTERS } from "../filters";
import { DEFAULT_MEMO_CONFIG } from "../memo-types";

// Discovery › Engines — the surfaces that turn signals into places.
//
// Memo rides along at the bottom: it IS the chat engine, and it is the only
// engine with a brain to configure. Its own blob, its own Save — the same
// compose-independent-clients shape General uses. It kept its editor when the
// Chat tab was deleted because deleting an agent's only control surface is a
// capability loss, not a simplification. The Memo PLAYGROUND did go: testing
// happens end to end from the consumer app, the same call the Reservations
// Playground got when it was retired (2026-07-27).
export const dynamic = "force-dynamic";

export default async function DiscoveryEnginesPage() {
  const [res, memo] = await Promise.all([getFiltersConfig(), getMemoConfig()]);
  return (
    <div className="flex flex-col gap-4">
      <EnginesClient
        initialConfig={res.ok ? res.config : DEFAULT_FILTERS}
        initialUpdatedAt={res.ok ? res.updatedAt : null}
        initialSeeded={res.ok ? res.seeded : false}
        loadError={res.ok ? null : res.error}
      />
      <MemoConfigClient
        initialConfig={memo.ok ? memo.data : DEFAULT_MEMO_CONFIG}
        loadError={memo.ok ? null : memo.error}
      />
    </div>
  );
}
