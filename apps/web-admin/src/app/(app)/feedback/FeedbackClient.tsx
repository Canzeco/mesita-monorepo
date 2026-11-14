import { SECTION_CARD_CLASS } from "@/components/admin-ui/manage";
import { PageContainer, PageHeader } from "@/components/PageContainer";
import type { AdminAppFeedback, AdminPlaceReport } from "@/components/reports/types";
import { AppFeedbackRow } from "@/components/reports/AppFeedbackRow";
import { ReportRow } from "@/components/reports/ReportRow";

// Activity › Feedback (Pato, MESITA-3024: "in admin create a Feedback page
// where you receive those logs. It's not interactive. You just receive the
// feedback"). One list since MESITA-3851 (Pato: "only feedback logs in
// general. don't separate into categories"): a guest's report from a place's
// three dots and their app feedback from Settings › Send feedback, merged
// newest first. A report's row still names its place; nothing here resolves,
// clears or answers anything.

type Item =
  | { kind: "report"; at: string; report: AdminPlaceReport }
  | { kind: "app"; at: string; feedback: AdminAppFeedback };

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
  const items: Item[] = [
    ...reports.map((r): Item => ({ kind: "report", at: r.created_at, report: r })),
    ...appFeedback.map((f): Item => ({ kind: "app", at: f.created_at, feedback: f })),
  ].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  const errors = [loadError, appLoadError].filter((e): e is string => e !== null);

  return (
    <PageContainer className="flex flex-col gap-6 sm:gap-8">
      <PageHeader title="Feedback" description="Everything guests send, newest first." />
      <section className={SECTION_CARD_CLASS}>
        {errors.map((e) => (
          <p key={e} role="alert" className="text-destructive mb-3 text-sm">
            Couldn&apos;t load feedback: {e}
          </p>
        ))}
        {items.length === 0 ? (
          errors.length === 0 ? (
            <p className="text-muted-foreground text-sm">No feedback yet.</p>
          ) : null
        ) : (
          <ul className="flex flex-col">
            {items.map((item) =>
              item.kind === "report" ? (
                <ReportRow key={`r-${item.report.id}`} report={item.report} showPlace />
              ) : (
                <AppFeedbackRow key={`a-${item.feedback.id}`} feedback={item.feedback} />
              ),
            )}
          </ul>
        )}
        {capped || appCapped ? (
          <p className="text-muted-foreground mt-3 text-xs">Showing the latest 500 of each kind.</p>
        ) : null}
      </section>
    </PageContainer>
  );
}
