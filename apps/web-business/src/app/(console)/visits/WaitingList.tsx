"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, X } from "lucide-react";
import { GuestChips, RewardChips } from "@/components/visits";
import { Avatar, Card, Chip, buttonClass } from "@/components/ui";
import { money } from "@/lib/format";
import { guestById, type Visit } from "@/lib/mock";

/** Visits a guest opened that staff have not approved yet. Approving here changes only this screen. */
export function WaitingList({ visits }: { visits: Visit[] }) {
  const [decided, setDecided] = useState<Record<string, "approved" | "rejected">>({});
  return (
    <div className="grid gap-3">
      {visits.map((v) => {
        const g = guestById(v.guestId);
        const decision = decided[v.id];
        return (
          <Card key={v.id} className="border-warning/40 p-4">
            <div className="flex items-start gap-3">
              <Avatar name={g.name} vip={g.vip} />
              <div className="min-w-0 flex-1">
                <Link href={`/visits/${v.id}`} className="font-medium hover:underline">
                  {g.name}
                </Link>
                <div className="mt-1">
                  <GuestChips guestId={v.guestId} />
                </div>
              </div>
              <div className="text-right">
                <div className="tabular text-lg font-semibold">{money(v.bill)}</div>
                <div className="text-xs text-muted-foreground">{v.time}</div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
              <RewardChips visit={v} />
              <span className="tabular font-medium">
                {v.rewards.discount > 0 ? `−${money(v.rewards.discount)} today` : null}
                {v.rewards.discount > 0 && v.rewards.cashback > 0 ? " · " : null}
                {v.rewards.cashback > 0 ? `+${money(v.rewards.cashback)} credit` : null}
              </span>
            </div>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-muted-foreground">Pays with {v.paidWith}</span>
              {decision ? (
                <Chip tone={decision === "approved" ? "success" : "danger"}>
                  {decision === "approved" ? "Approved" : "Rejected"}
                </Chip>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <button
                    type="button"
                    className={buttonClass("danger")}
                    onClick={() => setDecided((d) => ({ ...d, [v.id]: "rejected" }))}
                  >
                    <X className="size-4" aria-hidden />
                    Reject
                  </button>
                  <button
                    type="button"
                    className={buttonClass("primary")}
                    onClick={() => setDecided((d) => ({ ...d, [v.id]: "approved" }))}
                  >
                    <Check className="size-4" aria-hidden />
                    Approve
                  </button>
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
