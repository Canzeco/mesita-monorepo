import { ActivityPage } from "@/components/consumer/activity/ActivityPage";

// /activity — the bar's Activity tab (MESITA-3631): five chips (MESITA-3697),
// Favorites · Reservations · Visits · Vouchers · Gifts. The chip is in
// `?type=`; a bare /activity is Favorites.
export default function Page() {
  return <ActivityPage />;
}
