"use client";

import { Crown, Instagram, Magnet } from "lucide-react";
import {
  useMockAccount,
  setMockAccount,
} from "@/lib/class-context";
import { MAGNETIC_FOLLOWER_THRESHOLD } from "@/lib/consumer-data";
import { DEMO_INSTAGRAM_FOLLOWERS } from "@/lib/instagram-demo";
import { cn } from "@/lib/utils";
import { INSTAGRAM_ICON_GRADIENT_CLASS } from "@/lib/ui-classes";

// Demo-only emulation controls, surfaced as their own Me sections while the
// real Instagram + Class cards are parked (soon). Three independent toggles
// write the client-only MOCK_ACCOUNT override (see class-context) so every
// surface that reads useConsumerClass() — profile card, place promo chips,
// reward box — can be previewed without real billing or Instagram reach:
//   • Emulate Premium   → class premium via subscription
//   • Emulate Magnetic  → class magnetic via invitation (reach-free door)
//   • Emulate Instagram → a connected IG with an editable follower count;
//     crossing MAGNETIC_FOLLOWER_THRESHOLD grants Magnetic via Instagram and
//     wins over the class toggles — exactly like the real claim EF.
// Premium/Magnetic are mutually exclusive (one class axis). Remove this file
// together with the MOCK_ paths once the states can be produced with real
// data.

export function MockControls() {
  const mock = useMockAccount();
  const premiumOn = mock?.class === "premium";
  const magneticOn = mock?.class === "magnetic";
  const igOn = mock?.instagram ?? false;
  const followers = mock?.followers ?? DEMO_INSTAGRAM_FOLLOWERS;
  const igMagnetic = igOn && followers >= MAGNETIC_FOLLOWER_THRESHOLD;

  return (
    <div className="border-border/70 flex flex-col gap-2 rounded-2xl border border-dashed p-3">
      <div className="flex items-center gap-1.5">
        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold tracking-[0.12em] text-amber-600 uppercase">
          Demo
        </span>
        <span className="text-muted-foreground text-[11px] font-medium">
          Emulate account states
        </span>
        {mock && (
          <button
            type="button"
            onClick={() => setMockAccount(null)}
            className="text-muted-foreground hover:text-foreground ml-auto text-[11px] font-semibold underline underline-offset-2"
          >
            Reset
          </button>
        )}
      </div>

      <EmulateRow
        icon={<Crown className="h-[18px] w-[18px] text-white" strokeWidth={2} />}
        iconClass="bg-pink-gradient"
        title="Emulate Premium"
        summary="Mesita Premium via subscription"
        on={premiumOn}
        onToggle={() => setMockAccount({ class: premiumOn ? null : "premium" })}
      />

      <EmulateRow
        icon={<Magnet className="h-[18px] w-[18px] text-white" strokeWidth={2} />}
        iconClass="bg-tier-gold"
        title="Emulate Magnetic"
        summary="Mesita Magnetic via invitation"
        on={magneticOn}
        onToggle={() =>
          setMockAccount({ class: magneticOn ? null : "magnetic" })
        }
      />

      <EmulateRow
        icon={
          <Instagram className="h-[18px] w-[18px] text-white" strokeWidth={2} />
        }
        iconClass={INSTAGRAM_ICON_GRADIENT_CLASS}
        title="Emulate Instagram"
        summary={
          igOn
            ? igMagnetic
              ? "Connected — reach grants Magnetic"
              : "Connected — below the Magnetic bar"
            : "A connected Instagram + your reach"
        }
        on={igOn}
        onToggle={() => setMockAccount({ instagram: !igOn })}
      >
        {igOn && (
          <div className="border-border/50 mt-1 flex items-center gap-2 border-t pt-2.5">
            <label
              htmlFor="mock-ig-followers"
              className="text-muted-foreground text-[11px] font-medium"
            >
              Followers
            </label>
            <input
              id="mock-ig-followers"
              inputMode="numeric"
              value={followers}
              onChange={(e) => {
                const n = Number(e.target.value.replace(/[^\d]/g, ""));
                setMockAccount({
                  followers: Number.isFinite(n) ? n : 0,
                });
              }}
              className="border-border bg-muted/30 h-8 w-24 rounded-lg border px-2.5 text-right text-[12px] font-semibold outline-none"
            />
            <span
              className={cn(
                "ml-auto text-[10.5px] font-semibold",
                igMagnetic ? "text-amber-700" : "text-muted-foreground",
              )}
            >
              {MAGNETIC_FOLLOWER_THRESHOLD.toLocaleString("en-US")}+ = Magnetic
            </span>
          </div>
        )}
      </EmulateRow>
    </div>
  );
}

function EmulateRow({
  icon,
  iconClass,
  title,
  summary,
  on,
  onToggle,
  children,
}: {
  icon: React.ReactNode;
  iconClass: string;
  title: string;
  summary: string;
  on: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-border bg-card flex flex-col rounded-xl border p-3">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm",
            iconClass,
          )}
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-bold tracking-tight">
            {title}
          </span>
          <span className="text-muted-foreground block truncate text-[11px]">
            {summary}
          </span>
        </span>
        <Switch on={on} onToggle={onToggle} label={title} />
      </div>
      {children}
    </div>
  );
}

// Minimal iOS-style switch. Purely a demo control, so no form semantics
// beyond aria-pressed / label.
function Switch({
  on,
  onToggle,
  label,
}: {
  on: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className={cn(
        "relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition",
        on ? "bg-primary" : "bg-muted",
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition",
          on ? "translate-x-[18px]" : "translate-x-[2px]",
        )}
      />
    </button>
  );
}
