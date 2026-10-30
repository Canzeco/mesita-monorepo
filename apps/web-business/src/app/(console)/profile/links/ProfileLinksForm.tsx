"use client";

import { useState } from "react";
import { Field, SaveBar, inputClass, useMockSave } from "@/components/controls";
import { Card } from "@/components/ui";
import { place } from "@/lib/mock";

export function ProfileLinksForm() {
  const s = useMockSave();
  const [v, setV] = useState({
    instagram: "",
    review: "",
    website: "",
    menu: "",
  });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setV((x) => ({ ...x, [k]: e.target.value }));
    s.touch();
  };
  return (
    <>
      <Card className="grid gap-4 p-4">
        <Field label="Instagram account" hint="Needed for the Instagram Story Reward: guests tag this account.">
          <input className={inputClass} placeholder={place.instagram} value={v.instagram} onChange={set("instagram")} />
        </Field>
        <Field label="Google review link" hint="Needed for the Google Review Reward: guests leave the review here.">
          <input className={inputClass} placeholder={place.googleReviewLink} value={v.review} onChange={set("review")} />
        </Field>
        <Field label="Website">
          <input className={inputClass} placeholder={place.website} value={v.website} onChange={set("website")} />
        </Field>
        <Field label="Menu link">
          <input className={inputClass} placeholder="https://" value={v.menu} onChange={set("menu")} />
        </Field>
      </Card>
      <SaveBar dirty={s.dirty} saved={s.saved} onSave={s.save} />
    </>
  );
}
