import { getMemoConfig } from "./actions";
import { MemoConfigClient } from "./MemoConfigClient";
import { MEMO_DEFAULTS } from "./types";

// Memo Config, folded into the scoring system (Memo is one of the three
// scoring engines). Same client + EFs as the old standalone /memo-config.

export default async function ScoringMemoPage() {
  const res = await getMemoConfig();
  return (
    <MemoConfigClient
      initialConfig={res.ok ? res.data : MEMO_DEFAULTS}
      loadError={res.ok ? null : res.error}
    />
  );
}
