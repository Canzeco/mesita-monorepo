import { redirect } from "next/navigation";

// Reservations Config parent route → default to the Config tab. Subpages:
// config, playground.
export default function ReservationsConfigIndex() {
  redirect("/reservations-config/config");
}
