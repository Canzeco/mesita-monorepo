"use client";

import { Crown, Instagram } from "lucide-react";
import {
  useConsumerClass,
  useMockClass,
  setMockClass,
} from "@/lib/class-context";
import { cn } from "@/lib/utils";

// Demo-only emulation controls, surfaced as their own Me sections while the
// real Instagram + Class cards are parked (soon). Each writes the client-only
// MOCK_CLASS override (see class-context) so every surface that reads
// useConsumerClass() — profile card, place promo chips, reward box — can be
// previewed without real billing or a 1K-follower Instagram. Both toggles are
// backed by the single tri-state override, so they stay mutually consistent:
//   • Emulate Instagram ON  → 'instagram'  (Premium via IG: @handle + reach)
//   • Emulate Class Premium → 'subscription' (Premium via paid plan)
//   • either OFF/Free       → 'free'
// Remove this file together with the MOCK_ paths once the states can be
// produced with real data.

export function MockControls() {
  const { key, origin } = useConsumerClass();
  const override = useMockClass();
  const igOn = origin === "instagram";
  const classPremium = key === "premium";

  return (
    <div className="border-border/70 flex flex-col gap-2 rounded-2xl border border-dashed p-3">
      <div className="flex items-center gap-1.5">
        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold tracking-[0.12em] text-amber-600 uppercase">
          Demo
        </span>
        <span className="text-muted-foreground text-[11px] font-medium">
          Emulate account states
        </span>
        {override && (
          <button
            type="button"
            onClick={() => setMockClass(null)}
            className="text-muted-foreground hover:text-foreground ml-auto text-[11px] font-semibold underline underline-offset-2"
          >
            Reset
          </button>
        )}
      </div>

      <EmulateRow
        icon={
          <Instagram className="h-[18px] w-[18px] text-white" strokeWidth={2} />
        }
        iconClass="bg-[linear-gradient(135deg,oklch(0.70_0.20_30),oklch(0.65_0.20_350))]"
        title="Emulate Instagram"
        summary="Preview the Instagram-connected profile"
        on={igOn}
        onToggle={() => setMockClass(igOn ? "free" : "instagram")}
      />

      <EmulateRow
        icon={<Crown className="h-[18px] w-[18px] text-white" strokeWidth={2} />}
        iconClass="bg-pink-gradient"
        title="Emulate Class"
        summary="Preview Mesita Premium"
        on={classPremium}
        onToggle={() => setMockClass(classPremium ? "free" : "subscription")}
      />
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
}: {
  icon: React.ReactNode;
  iconClass: string;
  title: string;
  summary: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-border bg-card flex items-center gap-3 rounded-xl border p-3">
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
