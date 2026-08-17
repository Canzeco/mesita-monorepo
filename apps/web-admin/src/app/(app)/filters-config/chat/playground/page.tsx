import { MemoPlaygroundClient } from "../MemoPlaygroundClient";

// Filters Config › Chat › Playground — run live Memo queries at the current
// saved persona. Read-only: nothing here writes config.
export const dynamic = "force-dynamic";

export default function ChatPlaygroundPage() {
  return <MemoPlaygroundClient />;
}
