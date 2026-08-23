import { BadgeCheck, Instagram, Ticket } from "lucide-react";

import { type ClassKey, classProperLabel } from "@/lib/consumer-data";
import { cn } from "@/lib/utils";

// WHICH DOOR YOU CAME THROUGH (MESITA-1159). There are two — reach, which
// lifts you automatically, and an invitation, which is granted by hand — and
// this box names the one that granted YOUR rung.
//
// It used to be Instagram-only, rendered behind `origin === "instagram"`, so
// an invited guest saw nothing at all: the sheet showed them a Diamond row
// wearing a follower bar they had never cleared and no explanation of how
// they got there. One component covers both doors so the two states cannot
// drift apart, which is the same reason fill and ink travel together on the
// class badge (MESITA-1142).
//
// The rung is READ, not assumed. This box renders on any granted origin, not
// only on a reach grant, so the hardcoded "Silver active" it once printed was
// wrong at both ends of the ladder (MESITA-1141).
//
// NO COLOUR BUT THE CLASS (decision: Pato, MESITA-1124). This panel used to
// wear an emerald success frame and the Instagram brand gradient — two accents
// competing with the one metal on the sheet. Neutral: the words carry it.

export function ClassOriginSummary({
  origin,
  classKey,
  followers,
  handle,
}: {
  origin: "default" | "instagram" | "invitation";
  classKey: ClassKey;
  followers: number;
  handle: string | null;
}) {
  if (origin === "default") return null;

  const classLabel = classProperLabel(classKey);
  const invited = origin === "invitation";

  const Icon = invited ? Ticket : Instagram;
  const title = invited ? "Direct invitation" : "Instagram connected";

  // The line that says WHAT the door gave you. Reach can quote the follower
  // count that cleared the bar; an invitation has no number to quote, because
  // it names a class outright rather than measuring anything.
  const detail = invited
    ? `${classLabel} active`
    : [
        handle ? `@${handle}` : null,
        followers > 0 ? `${followers.toLocaleString("en-US")} followers` : null,
        `${classLabel} active`,
      ]
        .filter(Boolean)
        .join(" · ");

  // Story Bonus rides a connected HANDLE (MESITA-909), not a class and not an
  // invitation — so an invited guest is told the truth about the door they
  // used, and is not promised a bonus their account has not unlocked.
  const note = invited
    ? "Granted by hand — invitations name a class outright."
    : "Story Bonus unlocked — post a tagged story any visit for more off.";

  return (
    <div className="border-border bg-card flex items-center gap-3.5 rounded-2xl border p-4">
      <span
        className={cn(
          "bg-muted text-foreground flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-display text-sm leading-none font-bold tracking-tight">
            {title}
          </span>
          <BadgeCheck className="text-muted-foreground h-4 w-4 shrink-0" />
        </div>
        <p className="text-muted-foreground mt-1 text-xs leading-snug">
          {detail}
        </p>
        {/* Full muted ink, not /80: at 11px this is the smallest text on the
            sheet and the fade put it at 3.13:1. It carries product fact (the
            Story Bonus, how the invitation works), not decoration. */}
        <p className="text-muted-foreground type-label mt-0.5 leading-snug">
          {note}
        </p>
      </div>
    </div>
  );
}
