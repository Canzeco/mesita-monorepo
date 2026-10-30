"use client";

import { useState } from "react";
import { Field, SaveBar, inputClass, useMockSave } from "@/components/controls";
import { Card, Section } from "@/components/ui";
import { place } from "@/lib/mock";

export function ProfileInfoForm() {
  const s = useMockSave();
  const [name, setName] = useState(place.name);
  const [description, setDescription] = useState(place.description);
  const [phone, setPhone] = useState(place.phone);
  const [hours, setHours] = useState<{ day: string; hours: string }[]>(place.hours.map(([d, h]) => ({ day: d, hours: h })));

  return (
    <>
      <Card className="grid gap-4 p-4">
        <Field label="Name">
          <input className={inputClass} value={name} onChange={(e) => { setName(e.target.value); s.touch(); }} />
        </Field>
        <Field label="Description" hint={`${description.length} / 160`}>
          <textarea
            className={`${inputClass} h-24 py-2`}
            maxLength={160}
            value={description}
            onChange={(e) => { setDescription(e.target.value); s.touch(); }}
          />
        </Field>
        <Field label="Phone">
          <input className={inputClass} inputMode="tel" value={phone} onChange={(e) => { setPhone(e.target.value); s.touch(); }} />
        </Field>
      </Card>
      <Section title="Hours">
        <Card className="divide-y divide-border">
          {hours.map((h, i) => (
            <div key={h.day} className="flex items-center gap-3 px-4 py-2">
              <span className="w-20 shrink-0 text-sm font-medium">{h.day}</span>
              <input
                aria-label={`${h.day} hours`}
                className={`${inputClass} h-10`}
                value={h.hours}
                onChange={(e) => {
                  const next = [...hours];
                  next[i] = { ...h, hours: e.target.value };
                  setHours(next);
                  s.touch();
                }}
              />
            </div>
          ))}
        </Card>
      </Section>
      <SaveBar dirty={s.dirty} saved={s.saved} onSave={s.save} />
    </>
  );
}
