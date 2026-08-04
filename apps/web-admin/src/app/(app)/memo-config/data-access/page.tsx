import { MemoDataAccessPanel } from "../MemoDataAccessPanel";

// Memo Config · Data Access — the closed set of Edge Functions Memo may read
// through. Static documentation of a code-level invariant (supabase/config.toml
// + _shared/memo-data.ts): nothing here reads or writes config.
export default function MemoDataAccessPage() {
  return <MemoDataAccessPanel />;
}
