import { MemoConfigClient } from "./MemoConfigClient";

// Memo Config — its own sidebar section again (MESITA-627). Memo is one of the
// three product agents, not a ranking tab: the Pre-Memo deck is its input, but
// its persona / model / retrieval knobs are its own. /scoring-config/memo now
// redirects here.
export const dynamic = "force-dynamic";

export default function MemoConfigPage() {
  return <MemoConfigClient />;
}
