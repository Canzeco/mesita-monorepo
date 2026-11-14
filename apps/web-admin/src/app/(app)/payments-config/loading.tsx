import { PageSkeleton } from "@/components/admin-ui";

// While the page loads: the band and table-shaped bones, so the previous page
// does not stay painted after the rail tap.
export default function PaymentsConfigLoading() {
  return <PageSkeleton variant="table" />;
}
