import { MemoPlaygroundClient } from "../MemoPlaygroundClient";

// Memo Config · Playground — run one live Memo query at the current saved
// persona. Read-only: nothing here writes config.
export const dynamic = "force-dynamic";

export default function MemoPlaygroundPage() {
  return <MemoPlaygroundClient />;
}
