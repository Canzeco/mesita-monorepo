import { permanentRedirect } from "next/navigation";

// /adea-config → /enricher-config (route renamed when Atlas/Enricher split).
// Catch-all shim: bookmarks and old Notion Configs registry links keep working.
// /calculator used to keep its own anchor; the calculator box went with the
// Intake knobs (enricher-config/page.tsx), so everything lands on the page.
export default async function AdeaConfigLegacyRedirect() {
  permanentRedirect("/enricher-config");
}
