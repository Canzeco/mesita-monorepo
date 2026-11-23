"use client";

// Admin › Offers › Cashbacks (MESITA-4700, Pato: "Yes, editable"): the
// defaults every place without its own saved lines reads. Two rates (Welcome,
// Returning; no VIP line since MESITA-4709), each
// Off · 5 · 10 · 15 · 20 % (no cap per bill since MESITA-4728), one Save through
// admin-web-save-cashback-defaults. A place's own lines on Business › Offers
// win; this never touches them. MESITA-4714: and the Post story reward
// (Off · $20 · $50), what a verified Instagram story pays a guest.

import { useState, useTransition } from "react";
import { ArrowsClockwiseIcon } from "@phosphor-icons/react";
import { Button, Notice, SectionCard, SelectField, TBody, THead, Table, Td, Th, Tr } from "@/components/admin-ui";
import { saveCashbackDefaults, type CashbackDefaults } from "./actions";

const STEPS = [0, 500, 1000, 1500, 2000] as const;
const pct = (bps: number) => (bps === 0 ? "Off" : `${bps / 100}%`);
const STORY_STEPS = [0, 2000, 5000] as const;
const storyWord = (cents: number) => (cents === 0 ? "Off" : `$${cents / 100}`);

const LINES: { key: "welcome_bps" | "returning_bps"; name: string; who: string }[] = [
  { key: "welcome_bps", name: "New Customers", who: "Welcome: a guest's first bill at the place" },
  { key: "returning_bps", name: "Returning Customers", who: "Returning: every later bill at the place" },
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
      title="Cashbacks"
      subtitle="The defaults for every place that hasn't set its own on Business › Offers. Needs Credits only, no Stripe. A confirmed bill earns credit on the part paid by card or cash, never credit or the tip, with no cap; it lands 1 hour later. Mesita takes no fee."
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
              <Tr data-cashback-line="story_reward">
                <Td className="font-semibold">Post · Instagram story</Td>
                <Td className="text-muted-foreground">A guest&apos;s story tagging @mesita and the place, once every 7 days</Td>
                <Td numeric>
                  <SelectField
                    aria-label="Instagram story reward default"
                    className="ml-auto w-28"
                    value={String(draft.story_reward_cents)}
                    disabled={pending}
                    onChange={(v) => setDraft({ ...draft, story_reward_cents: Number(v) })}
                  >
                    {STORY_STEPS.map((cents) => (
                      <option key={cents} value={cents}>
                        {storyWord(cents)}
                      </option>
                    ))}
                  </SelectField>
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
          {error ? <Notice>{error}</Notice> : null}
        </div>
      )}
    </SectionCard>
  );
}
