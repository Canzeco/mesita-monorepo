"use client";

// THE PANEL — the thing this whole app exists to provide.
//
// The business console's state is decided by one Edge Function call, a Stripe
// account and a row of booleans nobody can set from outside. Two of its four
// shapes are unreachable on purpose (`zero` needs an account with no places,
// `unknown` needs the API to be down), the Stripe ladder needs eight minutes of
// document upload per rung, and the partner gate needs a real payment. So the
// screens that state those facts are the screens nobody has ever looked at.
//
// Here they are radio buttons.
//
// It is DELIBERATELY not part of the console's chrome: a floating control over
// the frame, so that what is underneath is the console and nothing else. A
// panel welded into the rail would be the ninth row nobody could unsee.
import { useEffect, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { useMock } from "@/mock/MockStore";
import { PRESETS, type Scenario } from "@/mock/scenario";
import {
  MEMBERSHIP_STATE_LABEL,
  PAY_LADDER_LABEL,
  type MembershipState,
  type PayLadder,
  type PlaceRole,
} from "@/mock/types";
import type { RailMode } from "@/lib/rail-scope";
import { GHOST_PILL_BUTTON_CLASS, TINY_LABEL_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

const MODE_HINT: Record<RailMode, string> = {
  unknown: "The read FAILED. Retry, never a count, never “add one”.",
  zero: "A successful read of no places. First-run.",
  solo: "Exactly one. The shape the console is built for.",
  multi: "Two or more. The console picks none of them.",
};

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className={TINY_LABEL_CLASS}>{label}</p>
      {children}
    </div>
  );
}

function Choice<T extends string>({
  value,
  options,
  onPick,
}: {
  value: T;
  options: Array<{ id: T; label: string }>;
  onPick: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={o.id === value}
          onClick={() => onPick(o.id)}
          className={cn(
            "focus-visible:ring-ring rounded-full border px-2.5 py-1 text-[12px] font-semibold outline-hidden transition focus-visible:ring-2",
            o.id === value
              ? "border-foreground bg-foreground text-paper"
              : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({
  label,
  hint,
  on,
  onChange,
}: {
  label: string;
  hint?: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 py-1">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-primary mt-0.5 h-4 w-4 shrink-0"
      />
      <span className="min-w-0">
        <span className="block text-[13px] font-medium">{label}</span>
        {hint && (
          <span className="text-muted-foreground block text-[11px] leading-snug">{hint}</span>
        )}
      </span>
    </label>
  );
}

export function MockPanel() {
  const { scenario, setScenario, resetScenario, hydrated } = useMock();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      // A one-key door. `.` is unclaimed by every field in this console, and
      // the guard below keeps it out of the ones that could claim it.
      if (e.key === "." && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const set = (patch: Partial<Scenario>) => setScenario(patch);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title="Scenario (.)"
        className="bg-foreground text-paper focus-visible:ring-ring fixed right-4 bottom-4 z-50 flex h-12 w-12 items-center justify-center rounded-full shadow-lg outline-hidden transition hover:bg-ink-hover focus-visible:ring-2"
      >
        {open ? <X className="h-5 w-5" /> : <SlidersHorizontal className="h-5 w-5" />}
        <span className="sr-only">Scenario</span>
      </button>

      {open && (
        <aside
          aria-label="Scenario"
          className="border-border bg-card fixed top-7 right-0 bottom-0 z-40 flex w-[min(360px,100vw)] flex-col gap-4 overflow-y-auto border-l p-4 pb-24 shadow-2xl"
        >
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">Scenario</h2>
            <p className="text-muted-foreground text-[12px] leading-snug">
              Put the console in a state and look at it. Everything here is local
              to this browser; nothing is sent anywhere.
            </p>
          </div>

          <Group label="Presets">
            <div className="flex flex-col gap-1">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => set(p.patch)}
                  className="border-border hover:border-foreground/30 focus-visible:ring-ring rounded-xl border px-3 py-2 text-left outline-hidden transition focus-visible:ring-2"
                >
                  <span className="block text-[13px] font-semibold">{p.label}</span>
                  <span className="text-muted-foreground block text-[11px] leading-snug">
                    {p.hint}
                  </span>
                </button>
              ))}
            </div>
          </Group>

          <Group label="Console shape">
            <Choice<RailMode>
              value={scenario.mode}
              onPick={(mode) => set({ mode })}
              options={[
                { id: "unknown", label: "unknown" },
                { id: "zero", label: "zero" },
                { id: "solo", label: "solo" },
                { id: "multi", label: "multi" },
              ]}
            />
            <p className="text-muted-foreground text-[11px] leading-snug">
              {MODE_HINT[scenario.mode]}
            </p>
          </Group>

          <Group label="Your role on this place">
            <Choice<PlaceRole>
              value={scenario.role}
              onPick={(role) => set({ role })}
              options={[
                { id: "owner", label: "owner" },
                { id: "editor", label: "editor" },
                { id: "viewer", label: "viewer" },
              ]}
            />
            <p className="text-muted-foreground text-[11px] leading-snug">
              A viewer sees Profile and nothing else. The eight other views and
              all four Manage pages are dropped from the rail AND refused at
              their addresses — hidden is not protected. The pages only got
              their half of that gate in MESITA-1933: until the products left
              the rail, `tabsForAccess` on the product rows was the whole
              console&rsquo;s role check, and Products, Activity and Settings
              had none of their own.
            </p>
          </Group>

          <Group label="Online Payments">
            <Choice<PayLadder>
              value={scenario.pay}
              onPick={(pay) => set({ pay })}
              options={(Object.keys(PAY_LADDER_LABEL) as PayLadder[]).map((k) => ({
                id: k,
                label: PAY_LADDER_LABEL[k],
              }))}
            />
            <p className="text-muted-foreground text-[11px] leading-snug">
              Stripe sets a disabled reason on day zero, so “never started” and
              “switched off” arrive looking identical. They are separate rungs
              here so the two screens can be compared.
            </p>
          </Group>

          <Group label="Mesita Membership">
            <Choice<MembershipState>
              value={scenario.membership}
              onPick={(membership) => set({ membership })}
              options={(Object.keys(MEMBERSHIP_STATE_LABEL) as MembershipState[]).map((k) => ({
                id: k,
                label: MEMBERSHIP_STATE_LABEL[k],
              }))}
            />
            <p className="text-muted-foreground text-[11px] leading-snug">
              What the subscription is DOING, which is not whether the place is
              a partner. Payment due still entitles — Stripe is retrying, and
              nothing is taken away. No subscription is the place an operator
              switched on by hand: it has no date, so none is shown. Off the
              Partner switch below, this reads No subscription whatever you
              pick here.
            </p>
          </Group>

          <Group label="Switches on this place">
            {/* THE TWO GENERAL STATES THAT MOVE (MESITA-1977). They sit above
                the product switches because they are facts about the PLACE,
                not settings inside a product — and because Disabled is the one
                switch here that changes what every other row means. */}
            <Toggle
              label="Pulsing (Google Active)"
              hint="Google answers for this place — the second rung of the general ladder, and the one rung Mesita does not control."
              on={scenario.pulsing}
              onChange={(pulsing) => set({ pulsing })}
            />
            <Toggle
              label="Disabled"
              hint="Turned off. Not a rung: it can land at any height, so the portfolio reads it apart from the ladder."
              on={scenario.disabled}
              onChange={(disabled) => set({ disabled })}
            />
            <Toggle
              label="Mesita Partner"
              hint="The gate Visits, Rewards, Payments and Credits read. Off, they are Locked and carry no verb."
              on={scenario.partnered}
              onChange={(partnered) => set({ partnered })}
            />
            <Toggle
              label="Customer intelligence"
              hint="The Customers catalog is a subscription. Off, the list is counted and nobody in it is named."
              on={scenario.customerIntel}
              onChange={(customerIntel) => set({ customerIntel })}
            />
            <Toggle label="Pickup orders" on={scenario.pickupOrders} onChange={(v) => set({ pickupOrders: v })} />
            <Toggle label="Delivery orders" on={scenario.deliveryOrders} onChange={(v) => set({ deliveryOrders: v })} />
            <Toggle label="Reservations" on={scenario.reservations} onChange={(v) => set({ reservations: v })} />
            <Toggle label="Visit rewards" on={scenario.visitRewards} onChange={(v) => set({ visitRewards: v })} />
            <Toggle label="Credits" on={scenario.credits} onChange={(v) => set({ credits: v })} />
            <Toggle
              label="Super-admin"
              hint="Adds the Admin view, and nothing else."
              on={scenario.isSuperAdmin}
              onChange={(isSuperAdmin) => set({ isSuperAdmin })}
            />
          </Group>

          <Group label="Data">
            <Toggle
              label="Empty every list"
              hint="Half this console is empty states. This is how you look at them."
              on={scenario.empty}
              onChange={(empty) => set({ empty })}
            />
          </Group>

          <button type="button" onClick={resetScenario} className={cn(GHOST_PILL_BUTTON_CLASS, "self-start")}>
            Reset
          </button>

          {!hydrated && (
            <p className="text-muted-foreground text-[11px]">Reading your saved scenario…</p>
          )}
        </aside>
      )}
    </>
  );
}
