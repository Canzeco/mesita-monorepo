import { listFeedback } from "./actions";
import { FeedbackClient } from "./FeedbackClient";

export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  const res = await listFeedback();
  return (
    <FeedbackClient
      reports={res.ok ? res.reports : []}
      capped={res.ok ? res.capped : false}
      loadError={res.ok ? null : res.error}
    />
  );
}
