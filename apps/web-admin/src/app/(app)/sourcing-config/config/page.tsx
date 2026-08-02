import { redirect } from "next/navigation";

// The Config/Playground tabs were retired 2026-08-01 — Sourcing Config is one
// flat page now. Kept as a redirect so old links/bookmarks keep working.
export default function LegacySourcingConfigTabRedirect() {
  redirect("/sourcing-config");
}
