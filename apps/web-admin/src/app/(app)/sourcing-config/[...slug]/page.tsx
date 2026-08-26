import { permanentRedirect } from "next/navigation";

export default async function SourcingConfigLegacyRedirect() {
  permanentRedirect("/filters-config");
}
