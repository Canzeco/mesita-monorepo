import { redirect } from "next/navigation";
import { BUSINESS_ROUTES } from "@/lib/business-route-contract";

export default async function LegacyUnitSettingsRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await params;
  redirect(BUSINESS_ROUTES.settings);
}
