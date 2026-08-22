import { Mail, MessageCircle } from "lucide-react";
import type { LookupPlace } from "@/lib/api/verifications";

// Mesita ops contact channels. Direct fallback for ownership claims
// that can't be auto-verified by phone or email. WhatsApp is the
// LATAM-friendly primary; email is the universal fallback for regions
// where WhatsApp isn't dominant (US, most of Europe) and also the
// natural channel when the operator needs to attach proof documents
// (business license, utility bill, staff photo with signage).
// Hardcoded so the "Talk to us" buttons always work regardless of
// Supabase env config.
const MESITA_OPS_WHATSAPP_E164 = "+524445499597";
const MESITA_OPS_EMAIL = "hello@mesita.ai";

// Always-available manual path. Opens a wa.me deep-link OR a mailto:
// with a prefilled claim message to Mesita ops. No DB row, no admin
// queue — ops handles the conversation directly. Phone/email
// auto-verify remain the happy paths; this is the fallback when
// neither is available or when the operator wants a human.
//
// WhatsApp is the primary CTA (LATAM-friendly, where most operators
// live), and email is the universal secondary — better for regions
// where WhatsApp isn't dominant (US, most of Europe) and also the
// natural channel when ops asks the operator to attach proof of
// ownership (business license, utility bill, staff photo with signage).
export function WhatsAppBody({ place }: { place: LookupPlace }) {
  const waNumber = MESITA_OPS_WHATSAPP_E164.replace(/[^\d]/g, "");
  const waMessage = `Hi Mesita — I'd like to claim "${place.name}" on Mesita. Place ID: ${place.id}.`;
  const waHref = `https://wa.me/${waNumber}?text=${encodeURIComponent(waMessage)}`;

  const emailSubject = `Claim "${place.name}" on Mesita`;
  const emailBody = `Hi Mesita team,\n\nI'd like to claim "${place.name}" on Mesita.\n\nPlace ID: ${place.id}\n\nHappy to share proof of ownership (business license, utility bill, or a staff photo with signage) if helpful.\n\nThanks,`;
  const mailHref = `mailto:${MESITA_OPS_EMAIL}?subject=${encodeURIComponent(
    emailSubject,
  )}&body=${encodeURIComponent(emailBody)}`;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-[13px] leading-relaxed">
        Reach our team and we&apos;ll verify ownership manually — we usually
        reply within minutes, and never more than one business day.
      </p>
      <a
        href={waHref}
        target="_blank"
        rel="noreferrer"
        className="bg-whatsapp flex h-14 items-center justify-center gap-2 rounded-full text-base font-semibold text-white transition hover:opacity-90"
      >
        <MessageCircle className="h-5 w-5" />
        Talk to us on WhatsApp
      </a>
      <a
        href={mailHref}
        className="border-border bg-card text-foreground hover:bg-muted/50 flex h-14 items-center justify-center gap-2 rounded-full border text-base font-semibold transition"
      >
        <Mail className="h-5 w-5" />
        Email {MESITA_OPS_EMAIL}
      </a>
    </div>
  );
}
