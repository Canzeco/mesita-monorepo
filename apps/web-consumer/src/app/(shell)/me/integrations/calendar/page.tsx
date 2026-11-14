import { CalendarModal } from "@/components/consumer/me/CalendarModal";

// /me/integrations/calendar — the reservations feed for Google, Apple and
// Outlook (MESITA-3954). Reservations' header icon opens it too.
export const dynamic = "force-dynamic";

export default function Page() {
  return <CalendarModal />;
}
