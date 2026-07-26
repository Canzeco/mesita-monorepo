import { MemoConfigClient } from "../MemoConfigClient";

// Memo Config · Config — the persona + models form. MemoConfigClient self-loads
// on mount (no server seed today; the load-error gating is tracked in MESITA-737).
export const dynamic = "force-dynamic";

export default function MemoConfigPage() {
  return <MemoConfigClient />;
}
