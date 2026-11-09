import { Flag, MessageSquareHeart } from "lucide-react";
import { SectionCard } from "@/components/admin-ui/manage";
import { PageContainer, PageHeader } from "@/components/PageContainer";
import type { AdminAppFeedback, AdminPlaceReport } from "@/components/reports/types";
import { AppFeedbackRow } from "@/components/reports/AppFeedbackRow";
import { ReportRow } from "@/components/reports/ReportRow";

// Activity › Feedback (Pato, MESITA-3024: "in admin create a Feedback page
// where you receive those logs. It's not interactive. You just receive the
// feedback"). Every guest report from the place screen's three dots, every
// place, newest first, one card of rows. Each row's place opens that place's
// Admin tab to fix it; nothing here resolves, clears or answers a report.
// MESITA-3029: a second card, App feedback, lists what guests send from
// Settings › Send feedback about the app itself, not a place.

export function FeedbackClient({
  reports,
  capped,
  loadError,
  appFeedback,
  appCapped,
  appLoadError,
}: {
  reports: AdminPlaceReport[];
  capped: boolean;
  loadError: string | null;
  appFeedback: AdminAppFeedback[];
  appCapped: boolean;
  appLoadError: string | null;
}) {
  return (
    <PageContainer className="flex flex-col gap-6 sm:gap-8">
      <PageHeader
        title="Feedback"
        description="Every guest report and app feedback, newest first."
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
      <SectionCard
        icon={<MessageSquareHeart className="h-4 w-4" />}
        tint="sky"
        title="App feedback"
        subtitle={
          appFeedback.length > 0
            ? `${appFeedback.length}${appCapped ? "+" : ""} from Settings › Send feedback.`
            : "What guests send about the app from Settings › Send feedback."
        }
      >
        {appLoadError ? (
          <p role="alert" className="text-destructive mt-3 text-sm">
            Couldn&apos;t load app feedback: {appLoadError}
          </p>
        ) : appFeedback.length === 0 ? (
          <p className="text-muted-foreground mt-3 text-sm">No app feedback yet.</p>
        ) : (
          <>
            <ul className="mt-3 flex flex-col">
              {appFeedback.map((f) => (
                <AppFeedbackRow key={f.id} feedback={f} />
              ))}
            </ul>
            {appCapped ? (
              <p className="text-muted-foreground mt-3 text-xs">Showing the latest 500.</p>
            ) : null}
          </>
        )}
      </SectionCard>
    </PageContainer>
  );
}
