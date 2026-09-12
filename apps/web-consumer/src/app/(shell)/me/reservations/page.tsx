import { BookingsModal } from "@/components/consumer/me/ActivityModals";

// /me/reservations — upcoming then past. Was a LocalSheet (MESITA-1789).
export const dynamic = "force-dynamic";

export default function Page() {
  return <BookingsModal />;
}
