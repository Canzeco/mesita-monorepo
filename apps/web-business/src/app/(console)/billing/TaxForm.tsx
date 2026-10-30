"use client";

import { useState } from "react";
import { Field, SaveBar, inputClass, useMockSave } from "@/components/controls";
import { Card } from "@/components/ui";

export function TaxForm() {
  const s = useMockSave();
  const [v, setV] = useState({ legalName: "", taxId: "", email: "" });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setV((x) => ({ ...x, [k]: e.target.value }));
    s.touch();
  };
  return (
    <>
      <Card className="grid gap-4 p-4 sm:grid-cols-2">
        <Field label="Legal name">
          <input className={inputClass} value={v.legalName} onChange={set("legalName")} placeholder="Lumbre y Sal S.A. de C.V." />
        </Field>
        <Field label="RFC">
          <input className={inputClass} value={v.taxId} onChange={set("taxId")} placeholder="LSA200101AB1" />
        </Field>
        <Field label="Invoice email">
          <input className={inputClass} type="email" value={v.email} onChange={set("email")} placeholder="facturas@example.com" />
        </Field>
      </Card>
      <SaveBar dirty={s.dirty} saved={s.saved} onSave={s.save} />
    </>
  );
}
