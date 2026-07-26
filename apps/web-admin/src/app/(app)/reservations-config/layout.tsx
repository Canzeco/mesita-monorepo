import { PageContainer } from "@/components/PageContainer";
import { ReservationsLayoutShell } from "./ReservationsLayoutShell";

// Reservations Config — tabbed (Config · Playground). The layout mounts the
// shared shell (header + tab strip); each subpage renders its own content
// beneath it. Tunes the Reservationist voice agent (products.reservations).
export default function ReservationsConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PageContainer>
      <ReservationsLayoutShell>{children}</ReservationsLayoutShell>
    </PageContainer>
  );
}
