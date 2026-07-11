import { redirect } from "next/navigation";
import { BUSINESS_ROUTES } from "@/lib/business-route-contract";

export const dynamic = "force-dynamic";

export default async function BusinessHomePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await params;
  redirect(BUSINESS_ROUTES.central);
}
