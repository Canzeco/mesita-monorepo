"use client";

import { useState } from "react";
import { Field, SaveBar, Toggle, inputClass, useMockSave } from "@/components/controls";
import { Avatar, Card, Chip, List, Note, Section } from "@/components/ui";
import { place, staff } from "@/lib/mock";

export function VisitSettingsForm() {
  const s = useMockSave();
  const [approvers, setApprovers] = useState(() => Object.fromEntries(staff.map((m) => [m.id, m.canApprove])));
  const [alerts, setAlerts] = useState(true);
  const [phone, setPhone] = useState(place.phone);

  return (
    <>
      <Section title="Who can approve visits">
        <List>
          {staff.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={m.name} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{m.name}</div>
                <div className="text-sm text-muted-foreground">{m.email}</div>
              </div>
              {m.role === "Owner" ? (
                <Chip>Owner</Chip>
              ) : (
                <Toggle
                  label={`${m.name} can approve`}
                  checked={approvers[m.id]}
                  onChange={(v) => {
                    setApprovers((a) => ({ ...a, [m.id]: v }));
                    s.touch();
                  }}
                />
              )}
            </div>
          ))}
        </List>
        <Note>Staff approve from their own phone by scanning the guest&apos;s QR. They only see Visits, never money settings or payouts.</Note>
      </Section>

      <Section title="Alerts">
        <Card className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-medium">WhatsApp when a guest opens a visit</div>
              <div className="text-sm text-muted-foreground">So nobody waits at the table for approval.</div>
            </div>
            <Toggle
              label="WhatsApp alerts"
              checked={alerts}
              onChange={(v) => {
                setAlerts(v);
                s.touch();
              }}
            />
          </div>
          {alerts ? (
            <div className="mt-4">
              <Field label="Send to">
                <input
                  className={inputClass}
                  value={phone}
                  inputMode="tel"
                  onChange={(e) => {
                    setPhone(e.target.value);
                    s.touch();
                  }}
                />
              </Field>
            </div>
          ) : null}
        </Card>
      </Section>
      <SaveBar dirty={s.dirty} saved={s.saved} onSave={s.save} />
    </>
  );
}
