import { permanentRedirect } from "next/navigation";

// Retired Sourcing Config subpaths (Config/Playground tabs → one flat page).
// Required `[...slug]` so the live root `page.tsx` stays authoritative.
export default async function SourcingConfigLegacyRedirect() {
  permanentRedirect("/sourcing-config");
}
