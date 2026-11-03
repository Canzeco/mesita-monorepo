import { redirect } from "next/navigation";
import { placeTabHref } from "@/lib/place-tabs";

// Future split into Payments and Rewards, each its own Soon row (MESITA-3136);
// old links land on Payments.
export default async function FuturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(placeTabHref(id, "payments"));
}
