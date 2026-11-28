"use client";

// Admin › Offers › Cashbacks (MESITA-4700, Pato: "Yes, editable"): the
// defaults every place without its own saved lines reads. Three rates
// (Welcome, Returning, and Returning VIP since MESITA-4766), two picks each
// (at most MX$1,000 a bill, MESITA-4831), one Save through
// admin-web-save-cashback-defaults. A place's own lines on Business › Offers
// win; this never touches them. MESITA-4775: and the default Visit Offer,
// Cashback (credit back) for all four lines; Discount is gone (MESITA-5067).

import { useState, useTransition } from "react";
import { ArrowsClockwiseIcon } from "@phosphor-icons/react";
import { Button, Notice, SectionCard, SelectField, TBody, THead, Table, Td, Th, Tr } from "@/components/admin-ui";
import { saveCashbackDefaults, type CashbackDefaults } from "./actions";

// MESITA-4764: two picks each, as Business › Offers (Welcome 10 · 20, Returning 5 · 10,
// Returning VIP 10 · 20 since MESITA-4766).
const STEPS = {
  welcome_bps: [0, 1000, 2000],
  returning_bps: [0, 500, 1000],
  returning_vip_bps: [0, 1000, 2000],
  welcome_vip_bps: [0, 1000, 2000],
} as const;
const pct = (bps: number) => (bps === 0 ? "Off" : `${bps / 100}%`);

// FOUR TIERS (Pato, 2026-11-23, MESITA-4789), in his order and Business's words.
const LINES: { key: keyof typeof STEPS; name: string; who: string }[] = [
  { key: "welcome_bps", name: "Welcome Regular", who: "A guest's first bill at the place" },
  { key: "returning_bps", name: "Returning Regular", who: "Every later bill at the place" },
  { key: "welcome_vip_bps", name: "Welcome VIP", who: "A VIP guest's first bill at the place" },
  { key: "returning_vip_bps", name: "Returning VIP", who: "Every later bill of a VIP guest at the place" },
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
      subtitle="The defaults for every place that hasn't set its own on Business › Offers: the four cashback rates. Cashback earns credit on the part paid by card or cash, never credit or the tip, at most MX$1,000 a bill, 1 hour later. Mesita takes no fee."
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
                      {STEPS[l.key].map((bps) => (
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
