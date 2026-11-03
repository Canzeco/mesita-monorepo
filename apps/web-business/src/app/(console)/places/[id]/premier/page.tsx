import { getPremier } from "@/lib/business-api";
import { PremierPanel } from "./PremierPanel";
import { getManagePlace } from "@/lib/place-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Premier" };

// Premier (MESITA-3103): the place's paid visibility, run by the place. The
// read is business-web-get-premier; with `?boost=<session>` (Stripe Checkout's
// return, from buying or from Update card) it first settles the caller's own
// payment. Billing (plan, card, charges) is its own page (MESITA-3160), and
// since MESITA-3173 it also sells the plans that include Premier.
export default async function PremierPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ boost?: string }>;
}) {
  const { id } = await params;
  const { boost } = await searchParams;
  const [res, manage] = await Promise.all([getPremier(id, boost ?? null), getManagePlace(id)]);
  return (
    <div className="flex flex-col gap-4">
      {manage?.role === "editor" ? (
        <p className="border-border bg-muted/50 rounded-xl border px-4 py-3 text-sm">
          You are an editor here. Only the place&apos;s owner can buy, change or stop its plan.
        </p>
      ) : null}
      <PremierPanel placeId={id} initial={res.ok ? res.data : null} loadError={res.ok ? null : res.error} />
    </div>
  );
}
