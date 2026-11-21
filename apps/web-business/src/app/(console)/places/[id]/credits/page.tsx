import { redirect } from "next/navigation";

// No Credits page since MESITA-4555 (Pato: "you don't need credits"): its
// rows are Vouchers, Gifts and Payments. This old address lands on Vouchers.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/places/${encodeURIComponent(id)}/vouchers`);
}
