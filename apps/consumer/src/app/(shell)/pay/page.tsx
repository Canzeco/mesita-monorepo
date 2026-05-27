import { redirect } from "next/navigation";

// /pay is gone as a top-level route — the QR + wallet folded into
// /coupons when the BottomNav restructured. Keep this stub so old
// bookmarks and link shares survive the move.
export default function PayRedirect() {
  redirect("/coupons");
}
