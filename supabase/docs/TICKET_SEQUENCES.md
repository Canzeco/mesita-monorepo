# Ticket sequences (Tickets v2 — consumer-created self-check-in)

High-level flow map since MESITA-806 (2026-08-02). The code is the source of truth —
this doc names the sequence and points at the modules; don't mirror payload shapes or
rate numbers here.

**No staff account exists.** The waiter identity was retired (MESITA-833): there are no
waiter invites, no phone-pool onboarding and no PIN. Whoever holds the check URL can work
the ticket — that is the whole staff surface. The business console rail below is for
BUSINESS members (owner/editor/viewer), which is a different thing.

**The inversion (v3, MESITA-849):** the CONSUMER creates the ticket AND completes every
task before any staff involvement — the floor never adjudicates a story or a review.
Staff-initiated creation
(`business-web-create-ticket`) is retired — never re-add it, and neither the check page nor
the business console carries a story/review verdict any more
(`check-web-verify-action`, `business-web-verify-story`, `business-web-verify-review` and the
`awaiting_story` park are all gone). The ticket's QR is `https://check.mesita.ai/<check_code>`
(public page — canonical home `apps/web-check`; `CHECK_URL_BASE` flipped MESITA-814;
old `mesita.ai/check/<code>` QRs permanently redirect via web-landing), and the staff side of the flow happens on
that page via the `check-web-*` EFs — `verify_jwt = false`; possession of the 128-bit
`check_code` IS the authentication (security model: `_shared/ticket-check.ts`).

## Sequences

### Create (consumer, in-app)
1. Guest picks the place and opts into the story rung (any class with a connected
   Instagram — MESITA-909; a non-eligible opt-in silently downgrades; the class
   never leaks). `consumer-web-create-ticket`.
2. App renders the QR → `check.mesita.ai/<code>`.

### Tasks (consumer, in-app — BEFORE any staff involvement)
1. The guest completes their tasks on the pass: Instagram story
   (`consumer-web-submit-story`, gated on `instagram_handle` — MESITA-909) and/or
   Google review (`consumer-web-submit-review`), plus the Mesita review
   (`consumer-web-submit-ticket-review`).
2. Their tap IS the verification — each lands `self_verified` (MESITA-849). There is no
   screenshot, no queue and no staff verdict: nothing in this product reads Instagram or
   Google, and the follower count behind the Influencer class is self-declared too, so a
   staff member judging a screenshot was adjudicating an unverifiable claim. The place
   applies the discount in front of the guest and can refuse.
3. Completing a task after the bill re-prices the ticket UPWARD only
   (`repriceTicketAfterAction`); before the bill, pricing already includes it.

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

### Discount payment (staff, check page)
1. Guest pays the discounted total at the table (passive instructions in-app; no payment
   button — discounts-only, Mesita never holds money).
2. Staff tap **Paid received** (`check-web-mark-paid`) → closes the ticket
   (`closeTicketAndEnqueueReview`), records first-honor for promo activation.

### Review (consumer, in-app)
1. The Mesita review (food, service, ambiance, value, overall + comments) is a TASK, not a
   post-visit epilogue — it is open from the moment the ticket exists and stays open
   through the close. One review per account per place (MESITA-825), updatable.

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
| Consumer tasks | `consumer-web-{submit-story,submit-review,submit-ticket-review}` · `apps/web-consumer/.../rewards/VenuePassModal.tsx` |
| Public check page | `apps/web-check/src/app/[code]/` (legacy `/check` + landing 308 for old `mesita.ai/check/<code>` QRs) · `check-web-{get-ticket,submit-bill,mark-paid}` |
| Shared security/billing | `_shared/ticket-check.ts` · `_shared/business-ticket-billing.ts` · `_shared/rewards-config.ts` |
| Business console | `apps/web-business/.../unit/[id]/tickets/` |

Ticket kinds/statuses: the `ticket_kind` / `ticket_status` / `story_status` enums in the
DB are the taxonomy SoT; consumer-visible milestones live in `ticket-flow-steps.ts`.
