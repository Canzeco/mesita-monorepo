import { redirect } from "next/navigation";

// Vouchers are Credits rows since MESITA-4554 (Pato: "dont add the section
// vouchers but credits … include vouchers and gifts and visits"). A voucher
// link keeps its id: Credits shows that voucher's credit rows.
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const k of ["id", "customer"]) {
    const v = sp[k];
    const one = Array.isArray(v) ? v[0] : v;
    if (one) q.set(k, one);
  }
  const query = q.toString();
  redirect(`/places/${encodeURIComponent(id)}/credits${query ? `?${query}` : ""}`);
}
