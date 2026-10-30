"use client";

import { useState } from "react";
import { SaveBar, useMockSave } from "@/components/controls";
import { Card, Chip, Note } from "@/components/ui";
import { cn } from "@/lib/utils";

const options = [
  { value: "never", label: "Never expires" },
  { value: "24", label: "24 months" },
  { value: "12", label: "12 months" },
] as const;

export function CreditSettingsForm() {
  const s = useMockSave();
  const [expiry, setExpiry] = useState<(typeof options)[number]["value"]>("never");
  return (
    <>
      <Card className="p-4">
        <div className="flex items-center gap-2 font-medium">
          Expiration <Chip tone="warning">Rule not decided</Chip>
        </div>
        <div className="mt-3 grid gap-2" role="radiogroup" aria-label="Expiration">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={expiry === o.value}
              onClick={() => {
                setExpiry(o.value);
                s.touch();
              }}
              className={cn(
                "flex items-center gap-3 rounded-lg border p-3 text-left text-sm",
                expiry === o.value ? "border-primary bg-brand-soft" : "border-border",
              )}
            >
              <span
                className={cn(
                  "size-4 rounded-full border-2",
                  expiry === o.value ? "border-primary bg-primary shadow-[inset_0_0_0_2px_white]" : "border-border",
                )}
                aria-hidden
              />
              {o.label}
            </button>
          ))}
        </div>
      </Card>
      <Note>Applies to cashback credit only. Whether prepaid credit can expire depends on Mexico&apos;s consumer rules (PROFECO); to be confirmed before launch.</Note>
      <SaveBar dirty={s.dirty} saved={s.saved} onSave={s.save} />
    </>
  );
}
