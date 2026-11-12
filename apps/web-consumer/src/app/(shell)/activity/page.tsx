import { ActivityPage } from "@/components/consumer/activity/ActivityPage";

// /activity — the bar's Activity tab (MESITA-3769): five chips,
// Notifications · Reservations · Visits · Vouchers · Gifts. The chip is in
// `?type=`; a bare /activity is Notifications.
export default function Page() {
  return <ActivityPage />;
}
