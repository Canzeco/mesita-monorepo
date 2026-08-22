"use client";

import { useState, type ReactNode } from "react";
import { Mail, MessagesSquare, Phone } from "lucide-react";
import type { LookupMethods, LookupPlace } from "@/lib/api/verifications";
import { cn } from "@/lib/utils";
import { EmailBody } from "./create-place-verify-email";
import { PhoneBody } from "./create-place-verify-phone";
import { WhatsAppBody } from "./create-place-verify-whatsapp";
import type { VerificationCallbacks } from "./create-place-shared";

// ── Methods picker ────────────────────────────────────────────────────

// Three verification paths share the same parent card body. All three
// chips are always rendered — phone, email, and the manual "Talk to us"
// fallback — so operators see the full set of supported methods even
// when this specific place doesn't expose a Google-listed phone or a
// Firecrawl-discovered on-domain email. When the auto-method isn't
// available for the place, selecting its chip shows a short
// explanatory body that points to the manual fallback. The picker
// auto-lands on the first actionable method (phone → email → manual)
// so a bare listing opens straight on the WhatsApp/email panel.

type MethodKey = "phone" | "email" | "manual";

export function MethodsPicker({
  place,
  methods,
  ...callbacks
}: {
  place: LookupPlace;
  methods: LookupMethods;
} & VerificationCallbacks) {
  const initialMethod: MethodKey = methods.phone.available
    ? "phone"
    : methods.email.available
      ? "email"
      : "manual";

  const [method, setMethod] = useState<MethodKey>(initialMethod);

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-muted/70 grid auto-cols-fr grid-flow-col gap-1 rounded-2xl p-1">
        <MethodChip
          active={method === "phone"}
          unavailable={!methods.phone.available}
          onClick={() => setMethod("phone")}
        >
          <Phone className="h-4 w-4" />
          Phone
        </MethodChip>
        <MethodChip
          active={method === "email"}
          unavailable={!methods.email.available}
          onClick={() => setMethod("email")}
        >
          <Mail className="h-4 w-4" />
          Email
        </MethodChip>
        <MethodChip
          active={method === "manual"}
          onClick={() => setMethod("manual")}
        >
          <MessagesSquare className="h-4 w-4" />
          Talk to us
        </MethodChip>
      </div>

      {method === "phone" &&
        (methods.phone.available ? (
          <PhoneBody place={place} methods={methods} {...callbacks} />
        ) : (
          <MethodUnavailableBody method="phone" methods={methods} />
        ))}
      {method === "email" &&
        (methods.email.available ? (
          <EmailBody place={place} methods={methods} {...callbacks} />
        ) : (
          <MethodUnavailableBody method="email" methods={methods} />
        ))}
      {method === "manual" && <WhatsAppBody place={place} />}
    </div>
  );
}

// Shown when the operator selects an auto-verify chip (phone or email)
// that isn't available for this specific place — e.g. the GMB profile
// has no public phone, or no Firecrawl-discovered on-domain email.
// Keeps the chip visible so operators see the full supported set, and
// nudges them to the best next action: the other auto-method when it's
// available (still instant), otherwise the manual Talk-to-us path.
function MethodUnavailableBody({
  method,
  methods,
}: {
  method: "phone" | "email";
  methods: LookupMethods;
}) {
  const Icon = method === "phone" ? Phone : Mail;
  const title =
    method === "phone" ? "Phone check unavailable" : "Email check unavailable";
  const what =
    method === "phone"
      ? "a public phone number on Google"
      : "a verified email on the place's website";

  // Pick the best alternative the operator can take right now. We
  // prefer the other instant auto-method (Phone/Email) when its data
  // is available for this place, and only fall back to the manual
  // path when both auto-methods are out of reach.
  const alternative =
    method === "phone" && methods.email.available
      ? { label: "Email", detail: "the code lands instantly when it clears." }
      : method === "email" && methods.phone.available
        ? { label: "Phone", detail: "the code lands instantly when it clears." }
        : {
            label: "Talk to us",
            detail: "we'll verify ownership manually within minutes.",
          };

  return (
    <div className="border-border bg-muted/30 flex items-start gap-3 rounded-2xl border p-4">
      <span className="bg-muted text-muted-foreground mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-foreground text-[13px] font-semibold">{title}</p>
        <p className="text-muted-foreground mt-1 text-[12.5px] leading-relaxed">
          We couldn&apos;t find {what} for this place. Use{" "}
          <span className="text-foreground font-medium">
            {alternative.label}
          </span>{" "}
          — {alternative.detail}
        </p>
      </div>
    </div>
  );
}

function MethodChip({
  active,
  unavailable,
  onClick,
  children,
}: {
  active: boolean;
  // Renders the chip as a dimmed glyph when the auto-method isn't
  // available for the place. The chip still clicks through so the
  // MethodUnavailableBody can explain — we just want the picker row to
  // signal "this one's not applicable here" at a glance.
  unavailable?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition",
        active
          ? "bg-card text-foreground ring-foreground/5 shadow-md ring-1"
          : "text-muted-foreground hover:text-foreground",
        unavailable && !active && "opacity-55",
      )}
    >
      {children}
    </button>
  );
}
