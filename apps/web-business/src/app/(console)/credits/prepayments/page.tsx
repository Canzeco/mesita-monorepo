import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/page";
import { Avatar, Chip, List, Row, Section } from "@/components/ui";
import { money } from "@/lib/format";
import { guestById, payments } from "@/lib/mock";
import { creditsForPrepayment } from "@/lib/rewards";
import { creditTabs } from "../tabs";
import { PrepaymentForm } from "./PrepaymentForm";

export const metadata: Metadata = { title: "Prepayments" };

export default function Prepayments() {
  const sales = payments.filter((p) => p.kind === "Prepayment");
  return (
    <PageBody>
      <PageHeader
        title="Credits"
        sub="Guests pay today and get 10% more to spend later"
        status={<Chip tone="success">Selling</Chip>}
        tabs={creditTabs}
      />
      <PrepaymentForm />
      <Section title="Sales">
        <List>
          {sales.map((p) => {
            const g = guestById(p.guestId);
            return (
              <Row
                key={p.id}
                href={`/payments/${p.id}`}
                leading={<Avatar name={g.name} vip={g.vip} />}
                title={g.name}
                sub={`${p.day} · paid ${money(p.amount)}`}
                right={`+${money(creditsForPrepayment(p.amount))}`}
                rightSub="credit"
              />
            );
          })}
        </List>
      </Section>
    </PageBody>
  );
}
