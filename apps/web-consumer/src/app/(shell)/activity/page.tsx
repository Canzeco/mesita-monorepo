import { ActivityPage } from "@/components/consumer/activity/ActivityPage";

// /activity — the bar's Activity tab (MESITA-3769): six chips (MESITA-3697,
// MESITA-3716), Reservations · Visits · Vouchers · Gifts · Notifications
// (Favorites left in MESITA-3723). The chip is in `?type=`; a bare
// /activity is Reservations.
export default function Page() {
  return <ActivityPage />;
}
