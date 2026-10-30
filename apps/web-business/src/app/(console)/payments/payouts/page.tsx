import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/page";
import { Chip, List, Note, Row } from "@/components/ui";
import { money } from "@/lib/format";
import { payouts } from "@/lib/mock";
import { paymentTabs } from "../tabs";

export const metadata: Metadata = { title: "Payouts" };

export default function Payouts() {
  return (
    <PageBody>
      <PageHeader title="Payments" sub="Deposits from Stripe to your bank" tabs={paymentTabs} />
      <List>
        {payouts.map((p) => (
          <Row
            key={p.id}
            title={p.date}
            sub="To BBVA ·· 0193"
            right={money(p.amount)}
            rightSub={<Chip tone={p.status === "Paid" ? "success" : "warning"}>{p.status}</Chip>}
          />
        ))}
      </List>
      <Note>Stripe sets the payout schedule. Mesita never holds your money: every payment lands in your own Stripe account.</Note>
    </PageBody>
  );
}
