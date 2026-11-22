import { redirect } from "next/navigation";
import { placePath } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

// A VOUCHER'S OLD TICKET (MESITA-4630) IS THE SHOP NOW (MESITA-4647, Pato:
// "don't create a special subpage"): an old link opens Offers with that
// voucher picked, keeping `from` and `rewards`. Offers picks it only when
// the guest can buy it.
export default async function PlaceOfferTicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; voucher: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id, voucher } = await params;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) {
    if ((k === "from" || k === "rewards") && typeof v === "string") q.set(k, v);
  }
  q.set("pick", decodeURIComponent(voucher));
  redirect(`${placePath(id)}/offers?${q.toString()}`);
}
