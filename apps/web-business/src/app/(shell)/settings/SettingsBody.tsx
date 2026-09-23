"use client";

// Settings' live box — WHO MAY OPEN THIS PLACE (MESITA-1892).
//
// It is a client shim for the same reason `ProductLadderTab` is: `TeamSection`
// takes the `AdminPlace` that `usePlaceContext` holds, the place layout has
// already resolved it, and a page under `places/[id]` reads nothing of its own
// (MESITA-1875). A few lines, so the page above stays a server component.
//
// ONE MEMBERS SURFACE, AND THIS IS IT. The organization had its own — a
// `MembersCard` over `business-web-{list,add,remove,update}-org-member` — and
// every one of those endpoints was the twin of a place endpoint that already
// existed (`business-web-list-members` and its three siblings), which is why
// the layer's removal deletes the card rather than repointing it. Two
// components rendering one list is how a console starts disagreeing with
// itself.
//
// IT LEFT VISITS TO COME HERE. MESITA-1885 put `TeamSection` in the internal
// box on Visits — "`VisitsCard` is how visits are run here, and `TeamSection`
// is who runs them" — and said in the same breath that the box "had to pick
// one rather than be split or repeated", because there was no place-level
// Settings page to put it on. There is one now, and it is the page the word
// covers: who may touch this, and how an agent drives it.
//
// THE BOX IS TITLED FOR THE QUESTION, not for the list. `TeamSection` draws
// its own "Team · N members · Manage" disclosure, so a box called Team would
// print the word twice at two ranks.
import { TeamSection } from "@/components/place-manage/sections/TeamSection";
import { usePlaceContext } from "@/components/place-manage/PlaceContext";
import { Section } from "@/components/shared/Section";
import { DevelopersSection } from "./DevelopersSection";

export function SettingsBody() {
  const { place } = usePlaceContext();
  return (
    <>
      <Section
        lane
        title="Access"
        description="Owners, editors and viewers of this place. An owner can add and remove the rest."
      >
        <TeamSection place={place} />
      </Section>
      <DevelopersSection />
    </>
  );
}
