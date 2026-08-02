# Ticket sequences (Tickets v2 — consumer-created self-check-in)

High-level flow map since MESITA-806 (2026-08-02). The code is the source of truth —
this doc names the sequence and points at the modules; don't mirror payload shapes or
rate numbers here.

**The inversion:** the CONSUMER creates the ticket before any staff involvement
(`consumer-web-create-ticket`); staff-initiated creation (`business-web-create-ticket`)
is retired — never re-add it. The ticket's QR is `https://mesita.ai/check/<check_code>`
(public page in `apps/web-landing`), and the staff side of the flow happens on that
page via the `check-web-*` EFs — `verify_jwt = false`; possession of the 128-bit
`check_code` IS the authentication (security model: `_shared/ticket-check.ts`).

## Sequences

### Create (consumer, in-app)
1. Guest picks the place and opts into the story rung (Influencer only — a non-eligible
   opt-in silently downgrades; the class never leaks). `consumer-web-create-ticket`.
2. App renders the QR → `mesita.ai/check/<code>`.

### Scan / check (staff, public check page)
1. Waiter scans the QR → the check page renders live ticket state on an official Mesita
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
2. Waiter taps **Paid received** (`check-web-mark-paid`) → closes the ticket
   (`closeTicketAndEnqueueReview`), records first-honor for promo activation.

### Review (consumer, in-app)
1. Post-visit review (food, service, ambiance, overall + comments) after the close.

## Other staff rails (still live alongside the check page)

- **Business console** (`unit/[id]/tickets`): ticket list, bill form, cancel, mark-paid —
  `business-web-{list-tickets,submit-ticket-bill,mark-ticket-paid,cancel-ticket}`.
- **Staff WhatsApp** (`business-whats-handle-message` + `_shared/staff-whatsapp-*`):
  conversational scan/bill/payment-confirm rail.

## Implementation map

| Surface | Module |
|---------|--------|
| Consumer create + stepper | `consumer-web-create-ticket` · `apps/web-consumer/src/lib/ticket-flow-steps.ts` (mobile mirror in `apps/mobile-consumer`) |
| Public check page | `apps/web-landing/src/app/check/[code]/` · `check-web-{get-ticket,submit-bill,verify-action,mark-paid}` |
| Shared security/billing | `_shared/ticket-check.ts` · `_shared/business-ticket-billing.ts` · `_shared/rewards-config.ts` |
| Business console | `apps/web-business/.../unit/[id]/tickets/` |
| Staff WhatsApp | `_shared/staff-whatsapp-flow.ts` |

Ticket kinds/statuses: the `ticket_kind` / `ticket_status` / `story_status` enums in the
DB are the taxonomy SoT; consumer-visible milestones live in `ticket-flow-steps.ts`.
