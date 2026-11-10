import { ActivityPage } from "@/components/consumer/activity/ActivityPage";

// /activity — the bar's Activity tab: every money line, newest first
// (MESITA-3631; it was /me/transactions, MESITA-3465).
export default function Page() {
  return <ActivityPage />;
}
