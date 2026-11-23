"use client";

// Admin › Offers › Cashbacks (MESITA-4700, Pato: "Yes, editable"): the
// defaults every place without its own saved lines reads. Two rates (Welcome,
// Returning; no VIP line since MESITA-4709), each
// Off · 5 · 10 · 15 · 20 %, and the cap per bill (MXN units), one Save through
// admin-web-save-cashback-defaults. A place's own lines on Business › Offers
// win; this never touches them.

import { useState, useTransition } from "react";
import { ArrowsClockwiseIcon } from "@phosphor-icons/react";
import { Button, Notice, SectionCard, SelectField, TBody, THead, Table, Td, TextField, Th, Tr } from "@/components/admin-ui";
import { saveCashbackDefaults, type CashbackDefaults } from "./actions";

const STEPS = [0, 500, 1000, 1500, 2000] as const;
const pct = (bps: number) => (bps === 0 ? "Off" : `${bps / 100}%`);

const LINES: { key: "welcome_bps" | "returning_bps"; name: string; who: string }[] = [
  { key: "welcome_bps", name: "New Customers", who: "Welcome: a guest's first bill at the place" },
  { key: "returning_bps", name: "Returning Customers", who: "Returning: every later bill at the place" },
];

/** The most the cap can be, in whole units (the server's check, MX$10,000). */
const CAP_MAX_UNITS = 10_000;

export function CashbackDefaultsCard({ initial }: { initial: CashbackDefaults | null }) {
  const [saved, setSaved] = useState<CashbackDefaults | null>(initial);
  const [draft, setDraft] = useState<CashbackDefaults | null>(initial);
  const [capText, setCapText] = useState(initial ? String(initial.cap_cents / 100) : "");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const capUnits = /^\d+$/.test(capText) ? Number(capText) : null;
  const capOk = capUnits !== null && capUnits <= CAP_MAX_UNITS;
  const dirty = !!draft && !!saved && capOk && JSON.stringify({ ...draft, cap_cents: capUnits! * 100 }) !== JSON.stringify(saved);

  const save = () =>
    start(async () => {
      if (!draft || capUnits === null) return;
      setError(null);
      setDone(false);
      const r = await saveCashbackDefaults({ ...draft, cap_cents: capUnits * 100 });
      if (!r.ok) return setError(r.error);
      setSaved(r.cashback_defaults);
      setDraft(r.cashback_defaults);
      setCapText(String(r.cashback_defaults.cap_cents / 100));
      setDone(true);
    });

  return (
    <SectionCard
      icon={<ArrowsClockwiseIcon aria-hidden />}
      title="Cashbacks"
      subtitle="The defaults for every place that hasn't set its own on Business › Offers. Needs Credits only, no Stripe. A confirmed bill earns credit on the part not paid with credit, never the tip; it lands 3 hours later, once per guest per place per day. Mesita takes no fee."
    >
      {!draft ? (
        <Notice className="mt-4">Couldn&apos;t load the cashback defaults. Reload to edit them.</Notice>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <Table className="min-w-[560px]" data-admin-cashback-lines>
            <THead>
              <Tr>
                <Th>Line</Th>
                <Th>Who</Th>
                <Th numeric>Default</Th>
              </Tr>
            </THead>
            <TBody>
              {LINES.map((l) => (
                <Tr key={l.key} data-cashback-line={l.key}>
                  <Td className="font-semibold">{l.name}</Td>
                  <Td className="text-muted-foreground">{l.who}</Td>
                  <Td numeric>
                    <SelectField
                      aria-label={`${l.name} default`}
                      className="ml-auto w-28"
                      value={String(draft[l.key])}
                      disabled={pending}
                      onChange={(v) => setDraft({ ...draft, [l.key]: Number(v) })}
                    >
                      {STEPS.map((bps) => (
                        <option key={bps} value={bps}>
                          {pct(bps)}
                        </option>
                      ))}
                    </SelectField>
                  </Td>
                </Tr>
              ))}
              <Tr data-cashback-line="cap">
                <Td className="font-semibold">Cap per bill</Td>
                <Td className="text-muted-foreground">The most one bill can earn, in the place&apos;s currency (up to 10,000)</Td>
                <Td numeric>
                  <TextField
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    aria-label="Cap per bill"
                    className="ml-auto w-28"
                    value={capText}
                    disabled={pending}
                    onChange={(v) => setCapText(v.replace(/[^0-9]/g, "").slice(0, 5))}
                  />
                </Td>
              </Tr>
            </TBody>
          </Table>
          <div className="flex items-center justify-end gap-3">
            {done && !dirty ? <span className="text-muted-foreground text-sm">Saved. The next confirmed bill uses it.</span> : null}
            <Button size="sm" pending={pending} disabled={!dirty} onClick={save}>
              Save
            </Button>
          </div>
          {!capOk ? <Notice>The cap must be a whole amount from 0 to 10,000.</Notice> : null}
          {error ? <Notice>{error}</Notice> : null}
        </div>
      )}
    </SectionCard>
  );
}
