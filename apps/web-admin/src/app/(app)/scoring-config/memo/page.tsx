import { MemoConfigClient } from "./MemoConfigClient";

// Memo Config, folded into the scoring system (Memo is one of the three
// scoring engines). Same client + EFs as the old standalone /memo-config.
export const dynamic = "force-dynamic";

export default function ScoringMemoPage() {
  return <MemoConfigClient />;
}
