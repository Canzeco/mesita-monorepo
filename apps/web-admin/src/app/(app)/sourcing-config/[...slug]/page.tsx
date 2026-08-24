import { permanentRedirect } from "next/navigation";

// Every retired Sourcing subpath lands on Intake, which is where the channel
// matrix lives now.
export default async function SourcingConfigLegacyRedirect() {
  permanentRedirect("/enricher-config");
}
