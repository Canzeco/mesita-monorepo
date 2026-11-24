"use client";

// Security › Suspensions (MESITA-4899, Pato 2026-11-24: "write that in a new
// section in admin console called Security"). The rules live in SQL
// (waiter_code_try, guest_ticket_closed); this page says them and reinstates.

import { useState } from "react";
import { ClockCounterClockwiseIcon, ShieldCheckIcon, UserMinusIcon } from "@phosphor-icons/react";
import { Button, Chip, ConfirmDialog, EmptyState, Notice, SectionCard, TBody, THead, Table, Td, Th, Tr } from "@/components/admin-ui";
import { formatShortDate } from "@/lib/format";
import { listSecurity, reinstateGuest, type Closure, type Suspension } from "./actions";

const RULES: [string, string][] = [
  ["Waiter code", "6 digits, unique in its restaurant."],
  ["3 wrong codes on one ticket", "The ticket is closed. The guest needs a new QR."],
  ["5 tickets closed, same guest, same restaurant, in 30 days", "The account that made those QRs is suspended, until it is reinstated here."],
  ["15 wrong codes on one guest in a day", "No more codes are tried on that guest for the day."],
  ["30 wrong codes from one internet address in 10 minutes, or 100 in a day", "That address can't try codes until the time passes."],
];

export function SecurityClient({ initial, loadError }: { initial: { suspensions: Suspension[]; closures: Closure[] } | null; loadError: string | null }) {
  const [data, setData] = useState(initial);
  const [asking, setAsking] = useState<Suspension | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reinstate = async () => {
    if (!asking) return;
    setError(null);
    const r = await reinstateGuest(asking.id);
    if (!r.ok) return setError(r.error);
    const next = await listSecurity();
    if (next.ok) setData(next);
    setAsking(null);
  };

  return (
    <>
      {loadError ? <Notice>{`Couldn't load Security: ${loadError}`}</Notice> : null}
      <SectionCard icon={<ShieldCheckIcon aria-hidden />} title="Rules" subtitle="They apply by themselves. Changing a number is a code change.">
        <Table className="mt-4">
          <THead>
            <Tr>
              <Th>When</Th>
              <Th>What happens</Th>
            </Tr>
          </THead>
          <TBody>
            {RULES.map(([when, then]) => (
              <Tr key={when}>
                <Td className="font-semibold">{when}</Td>
                <Td>{then}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </SectionCard>

      <SectionCard icon={<UserMinusIcon aria-hidden />} title="Suspended guests" subtitle="A suspended guest keeps their credits but can't use the app. Reinstating starts their count over.">
        <div className="mt-4">
          {!data || data.suspensions.length === 0 ? (
            <EmptyState>{data ? "Nobody has been suspended." : "Couldn't load the list. Reload the page."}</EmptyState>
          ) : (
            <Table className="min-w-[640px]">
              <THead>
                <Tr>
                  <Th>Guest</Th>
                  <Th>Restaurant</Th>
                  <Th numeric>Tickets closed</Th>
                  <Th>Suspended</Th>
                  <Th numeric>Action</Th>
                </Tr>
              </THead>
              <TBody>
                {data.suspensions.map((s) => (
                  <Tr key={s.id}>
                    <Td className="font-semibold">{s.guest}</Td>
                    <Td>{s.place ?? "—"}</Td>
                    <Td numeric>{s.closures}</Td>
                    <Td className="whitespace-nowrap">{formatShortDate(s.suspended_at)}</Td>
                    <Td numeric>
                      {s.reinstated_at ? (
                        <Chip tone="neutral">Reinstated {formatShortDate(s.reinstated_at)}</Chip>
                      ) : (
                        <Button
                          tone="secondary"
                          size="sm"
                          onClick={() => {
                            setError(null);
                            setAsking(s);
                          }}
                        >
                          Reinstate
                        </Button>
                      )}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </div>
      </SectionCard>

      <SectionCard icon={<ClockCounterClockwiseIcon aria-hidden />} title="Closed tickets" subtitle="The last 50 tickets closed by three wrong codes.">
        <div className="mt-4">
          {!data || data.closures.length === 0 ? (
            <EmptyState>{data ? "No ticket has been closed." : "Couldn't load the list. Reload the page."}</EmptyState>
          ) : (
            <Table className="min-w-[480px]">
              <THead>
                <Tr>
                  <Th>Guest</Th>
                  <Th>Restaurant</Th>
                  <Th>Closed</Th>
                </Tr>
              </THead>
              <TBody>
                {data.closures.map((c) => (
                  <Tr key={c.id}>
                    <Td className="font-semibold">{c.guest}</Td>
                    <Td>{c.place ?? "—"}</Td>
                    <Td className="whitespace-nowrap">{formatShortDate(c.created_at)}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </div>
      </SectionCard>

      <ConfirmDialog
        open={asking !== null}
        error={error}
        title="Reinstate this guest?"
        body={asking ? <p className="text-sm">{asking.guest} can use Mesita again, and their closed tickets count from zero.</p> : null}
        confirmLabel="Reinstate"
        onConfirm={reinstate}
        onCancel={() => setAsking(null)}
      />
    </>
  );
}
