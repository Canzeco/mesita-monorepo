"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  X,
  Check,
  Camera,
  QrCode,
  CreditCard,
  Instagram,
  RefreshCw,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import type { SavedItem } from "@/lib/consumer-data";
import { venueById } from "@/lib/consumer-data";
import { workflowFor, getTicketType } from "@/lib/ticket-workflow";
import { cn } from "@/lib/utils";
import { FakeQR } from "./FakeQR";

const ACTION_META: Record<
  string,
  { label: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  "attach-screenshot": { label: "Attach screenshot", Icon: Camera },
  "show-qr": { label: "Show my QR", Icon: QrCode },
  "stripe-checkout": { label: "Open Stripe checkout", Icon: CreditCard },
};

type StoryStatus = "idle" | "verifying" | "verified";

// Cap the story screenshot at 5 MB. The verifier doesn't need a hi-res
// original and unconstrained file URLs can ruin the page on weak phones.
const MAX_STORY_BYTES = 5 * 1024 * 1024;

export function TicketSheet({
  item,
  onClose,
}: {
  item: SavedItem;
  onClose: () => void;
}) {
  const v = venueById(item.venueId);
  const [doneDots, setDoneDots] = useState(item.doneDots);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [storyUrl, setStoryUrl] = useState<string | null>(null);
  const [storyStatus, setStoryStatus] = useState<StoryStatus>("idle");
  const [storyFileName, setStoryFileName] = useState<string | null>(null);
  const [storyError, setStoryError] = useState<string | null>(null);
  const verifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (verifyTimerRef.current) clearTimeout(verifyTimerRef.current);
      if (storyUrl) URL.revokeObjectURL(storyUrl);
    };
  }, [storyUrl]);

  if (!v) return null;
  const type = getTicketType(item);
  const steps = workflowFor(type, item, v);
  const hasStory = type === "PSC" || type === "RPSC";
  const hasCashback =
    type === "PC" || type === "RPC" || type === "PSC" || type === "RPSC";
  const venueHandle = `@${v.id.replace(/-/g, "")}`;

  const markCurrentDone = () => {
    setDoneDots((n) => Math.min(n + 1, steps.length));
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleFile = (file: File) => {
    if (file.size > MAX_STORY_BYTES) {
      setStoryError(
        `That screenshot is ${(file.size / 1024 / 1024).toFixed(1)} MB — please pick one under 5 MB.`,
      );
      return;
    }
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      setStoryError("Use a PNG, JPG, or WEBP screenshot.");
      return;
    }
    setStoryError(null);
    if (storyUrl) URL.revokeObjectURL(storyUrl);
    const url = URL.createObjectURL(file);
    setStoryUrl(url);
    setStoryFileName(file.name);
    setStoryStatus("verifying");
    if (verifyTimerRef.current) clearTimeout(verifyTimerRef.current);
    verifyTimerRef.current = setTimeout(() => {
      setStoryStatus("verified");
    }, 1400);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) handleFile(file);
  };

  return (
    <div className="absolute inset-0 z-50 flex items-end">
      <div
        className="bg-foreground/40 absolute inset-0 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="bg-background shadow-elev relative z-10 flex h-[88%] w-full flex-col rounded-t-3xl">
        <div className="bg-foreground/30 mx-auto mt-2 mb-1 h-1 w-12 shrink-0 rounded-full" />

        <div className="scrollbar-hide flex-1 overflow-y-auto">
          <div className="relative px-4 pt-2">
            <div className="relative h-44 w-full overflow-hidden rounded-2xl">
              <Image
                src={v.photos[0]}
                alt={v.name}
                fill
                sizes="400px"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="bg-card/90 text-foreground absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full backdrop-blur"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="absolute right-4 bottom-3 left-4 text-white">
                <p className="text-[10px] font-semibold tracking-[0.18em] uppercase opacity-90">
                  {hasCashback ? "Cashback coupon" : "Reservation"}
                </p>
                <h2 className="font-display mt-1 text-3xl leading-tight font-semibold tracking-tight">
                  {v.name}
                </h2>
                <p className="mt-0.5 text-[12px] opacity-90">
                  {v.category} · {v.distanceKm} km
                </p>
              </div>
            </div>
          </div>

          <div className="px-4 pt-5">
            <div className="border-border bg-card flex items-center gap-3 rounded-2xl border p-4">
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground text-[11px] font-medium tracking-[0.18em] uppercase">
                  Cashback
                </p>
                <p className="font-display text-secondary mt-1 text-5xl leading-none font-bold">
                  {item.cashback ?? 0}
                  <span className="text-2xl">%</span>
                </p>
                <p className="text-muted-foreground mt-2 text-[12px]">
                  on every visit
                  {item.cashbackCap
                    ? ` · up to $${item.cashbackCap.toLocaleString()} MXN`
                    : ""}
                </p>
              </div>
              <div className="border-border bg-card flex h-24 w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border p-2">
                <div className="h-14 w-14 overflow-hidden">
                  <FakeQR seed={v.id} size={9} />
                </div>
                <p className="text-muted-foreground text-[9px] font-semibold tracking-wider uppercase">
                  Tap to pay
                </p>
              </div>
            </div>
          </div>

          <div className="px-4 pt-5">
            <div className="border-border bg-card rounded-2xl border p-4">
              <p className="text-muted-foreground text-[11px] font-medium tracking-[0.18em] uppercase">
                {hasCashback ? "Coupon details" : "Reservation details"}
              </p>
              <dl className="mt-3 flex flex-col gap-2.5 text-sm">
                {item.cashbackCap != null && (
                  <Row
                    label="Cap per visit"
                    value={`$${item.cashbackCap.toLocaleString()} MXN`}
                  />
                )}
                {item.reservationStatus && (
                  <Row
                    label="Reservation"
                    value={
                      <span
                        className={cn(
                          "font-semibold",
                          item.reservationStatus === "pending"
                            ? "text-secondary"
                            : "text-secondary",
                        )}
                      >
                        {item.reservationStatus === "pending"
                          ? "Pending (AI calling)"
                          : "Confirmed"}
                      </span>
                    }
                  />
                )}
                {item.when && <Row label="When" value={item.when} />}
                {item.partySize != null && (
                  <Row label="Party" value={`${item.partySize} consumers`} />
                )}
              </dl>
            </div>
          </div>

          {hasStory && (
            <div className="px-4 pt-5">
              <div className="border-border bg-card rounded-2xl border p-4">
                <div className="flex items-center justify-between">
                  <p className="text-muted-foreground text-[11px] font-medium tracking-[0.18em] uppercase">
                    Story evidence
                  </p>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      storyStatus === "verified"
                        ? "bg-primary/15 text-primary"
                        : "bg-secondary/15 text-secondary",
                    )}
                  >
                    {storyStatus === "verified" ? "Verified" : "Required"}
                  </span>
                </div>
                <p className="text-foreground mt-3 text-[13px] leading-relaxed">
                  <span className="font-semibold">
                    Instagram story required.
                  </span>{" "}
                  <span className="text-muted-foreground">
                    Post a story tagging{" "}
                    <span className="text-secondary">{venueHandle}</span> during
                    your visit to unlock the {item.cashback ?? 0}% cashback,
                    then upload a screenshot here — we verify the tag
                    automatically. No story · no cashback.
                  </span>
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={onFileChange}
                />
                {storyError && (
                  <p className="bg-destructive/10 text-destructive mt-3 rounded-lg px-3 py-2 text-[11px]">
                    {storyError}
                  </p>
                )}

                {storyUrl ? (
                  <div className="border-border bg-muted mt-3 overflow-hidden rounded-2xl border">
                    <div className="bg-foreground/5 relative h-56 w-full">
                      <Image
                        src={storyUrl}
                        alt="Story screenshot"
                        fill
                        sizes="400px"
                        className="object-contain"
                        unoptimized
                      />
                      <div className="bg-background/90 absolute top-3 left-3 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold backdrop-blur">
                        {storyStatus === "verifying" ? (
                          <>
                            <Loader2 className="text-secondary h-3 w-3 animate-spin" />
                            <span className="text-foreground">
                              Verifying tag…
                            </span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="text-primary h-3 w-3" />
                            <span className="text-foreground">
                              {venueHandle} tag detected
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <p className="text-muted-foreground min-w-0 flex-1 truncate text-[11px]">
                        {storyFileName ?? "screenshot.png"}
                      </p>
                      <button
                        type="button"
                        onClick={openFilePicker}
                        className="border-border bg-background text-foreground hover:bg-muted inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Replace
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={openFilePicker}
                    className="border-secondary/40 bg-secondary/5 hover:bg-secondary/10 mt-3 flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-5 text-center transition"
                  >
                    <span
                      className="flex h-12 w-12 items-center justify-center rounded-full text-white"
                      style={{
                        background:
                          "linear-gradient(135deg, oklch(0.70 0.20 30), oklch(0.65 0.22 0), oklch(0.55 0.18 320))",
                      }}
                    >
                      <Instagram className="h-5 w-5" />
                    </span>
                    <span className="text-sm font-semibold">
                      Attach story screenshot
                    </span>
                    <span className="text-muted-foreground text-[11px]">
                      PNG or JPG · must show the {venueHandle} tag
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="px-4 pt-5">
            <div className="border-border bg-card rounded-2xl border p-4">
              <p className="text-muted-foreground text-[11px] font-medium tracking-[0.18em] uppercase">
                Your progress
              </p>
              <ol className="mt-4 flex flex-col">
                {steps.map((step, i) => {
                  const done = i < doneDots;
                  const current = i === doneDots;
                  const isLast = i === steps.length - 1;
                  const action = step.action ? ACTION_META[step.action] : null;
                  return (
                    <li key={i} className="relative flex gap-3 pb-5">
                      {!isLast && (
                        <span
                          className={cn(
                            "absolute top-7 bottom-0 left-3.5 w-px",
                            done ? "bg-primary" : "bg-border",
                          )}
                          aria-hidden
                        />
                      )}
                      <span
                        className={cn(
                          "relative z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                          done && "bg-primary text-white",
                          current &&
                            "bg-primary ring-primary/15 text-white ring-4",
                          !done && !current && "bg-muted text-muted-foreground",
                        )}
                      >
                        {done ? (
                          <Check className="h-3.5 w-3.5" strokeWidth={3} />
                        ) : (
                          i + 1
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "text-[14px] leading-tight font-semibold",
                            done && "text-muted-foreground line-through",
                          )}
                        >
                          {step.title}
                        </p>
                        <p
                          className={cn(
                            "text-muted-foreground mt-1 text-[12px] leading-snug",
                            done && "line-through",
                          )}
                        >
                          {step.sub}
                        </p>
                        {action && (
                          <StepActionButton
                            actionId={step.action!}
                            actionLabel={action.label}
                            ActionIcon={action.Icon}
                            current={current}
                            storyStatus={storyStatus}
                            storyUploaded={!!storyUrl}
                            onAttach={openFilePicker}
                            onComplete={markCurrentDone}
                          />
                        )}
                        {step.forClarity && current && (
                          <button
                            type="button"
                            onClick={markCurrentDone}
                            className="border-foreground bg-card text-foreground hover:bg-muted mt-2 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition"
                          >
                            <Check className="h-3.5 w-3.5" strokeWidth={3} />
                            Done
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>

          <div className="px-4 py-5">
            <button
              type="button"
              onClick={onClose}
              className="border-border bg-card hover:bg-muted flex w-full items-center justify-center rounded-full border py-3 text-sm font-semibold transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepActionButton({
  actionId,
  actionLabel,
  ActionIcon,
  current,
  storyStatus,
  storyUploaded,
  onAttach,
  onComplete,
}: {
  actionId: string;
  actionLabel: string;
  ActionIcon: React.ComponentType<{ className?: string }>;
  current: boolean;
  storyStatus: StoryStatus;
  storyUploaded: boolean;
  onAttach: () => void;
  onComplete: () => void;
}) {
  const isAttach = actionId === "attach-screenshot";
  const attachVerifying = isAttach && storyStatus === "verifying";
  const attachReady = isAttach && storyStatus === "verified";
  const label = isAttach
    ? storyUploaded
      ? attachReady
        ? "Mark as done"
        : "Verifying screenshot…"
      : "Attach screenshot"
    : actionLabel;
  const Icon = isAttach && attachReady ? Check : ActionIcon;
  const disabled = !current || attachVerifying;
  const onClick = () => {
    if (!current) return;
    if (!isAttach) return;
    if (attachReady) {
      onComplete();
      return;
    }
    onAttach();
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "mt-2 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition",
        current && !disabled
          ? "border-foreground bg-foreground text-background hover:opacity-90"
          : "border-border bg-muted text-muted-foreground",
      )}
    >
      {attachVerifying ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Icon className="h-3.5 w-3.5" />
      )}
      {label}
    </button>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
