import { redirect } from "next/navigation";

// The "Calculator" tab was renamed "Playground". Kept as a redirect so old
// links/bookmarks keep working.
export default function LegacyEnricherCalculatorRedirect() {
  redirect("/enricher-config/playground");
}
