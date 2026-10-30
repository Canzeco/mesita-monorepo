import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/page";
import { Avatar, List, Row } from "@/components/ui";
import { money } from "@/lib/format";
import { balances, guestById } from "@/lib/mock";
import { creditTabs } from "../tabs";

export const metadata: Metadata = { title: "Credit balances" };

export default function Balances() {
  const rows = balances();
  return (
    <PageBody>
      <PageHeader title="Credits" sub={`${rows.length} guests hold credit at your place`} tabs={creditTabs} />
      <List>
        {rows.map((r) => {
          const g = guestById(r.guestId);
          const parts = (["Prepayment", "Cashback", "Payment"] as const)
            .filter((k) => r.bySource[k] > 0)
            .map((k) => `${k} ${money(r.bySource[k])}`);
          return (
            <Row
              key={r.guestId}
              leading={<Avatar name={g.name} vip={g.vip} />}
              title={g.name}
              sub={<span className="truncate">{parts.join(" · ")}</span>}
              right={money(r.balance)}
              rightSub="left"
            />
          );
        })}
      </List>
    </PageBody>
  );
}
