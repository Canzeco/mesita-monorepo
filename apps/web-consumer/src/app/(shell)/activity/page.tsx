import { ActivityPage } from "@/components/consumer/activity/ActivityPage";

// /activity — the bar's Activity tab (MESITA-3631): six chips (MESITA-3697,
// MESITA-3716), Favorites · Reservations · Visits · Vouchers · Gifts ·
// Notifications. The chip is in `?type=`; a bare /activity is Favorites.
export default function Page() {
  return <ActivityPage />;
}
