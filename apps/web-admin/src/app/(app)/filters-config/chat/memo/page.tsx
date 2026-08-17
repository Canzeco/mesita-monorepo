import { getMemoConfig } from "../memo-actions";
import { MemoConfigClient } from "../MemoConfigClient";
import { DEFAULT_MEMO_CONFIG } from "../memo-types";

// Filters Config › Chat › Memo — the persona and models behind Home › Chat.
// Server-seeds like the other config editors so a failed GET surfaces as
// loadError and Save stays blocked (MESITA-737) — never silently edit code
// defaults over the live singleton.
export const dynamic = "force-dynamic";

export default async function ChatMemoPage() {
  const res = await getMemoConfig();
  return (
    <MemoConfigClient
      initialConfig={res.ok ? res.data : DEFAULT_MEMO_CONFIG}
      loadError={res.ok ? null : res.error}
    />
  );
}
