import type { Metadata } from "next";
import { Instagram } from "@/components/icons/Instagram";
import Link from "next/link";

import { PageBody, PageHeader } from "@/components/page";
import { Note } from "@/components/ui";
import { compact } from "@/lib/format";
import { guestById, place, stories } from "@/lib/mock";
import { rewardTabs } from "../tabs";

export const metadata: Metadata = { title: "Stories" };

export default function Stories() {
  const reach = stories.reduce((s, st) => s + (guestById(st.guestId).instagramFollowers ?? 0), 0);
  return (
    <PageBody>
      <PageHeader
        title="Rewards"
        sub={`${stories.length} stories tagging ${place.instagram}, seen by up to ${compact(reach)} followers`}
        tabs={rewardTabs}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {stories.map((st) => {
          const g = guestById(st.guestId);
          return (
            <Link
              key={st.visitId}
              href={`/visits/${st.visitId}`}
              className={`relative flex aspect-[9/16] flex-col justify-between overflow-hidden rounded-xl bg-linear-to-br p-3 text-white ${st.tone}`}
            >
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <Instagram className="size-3.5" aria-hidden />
                {g.handle}
              </div>
              <div>
                <div className="font-display text-lg leading-tight font-semibold">{st.caption}</div>
                <div className="mt-2 text-xs opacity-90">
                  {compact(g.instagramFollowers ?? 0)} followers · {st.day}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      <Note>Every story here earned an Instagram Story Reward. Tap one to see its visit and what it cost.</Note>
    </PageBody>
  );
}
