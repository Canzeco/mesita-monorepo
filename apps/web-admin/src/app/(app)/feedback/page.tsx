import { PageContainer, PageHeader } from "@/components/admin-ui";
import { listAppFeedback, listFeedback } from "./actions";
import { FeedbackClient } from "./FeedbackClient";

export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  const [res, app] = await Promise.all([listFeedback(), listAppFeedback()]);
  return (
    <PageContainer className="flex flex-col gap-6 sm:gap-8">
      <PageHeader title="Feedback" description="Everything guests send, newest first." />
      <FeedbackClient
        reports={res.ok ? res.reports : []}
        capped={res.ok ? res.capped : false}
        loadError={res.ok ? null : res.error}
        appFeedback={app.ok ? app.feedback : []}
        appCapped={app.ok ? app.capped : false}
        appLoadError={app.ok ? null : app.error}
      />
    </PageContainer>
  );
}
