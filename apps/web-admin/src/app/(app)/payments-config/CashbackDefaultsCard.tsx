"use client";

// Admin › Offers › Cashbacks (MESITA-4700, Pato: "Yes, editable"): the
// default every place without its own saved rate reads. One line since
// MESITA-5124 (Pato, 2026-11-28: "Just one cashback"; Welcome is a voucher
// again): Cashback on every bill (at most MX$1,000 a bill, MESITA-4831), one
// Save through admin-web-save-cashback-defaults. A place's own rate on
// Business › Offers wins; this never touches it.

import { useState, useTransition } from "react";
import { ArrowsClockwiseIcon } from "@phosphor-icons/react";
import { Button, Notice, SectionCard, SelectField, TBody, THead, Table, Td, Th, Tr } from "@/components/admin-ui";
import { saveCashbackDefaults, type CashbackDefaults } from "./actions";

// As Business › Offers: Off · 5, and 10 only where the default Small bonus
// is +20% (MESITA-5072; the server refuses it otherwise). The rate's key is
// returning_bps (a renamed key resets live config).
const STEPS = {
  returning_bps: [0, 500, 1000],
} as const;
const stepsFor = (key: keyof typeof STEPS, d: CashbackDefaults): readonly number[] =>
  key === "returning_bps" ? STEPS.returning_bps.filter((b) => b !== 1000 || d.small_bonus_bps === 2000) : STEPS[key];
const pct = (bps: number) => (bps === 0 ? "Off" : `${bps / 100}%`);

// In Business's words.
const LINES: { key: keyof typeof STEPS; name: string; who: string }[] = [
  { key: "returning_bps", name: "Cashback", who: "Every bill at the place" },
];

export function CashbackDefaultsCard({ initial }: { initial: CashbackDefaults | null }) {
  const [saved, setSaved] = useState<CashbackDefaults | null>(initial);
  const [draft, setDraft] = useState<CashbackDefaults | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const dirty = !!draft && !!saved && JSON.stringify(draft) !== JSON.stringify(saved);

  const save = () =>
    start(async () => {
      if (!draft) return;
      setError(null);
      setDone(false);
      const r = await saveCashbackDefaults(draft);
      if (!r.ok) return setError(r.error);
      setSaved(r.cashback_defaults);
      setDraft(r.cashback_defaults);
      setDone(true);
    });

  return (
    <SectionCard
      icon={<ArrowsClockwiseIcon aria-hidden />}
      title="Visit Offers"
      subtitle="The defaults for every place that hasn't set its own on Business › Offers: the one Cashback rate. Cashback earns credit on the part paid by card or cash, never credit or the tip, at most MX$1,000 a bill, 1 hour later. Mesita takes no fee."
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
                      {stepsFor(l.key, draft).map((bps) => (
                        <option key={bps} value={bps}>
                          {pct(bps)}
                        </option>
                      ))}
                    </SelectField>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
          <div className="flex items-center justify-end gap-3">
            {done && !dirty ? <span className="text-muted-foreground text-sm">Saved. The next confirmed bill uses it.</span> : null}
            <Button size="sm" pending={pending} disabled={!dirty} onClick={save}>
              Save
            </Button>
          </div>
          {error ? <Notice>{error}</Notice> : null}
        </div>
      )}
    </SectionCard>
  );
}
