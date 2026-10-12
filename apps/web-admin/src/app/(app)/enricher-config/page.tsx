import { CrenupPage } from "./crenup-page";

export const dynamic = "force-dynamic";

// Intake (MESITA-2159): Creation and Enrichment are one page again, at the
// bare frozen prefix. /creation, /enrichment and every older subpath 308 here.
export default function Page() {
  return <CrenupPage />;
}
