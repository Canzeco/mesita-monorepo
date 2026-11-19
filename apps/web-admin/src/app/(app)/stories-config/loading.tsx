import { PageSkeleton } from "@/components/admin-ui";

// While the page loads: card-shaped bones, so the previous page does not stay
// painted after the rail tap.
export default function StoriesConfigLoading() {
  return <PageSkeleton variant="cards" />;
}
