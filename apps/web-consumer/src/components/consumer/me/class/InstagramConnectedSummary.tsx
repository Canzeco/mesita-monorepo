import { BadgeCheck, Instagram } from "lucide-react";

import { type ClassKey, classProperLabel } from "@/lib/consumer-data";

// NO COLOUR BUT THE CLASS (decision: Pato, MESITA-1124). This panel used to
// wear an emerald success frame and the Instagram brand gradient — two accents
// competing with the one metal on the sheet. Neutral now: the words carry the
// state.
//
// The rung is READ, not assumed. This box renders on any connected handle, not
// only on a reach grant, so the hardcoded "Silver active" it used to print was
// wrong at both ends of the ladder: it demoted an invited Diamond and it
// promised Silver to an account that never cleared the bar. Whatever class the
// consumer actually holds is the only honest thing to name here.

export function InstagramConnectedSummary({
  followers,
  classKey,
}: {
  followers: number;
  classKey: ClassKey;
}) {
  const classLabel = classProperLabel(classKey);

  return (
    <div className="border-border bg-card flex items-center gap-3.5 rounded-2xl border p-4">
      <span className="bg-muted text-foreground flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">
        <Instagram className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-display text-[14px] leading-none font-bold tracking-tight">
            Profile connected
          </span>
          <BadgeCheck className="text-muted-foreground h-4 w-4 shrink-0" />
        </div>
        <p className="text-muted-foreground mt-1 text-[12px] leading-snug">
          {followers > 0
            ? `${followers.toLocaleString("en-US")} followers · ${classLabel} active`
            : `${classLabel} active`}
        </p>
        {/* Class from reach; Story Bonus from the connected handle
            (MESITA-909) — lead with the visit upside. */}
        <p className="text-muted-foreground/80 mt-0.5 text-[11px] leading-snug">
          Story Bonus unlocked — post a tagged story any visit for more off.
        </p>
      </div>
    </div>
  );
}
