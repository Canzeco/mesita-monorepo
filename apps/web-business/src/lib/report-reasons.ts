// The consumer sheet's labels for the place_reports.reason keys
// (apps/web-consumer/src/lib/api/reports.ts). The keys are the table's CHECK;
// supabase/.../_shared/place-reports.test.ts fails when this list drifts.
const REASON_LABEL: Record<string, string> = {
  closed: "Permanently closed",
  wrong_info: "Wrong information",
  wrong_links: "Wrong or broken link",
  wrong_location: "Wrong location",
  inappropriate_photos: "Inappropriate photos",
  duplicate: "Duplicate place",
  other: "Something else",
};

/** The label a guest picked; the raw key for one this console predates. */
export function reportReasonLabel(reason: string): string {
  return REASON_LABEL[reason] ?? reason;
}
