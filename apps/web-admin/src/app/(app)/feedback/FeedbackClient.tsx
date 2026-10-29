import { Flag } from "lucide-react";
import { SectionCard } from "@/components/admin-ui/manage";
import { PageContainer, PageHeader } from "@/components/PageContainer";
import type { AdminPlaceReport } from "@/components/place-manage/actions";
import { ReportRow } from "@/components/reports/ReportRow";

// Activity › Feedback (Pato, MESITA-3024: "in admin create a Feedback page
// where you receive those logs. It's not interactive. You just receive the
// feedback"). Every guest report from the place screen's three dots, every
// place, newest first, one card of rows. Each row's place opens that place's
// Admin tab to fix it; nothing here resolves, clears or answers a report.

export function FeedbackClient({
  reports,
  capped,
  loadError,
}: {
  reports: AdminPlaceReport[];
  capped: boolean;
  loadError: string | null;
}) {
  return (
    <PageContainer size="3xl" className="flex flex-col gap-6 sm:gap-8">
      <PageHeader
        eyebrow="Activity · Feedback"
        title="Feedback"
        description="Every guest report, newest first."
      />
      <SectionCard
        icon={<Flag className="h-4 w-4" />}
        tint="rose"
        title="Guest reports"
        subtitle={
          reports.length > 0
            ? `${reports.length}${capped ? "+" : ""} from the three dots on a place.`
            : "What guests send from the three dots on a place."
        }
      >
        {loadError ? (
          <p role="alert" className="text-destructive mt-3 text-sm">
            Couldn&apos;t load feedback: {loadError}
          </p>
        ) : reports.length === 0 ? (
          <p className="text-muted-foreground mt-3 text-sm">No guest feedback yet.</p>
        ) : (
          <>
            <ul className="mt-3 flex flex-col">
              {reports.map((r) => (
                <ReportRow key={r.id} report={r} showPlace />
              ))}
            </ul>
            {capped ? (
              <p className="text-muted-foreground mt-3 text-xs">Showing the latest 500.</p>
            ) : null}
          </>
        )}
      </SectionCard>
    </PageContainer>
  );
}
