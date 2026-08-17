import { MemoDataAccessPanel } from "../MemoDataAccessPanel";

// Filters Config › Chat › Data Access — the closed set of Edge Functions Memo
// may read through. Static documentation of a code-level invariant
// (supabase/config.toml + _shared/memo-data.ts): nothing here touches config.
export default function ChatDataAccessPage() {
  return <MemoDataAccessPanel />;
}
