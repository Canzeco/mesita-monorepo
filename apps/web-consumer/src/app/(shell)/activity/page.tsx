import { ActivityPage } from "@/components/consumer/activity/ActivityPage";

// /activity — a page under Me, off the bar (MESITA-3717): six chips (MESITA-3697,
// MESITA-3716), Reservations · Visits · Vouchers · Gifts · Notifications
// (Favorites left in MESITA-3723). The chip is in `?type=`; a bare
// /activity is Reservations.
export default function Page() {
  return <ActivityPage />;
}
