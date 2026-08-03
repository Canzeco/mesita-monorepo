# Ticket sequences (Tickets v2 — consumer-created self-check-in)

High-level flow map since MESITA-806 (2026-08-02). The code is the source of truth —
this doc names the sequence and points at the modules; don't mirror payload shapes or
rate numbers here.

**No staff account exists.** The waiter identity was retired (MESITA-833): there are no
waiter invites, no phone-pool onboarding and no PIN. Whoever holds the check URL can work
the ticket — that is the whole staff surface. The business console rail below is for
BUSINESS members (owner/editor/viewer), which is a different thing.

**The inversion:** the CONSUMER creates the ticket before any staff involvement
(`consumer-web-create-ticket`); staff-initiated creation (`business-web-create-ticket`)
is retired — never re-add it. The ticket's QR is `https://mesita.ai/check/<check_code>`
(public page — canonical home `apps/web-checkout`, checkout.mesita.ai pending; `apps/web-landing`
still serves live QRs until the URL flip, MESITA-813), and the staff side of the flow happens on
that page via the `check-web-*` EFs — `verify_jwt = false`; possession of the 128-bit
`check_code` IS the authentication (security model: `_shared/ticket-check.ts`).

## Sequences

### Create (consumer, in-app)
1. Guest picks the place and opts into the story rung (Influencer only — a non-eligible
   opt-in silently downgrades; the class never leaks). `consumer-web-create-ticket`.
2. App renders the QR → `mesita.ai/check/<code>`.

### Scan / check (staff, public check page)
1. Staff scan the QR → the check page renders live ticket state on an official Mesita
   domain (`check-web-get-ticket`; first view stamps `first_scanned_at`; re-scans are a
   feature). Response shaped only by the public allowlist — never class, rungs, or UUIDs.

### Billing (staff, check page)
1. Staff enter the check subtotal (`check-web-submit-bill`).
2. Welcome is detected server-side here (`isConsumerFirstVisit`) — never asserted at create.
3. Pricing = best-of `resolveTicketRate` over `rewards_config` × the place's posture;
   the page shows the discounted amount due. Accepted risk (stated in the EF header):
   the guest holds their own URL and can self-bill — Mesita moves no money, every
   submit is audit-logged.

### Story / review verification (staff, check page)
1. Staff approve or reject a SUBMITTED story/review on the page (`check-web-verify-action`);
   the AI verifier stays primary for public accounts — this is the human fallback.

### Discount payment (staff, check page)
1. Guest pays the discounted total at the table (passive instructions in-app; no payment
   button — discounts-only, Mesita never holds money).
2. Staff tap **Paid received** (`check-web-mark-paid`) → closes the ticket
   (`closeTicketAndEnqueueReview`), records first-honor for promo activation.

### Review (consumer, in-app)
1. Post-visit review (food, service, ambiance, overall + comments) after the close.

## Other rails (still live alongside the check page)

- **Business console** (`unit/[id]/tickets`): ticket list, bill form, cancel, mark-paid —
  `business-web-{list-tickets,submit-ticket-bill,mark-ticket-paid,cancel-ticket}`. Signed-in
  business members only — not a staff rail.

There is no staff WhatsApp rail. It identified the waiter by phone against
`project_roles`, and that identity no longer exists — don't re-add it.

## Implementation map

| Surface | Module |
|---------|--------|
| Consumer create + stepper | `consumer-web-create-ticket` · `apps/web-consumer/src/lib/ticket-flow-steps.ts` (mobile mirror in `apps/mobile-consumer`) |
| Public check page | `apps/web-check/src/app/check/[code]/` (landing mirror until MESITA-814) · `check-web-{get-ticket,submit-bill,verify-action,mark-paid}` |
| Shared security/billing | `_shared/ticket-check.ts` · `_shared/business-ticket-billing.ts` · `_shared/rewards-config.ts` |
| Business console | `apps/web-business/.../unit/[id]/tickets/` |

Ticket kinds/statuses: the `ticket_kind` / `ticket_status` / `story_status` enums in the
DB are the taxonomy SoT; consumer-visible milestones live in `ticket-flow-steps.ts`.
