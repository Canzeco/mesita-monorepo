import { PageContainer, PageHeader } from "@/components/admin-ui";
import { listReservations } from "./actions";
import { ReservationsTable } from "./ReservationsTable";

export const dynamic = "force-dynamic";

export default async function ManageReservationsPage() {
  const res = await listReservations();
  return (
    <PageContainer className="flex flex-col gap-6 sm:gap-8">
      <PageHeader title="Reservations" description="Every reservation ticket, newest first." />
      <ReservationsTable
        reservations={res.ok ? res.reservations : []}
        capped={res.ok ? res.capped : false}
        loadError={res.ok ? null : res.error}
      />
    </PageContainer>
  );
}
