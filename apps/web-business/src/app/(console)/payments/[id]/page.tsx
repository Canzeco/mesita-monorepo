import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageBody, PageHeader } from "@/components/page";
import { Card, Chip, Line, Note } from "@/components/ui";
import { money } from "@/lib/format";
import { MESITA_FEE_RATE, guestById, paymentById, payments } from "@/lib/mock";
import { creditsForPrepayment } from "@/lib/rewards";

export const metadata: Metadata = { title: "Payment" };

export function generateStaticParams() {
  return payments.map((p) => ({ id: p.id }));
}

export default async function PaymentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = paymentById(id);
  if (!p) notFound();
  const g = guestById(p.guestId);
  const fee = p.amount * MESITA_FEE_RATE;

  return (
    <PageBody>
      <PageHeader
        back={{ href: "/payments", label: "Payments" }}
        title={money(p.amount)}
        status={<Chip tone={p.kind === "Prepayment" ? "brand" : "neutral"}>{p.kind}</Chip>}
        sub={`${g.name} · ${p.day} · ${p.time}`}
      />
      <Card className="max-w-xl p-4">
        <Line label="Amount" value={money(p.amount)} />
        {p.tip ? <Line label="Tip (yours, before rewards)" value={money(p.tip)} muted /> : null}
        <Line label="Card" value={p.card} muted />
        <Line label="Mesita fee" value={`−${money(fee)}`} muted />
        <Line label="Stripe fee" value="See Stripe" muted />
        <Line label="Status" value={<Chip tone="success">{p.status}</Chip>} strong />
        {p.kind === "Prepayment" ? (
          <p className="mt-3 rounded-lg bg-brand-soft p-3 text-sm">
            {g.name} now has {money(creditsForPrepayment(p.amount))} in Credits at your place: what they paid plus the 10% bonus.{" "}
            <Link href="/credits" className="font-medium underline">See Credits</Link>
          </p>
        ) : p.visitId ? (
          <p className="mt-3 text-sm">
            <Link href={`/visits/${p.visitId}`} className="font-medium underline">Open the visit</Link> to see the bill and its rewards.
          </p>
        ) : null}
      </Card>
      <Note>Refunds and disputes are handled in Stripe for now: Payments › Open Stripe.</Note>
    </PageBody>
  );
}
