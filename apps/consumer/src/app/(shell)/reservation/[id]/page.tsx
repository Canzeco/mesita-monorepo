import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { ReservationDetailBody } from "@/components/consumer/ReservationDetailBody";
import { getMockReservationById } from "@/lib/mock/reservations-mock";

export const dynamic = "force-dynamic";

// Hard-nav landing for /reservation/[id] (refresh, direct URL, new tab).
// Soft-nav from inside (shell) — tapping a card on /reservations — hits
// the intercepted variant at (shell)/@modal/(.)reservation/[id]/page.tsx
// which renders inside a modal on top of the underlying surface.
//
// Mocked: ids resolve through getMockReservationById; unknown ids 404.

export default async function ReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const reservation = getMockReservationById(id);
  if (!reservation) notFound();

  return (
    <div className="relative flex h-full flex-col">
      <header className="bg-background/85 z-20 flex shrink-0 items-center gap-2 px-3 py-3 backdrop-blur">
        <Link
          href="/reservations"
          aria-label="Back to reservations"
          className="border-border bg-card text-foreground hover:bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2.25} />
        </Link>
        <p className="font-display flex-1 truncate text-center text-sm font-semibold">
          Reservation
        </p>
        <span className="h-9 w-9 shrink-0" aria-hidden />
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ReservationDetailBody r={reservation} />
      </div>
    </div>
  );
}
