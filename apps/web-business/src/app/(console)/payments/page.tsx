import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { PageBody, PageHeader } from "@/components/page";
import { Avatar, Chip, List, Note, Row, Section, Stat, StatGrid, buttonClass } from "@/components/ui";
import { money } from "@/lib/format";
import { MESITA_FEE_RATE, guestById, payments } from "@/lib/mock";
import { paymentTabs } from "./tabs";

export const metadata: Metadata = { title: "Payments" };

export default function PaymentsActivity() {
  const paid = payments.filter((p) => p.status === "Paid");
  const volume = paid.reduce((s, p) => s + p.amount, 0);
  const tips = paid.reduce((s, p) => s + p.tip, 0);
  const prepaid = paid.filter((p) => p.kind === "Prepayment").reduce((s, p) => s + p.amount, 0);
  const fees = volume * MESITA_FEE_RATE;

  return (
    <PageBody>
      <PageHeader
        title="Payments"
        sub="Mesita Pay: guests pay from their phone, straight into your Stripe account"
        status={<Chip tone="success">Stripe connected</Chip>}
        actions={
          <button type="button" className={buttonClass("outline")} disabled title="Opens your Stripe Express dashboard">
            Open Stripe
            <ExternalLink className="size-4" aria-hidden />
          </button>
        }
        tabs={paymentTabs}
      />
      <StatGrid>
        <Stat label="Received" value={money(volume)} hint="This week" strong />
        <Stat label="From prepayments" value={money(prepaid)} hint="Also owed as Credits" />
        <Stat label="Tips" value={money(tips)} />
        <Stat label="Mesita fees" value={money(fees)} hint="Illustrative rate" />
      </StatGrid>

      <Section title="Transactions">
        <List>
          {payments.map((p) => {
            const g = guestById(p.guestId);
            return (
              <Row
                key={p.id}
                href={`/payments/${p.id}`}
                leading={<Avatar name={g.name} vip={g.vip} />}
                title={g.name}
                sub={
                  <>
                    <Chip tone={p.kind === "Prepayment" ? "brand" : "neutral"}>{p.kind}</Chip>
                    <span className="truncate">{`${p.day} · ${p.time} · ${p.card}`}</span>
                  </>
                }
                right={money(p.amount)}
                rightSub={p.tip ? `incl. ${money(p.tip)} tip` : undefined}
              />
            );
          })}
        </List>
        <Note>A prepayment shows here as money received, and in Credits as visits you now owe.</Note>
      </Section>
    </PageBody>
  );
}
