"use client";

// Adding a second organization is the rarest thing anyone does on this
// screen, and it was ending the page with the loudest button on it. It is
// a link until you want it, then it is a form.

import { useState } from "react";
import { Section } from "@/components/shared/Section";
import { CreateOrganizationForm } from "@/components/console/CreateOrganizationForm";
import { GHOST_PILL_BUTTON_CLASS } from "@/lib/ui-classes";

export function AddOrganizationDisclosure() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-foreground self-start text-[13px] underline underline-offset-4 transition"
      >
        Add another organization
      </button>
    );
  }

  return (
    <Section
      title="Add another organization"
      description="A separate legal person, with its own places and its own payouts."
      right={
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={GHOST_PILL_BUTTON_CLASS}
        >
          Cancel
        </button>
      }
    >
      <CreateOrganizationForm variant="inline" />
    </Section>
  );
}
