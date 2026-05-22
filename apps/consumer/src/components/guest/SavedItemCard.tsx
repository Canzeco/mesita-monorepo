import Image from "next/image";
import {
  Calendar,
  CreditCard,
  Instagram,
  Award,
  Phone,
  QrCode,
} from "lucide-react";
import type { SavedItem, StepKey } from "@/lib/guest-data";
import { venueById } from "@/lib/guest-data";
import { cn } from "@/lib/utils";

const STEP_ICON: Record<
  StepKey,
  React.ComponentType<{ className?: string }>
> = {
  R: Calendar,
  P: CreditCard,
  S: Instagram,
  C: Award,
};

const BADGE_TONE = {
  pink: "bg-pink-gradient text-white",
  magenta:
    "bg-[linear-gradient(135deg,oklch(0.72_0.22_355),oklch(0.48_0.25_5))] text-white",
  gold: "bg-tier-gold text-black",
  "solid-pink": "bg-primary text-white",
};

const STATE_PILL = {
  arrive: { label: "Arrive & enjoy", tone: "bg-pink-gradient text-white" },
  calling: { label: "AI calling venue", tone: "bg-tier-gold text-black" },
  booking: {
    label: "Booking reservation",
    tone: "bg-pink-gradient text-white",
  },
  "show-qr": {
    label: "Show your QR to waiter",
    tone: "bg-muted text-foreground",
  },
};

function LastStepIcon({ step }: { step: StepKey }) {
  const Icon = STEP_ICON[step];
  return (
    <div className="border-border bg-card ml-1.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border">
      <Icon className="text-muted-foreground h-2 w-2" />
    </div>
  );
}

function StepProgress({
  total,
  done,
  leadIcon,
}: {
  total: number;
  done: number;
  leadIcon: "phone" | "check";
}) {
  const Lead = leadIcon === "phone" ? Phone : null;
  return (
    <div className="flex items-center gap-1.5">
      {leadIcon === "phone" && Lead ? (
        <Lead className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
      ) : (
        <span className="bg-primary flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-white">
          <span className="block h-1 w-1 rounded-full bg-white" />
        </span>
      )}
      <div className="flex flex-1 items-center gap-0.5">
        {Array.from({ length: total }).map((_, i) => {
          const isDone = i < done;
          return (
            <div key={i} className="flex flex-1 items-center gap-0.5">
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  isDone ? "bg-primary" : "border-border bg-card border",
                )}
              />
              {i < total - 1 && (
                <span
                  className={cn(
                    "h-px min-w-1 flex-1",
                    isDone && i < done - 1 ? "bg-primary" : "bg-border",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SavedItemCard({
  item,
  onClick,
}: {
  item: SavedItem;
  onClick?: () => void;
}) {
  const v = venueById(item.venueId);
  if (!v) return null;
  const statePill = STATE_PILL[item.state];
  const showRailQR = item.cashback != null;
  const hideStatePill = !!item.callingNote;

  return (
    <button
      type="button"
      onClick={onClick}
      className="border-border bg-card flex h-[140px] w-full items-stretch overflow-hidden border text-left transition active:opacity-80"
    >
      <div className="relative h-auto w-28 shrink-0">
        <Image
          src={v.photos[0]}
          alt={v.name}
          fill
          sizes="112px"
          className="object-cover"
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center p-3">
        <div className="flex items-center gap-2">
          <h3 className="font-display truncate text-base font-semibold tracking-tight">
            {v.name}
          </h3>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase",
              BADGE_TONE[item.badgeTone],
            )}
          >
            {item.steps.join("")}
          </span>
        </div>

        {item.callingNote ? (
          <p className="bg-tier-gold/30 text-foreground mt-1.5 line-clamp-2 rounded-lg px-2.5 py-1.5 text-[11px] leading-snug">
            <span className="font-medium">
              {item.callingNote.split("·")[0]?.trim()}
            </span>
            {item.callingNote.includes("·") && (
              <>
                <span className="mx-1">·</span>
                <span className="text-muted-foreground">
                  {item.callingNote.split("·").slice(1).join("·").trim()}
                </span>
              </>
            )}
          </p>
        ) : (
          !hideStatePill && (
            <span
              className={cn(
                "mt-1.5 inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wider uppercase",
                statePill.tone,
              )}
            >
              {statePill.label}
            </span>
          )
        )}

        <div className="mt-2.5 flex items-center">
          <StepProgress
            total={item.totalDots}
            done={item.doneDots}
            leadIcon={
              item.state === "calling" || item.state === "booking"
                ? "phone"
                : "check"
            }
          />
          <LastStepIcon step={item.steps[item.steps.length - 1]} />
        </div>
      </div>

      <div
        className={cn(
          "flex w-20 shrink-0 flex-col items-center justify-center gap-1 px-1.5 py-2 text-center",
          showRailQR
            ? item.cashbackTone === "gold"
              ? "bg-tier-gold text-black"
              : "bg-pink-gradient text-white"
            : "bg-card text-foreground",
        )}
      >
        {showRailQR ? (
          <>
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full",
                item.cashbackTone === "gold"
                  ? "bg-white text-black"
                  : "bg-white text-zinc-900",
              )}
            >
              <QrCode className="h-3.5 w-3.5" />
            </span>
            <span className="font-display text-xl leading-none font-bold">
              {item.cashback}
              <span className="text-xs">%</span>
            </span>
            <span className="text-[8px] font-semibold tracking-wider uppercase">
              {item.cashbackLabel ?? "Cashback"}
            </span>
          </>
        ) : (
          <>
            <span className="bg-muted text-foreground flex h-7 w-7 items-center justify-center rounded-full">
              <Calendar className="h-3.5 w-3.5" />
            </span>
            <span className="font-display text-sm leading-none font-bold">
              Booked
            </span>
            <span className="text-muted-foreground text-[8px] font-semibold tracking-wider uppercase">
              No cashback
            </span>
          </>
        )}
      </div>
    </button>
  );
}
