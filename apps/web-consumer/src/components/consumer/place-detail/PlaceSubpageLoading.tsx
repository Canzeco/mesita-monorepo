"use client";

import { useRouter } from "next/navigation";
import { ScreenHeader } from "@/components/consumer/nav/Screen";
import { goBack } from "@/lib/navigate";

/** The grey frame a place subpage paints while its place read is out
 *  (MESITA-4111). Back works during the wait, and goes where every Back
 *  goes (goBack, MESITA-4601): the screen under this one, or the place. */
export function PlaceSubpageLoading({ title }: { title: string }) {
  const router = useRouter();
  return (
    <div
      className="bg-background flex flex-1 flex-col overflow-hidden"
      aria-busy
    >
      <ScreenHeader title={title} onBack={() => goBack(router)} />
      <div className="px-4 pt-3">
        <div className="bg-muted mx-auto h-3 w-32 rounded-full" />
      </div>
      <div className="flex flex-1 flex-col gap-3 px-4 pt-4">
        <div className="bg-card border-border h-14 w-full rounded-2xl border" />
        <div className="bg-card border-border h-14 w-full rounded-2xl border" />
        <div className="bg-card border-border h-14 w-full rounded-2xl border" />
      </div>
    </div>
  );
}
