import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageBody, PageHeader } from "@/components/page";
import { Card, Chip, Note, Section, Stat, StatGrid } from "@/components/ui";
import { money } from "@/lib/format";
import { rewardCap, rewardRules, stories, visits } from "@/lib/mock";
import { MAX_REWARDS_PER_VISIT } from "@/lib/rewards";
import { rewardTabs } from "./tabs";

export const metadata: Metadata = { title: "Rewards" };

export default function RewardsActivity() {
  const closed = visits.filter((v) => v.status === "approved");
  const rewarded = closed.filter((v) => v.rewards.total > 0);
  const given = rewarded.reduce((s, v) => s + v.rewards.total, 0);
  const onCount = rewardRules.filter((r) => r.enabled).length;

  return (
    <PageBody>
      <PageHeader
        title="Rewards"
        sub={`Up to ${MAX_REWARDS_PER_VISIT} per visit, never more than ${money(rewardCap)} off`}
        status={<Chip tone="success">{onCount} of 5 on</Chip>}
        tabs={rewardTabs}
      />
      <StatGrid>
        <Stat label="Rewards given" value={money(given)} hint="This week" />
        <Stat label="Rewarded visits" value={`${rewarded.length} of ${closed.length}`} />
        <Stat label="Average per visit" value={money(given / Math.max(1, rewarded.length))} />
        <Stat label="Stories posted" value={String(stories.length)} strong hint="Free reach for your place" />
      </StatGrid>

      <Section title="By reward">
        <div className="grid gap-3 sm:grid-cols-2">
          {rewardRules.map((r) => {
            const uses = closed.flatMap((v) => v.rewards.applied.filter((a) => a.id === r.id));
            const cost = uses.reduce((s, a) => s + a.amount, 0);
            return (
              <Link key={r.id} href={`/visits/history?reward=${r.id}`} className="group">
                <Card className="h-full p-4 transition-colors group-hover:border-foreground/30">
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-medium">{r.name}</div>
                    {r.enabled ? (
                      <Chip tone="brand">
                        {r.percent}% {r.mode === "discount" ? "off" : "back"}
                      </Chip>
                    ) : (
                      <Chip>Off</Chip>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{r.requirement}</p>
                  <div className="mt-4 flex items-end justify-between">
                    <div className="text-sm">
                      <span className="tabular font-semibold">{uses.length}</span>{" "}
                      <span className="text-muted-foreground">uses · </span>
                      <span className="tabular font-semibold">{money(cost)}</span>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
        <Note>Discount comes off today&apos;s bill. Cashback becomes Credits the guest spends on a later visit, so it brings them back.</Note>
      </Section>
    </PageBody>
  );
}
