"use client";

// Settings — TWO boxes, and only two: Team and Developers.
//
// MEMBERS IS CONTENT, NOT A PAGE. The people used to hang off a layer above the
// place and had an address of their own; nesting them was the complaint that
// deleted that layer. They are a box on this page now.
//
// ONE OWNER/EDITOR/VIEWER SURFACE. There is exactly one place in this console
// where a role is granted, and this is it — two surfaces granting the same
// thing is how one of them ends up granting a role the other cannot revoke.
import { X } from "lucide-react";
import { NotHeld, useHeldPlaceOrNull } from "@/components/console/PlaceScope";
import { PlaceHeading } from "@/components/console/PlaceHeading";
import { Section } from "@/components/shared/Section";
import { Badge } from "@/components/shared/Badges";
import { EmptyState } from "@/components/shared/EmptyState";
import { MEMBERS } from "@/mock/fixtures";
import { listFor } from "@/mock/scenario";
import { useMock } from "@/mock/MockStore";
import {
  GHOST_PILL_BUTTON_CLASS,
  ICON_BUTTON_CLASS,
  INFO_BOX_CLASS,
  PILL_BUTTON_CLASS,
  TINY_LABEL_CLASS,
} from "@/lib/ui-classes";

export default function PlaceSettingsPage() {
  const place = useHeldPlaceOrNull();
  const { scenario } = useMock();
  // THE GATE THESE PAGES WERE MISSING. They are static segments beside
  // `[view]`, so no tab gate ever runs for them: a pool id typed into the bar,
  // or the scenario flipped to a failed read while one of them was open, used
  // to reach the body with no place at all. It sits after the hooks and before
  // the first `place.` — a guard below a dereference is not a guard.
  if (!place) return <NotHeld />;

  const members = listFor(MEMBERS.filter((m) => m.placeId === place.id), scenario);
  const canManage = place.myRole === "owner";

  return (
    <>
      <PlaceHeading place={place} view="Settings" />

      <Section
        title="Team"
        description="Who can see and change this place. An owner can do everything, an editor everything but the team, a viewer nothing but look."
        right={canManage && <button type="button" className={PILL_BUTTON_CLASS}>Invite</button>}
        lane
      >
        {members.length === 0 ? (
          <EmptyState title="Nobody here" hint="Not even you, which should be impossible." />
        ) : (
          <ul className="flex flex-col gap-3">
            {members.map((m) => (
              <li key={m.id} className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden
                  className="bg-muted text-muted-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold"
                >
                  {m.name.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{m.name}</p>
                  <p className="text-muted-foreground truncate text-[11px]">{m.email}</p>
                </div>
                <Badge tone={m.role === "owner" ? "gold" : "neutral"}>{m.role}</Badge>
                {m.state === "invited" && <Badge tone="warn">invited</Badge>}
                {canManage && m.name !== "You" && (
                  <button type="button" aria-label={`Remove ${m.name}`} title={`Remove ${m.name}`} className={ICON_BUTTON_CLASS}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {!canManage && (
          <p className={INFO_BOX_CLASS}>
            Only an owner can change the team. You hold this place as {place.myRole}.
          </p>
        )}
      </Section>

      <Section
        title="Developers"
        description="Keys for reading this place's own data. They are scoped to this place and to nothing else."
        right={canManage && <button type="button" className={GHOST_PILL_BUTTON_CLASS}>New key</button>}
        lane
      >
        <div className="border-border rounded-xl border px-3 py-2.5">
          <p className={TINY_LABEL_CLASS}>Place id</p>
          <p className="font-mono text-[12px] break-all">{place.id}</p>
        </div>
        <p className={INFO_BOX_CLASS}>
          No keys have been minted for this place. A key is shown once, when it
          is created, and never again — there is nowhere to go and look one up.
        </p>
      </Section>
    </>
  );
}
