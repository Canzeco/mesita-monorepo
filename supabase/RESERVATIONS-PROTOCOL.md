# Reservations — the lifecycle protocols

Every timing rule the Reservationist obeys, in one place — the ONE protocol across all four agents. A reservation is not
one conversation: it is **several independent legs**, each of which needs its
own answer to *"what happens when this doesn't work?"* **All six now have
one** (legs 3–6 shipped 2026-08-04). Everything here is read out of the code,
not invented, so nobody has to re-derive it from the engine.

Code is the source of truth. Where this file and the code disagree, the code
wins and this file is stale — fix it in the same session.

- Engine: `functions/supabase-edgefunc-reservation-call/index.ts` — intents
  `book` · `callback_retry` · `cancel_notice`
- Waker: `functions/supabase-cron-reservation-retries/index.ts` (pg_cron, 1 min)
- Venue pacing: `functions/_shared/reservation-retry.ts` (opening hours)
- Guest pacing: `functions/_shared/reservation-callback.ts` (the ladder)
- Guest answer: `functions/eleven-a2-confirm-reservation/index.ts`
- Offers: `functions/_shared/reservation-alternatives.ts`

---

## Leg 1 · Booking — a1 phones the venue ✅ HAS A PROTOCOL

| | |
| --- | --- |
| **Attempt 1** | Immediately when the guest taps Reserve, **whatever the hour** — many venues run a 24/7 AI receptionist, and a closed line is itself information. |
| **Attempt 2** | **+5 min** if the venue is open right now · **~30 min after it next opens** if closed. |
| **Cap** | **2** (`ATTEMPTS`, fixed by protocol — the admin config accepts an `attempts` value and deliberately ignores it). |
| **How it waits** | An edge run can't sleep 30 minutes, so the engine **parks**: `attempts_state='scheduled'` + `next_attempt_at`. pg_cron `run-reservation-retries` (every minute) → `supabase-cron-reservation-retries` wakes it. |
| **Hours source** | `places.hours` + longitude → venue-local clock (`_shared/local-time.ts`), the same interpretation the recommenders use. |
| **Terminal** | Cap reached with no answer → `status='unreachable'`. |

Verdicts a1 can report (`a1_report_outcome`): `confirmed` · `counter_offer` ·
`declined` · `unreachable` · `wrong_number`.

- **`unreachable`** — voicemail, IVR dead end, endless hold, "call back later".
  Never got to ask, so it **retries exactly like a no-answer**.
- **`wrong_number`** — answered, but not this venue. **Terminal immediately and
  deliberately not retryable**: redialling only rings the same stranger.
- An answered call that ends with **no** report falls back to the post-call
  analysis heuristic and goes terminal. That is why every spoken path in a1's
  graph funnels through exactly one report node.

## Leg 2 · Negotiation — the counter-offer loop ✅ HAS A PROTOCOL

| | |
| --- | --- |
| **Cap** | **2 rounds** (`MAX_NEGOTIATION_ROUNDS`). |
| **Past the cap** | Parked in-app (`parked: true`) — noted on the ticket, no more calls. |
| **Shortcut** | If the guest picks a slot **the venue itself offered**, it is confirmed on the spot: no second venue call, no callback, no round consumed (`matchesOffer`). a1's close asks the venue to hold its offers, so this acts on a promise the venue made. |
| **New proposal** | A time the venue never offered re-fires leg 1 with the new terms. |

## Leg 3 · Confirmation — a2 phones the guest ✅ HAS A PROTOCOL

| | |
| --- | --- |
| **Attempt 1** | Immediately when the venue verdict lands. |
| **Attempt 2** | **+10 min** on no-answer. |
| **Attempt 3** | **+1 h**. |
| **Cap** | **3** (`GUEST_CALL_MAX_ATTEMPTS`) — then the app is the fallback, never a fourth ring. |
| **Quiet hours** | No guest call outside **09:00–22:00 venue-local**… unless the slot is **< 6 h away** (the news can't wait). |
| **Cutoff** | Nothing scheduled past `reserved_at − 30 min` — a call after the table time is worse than none. |
| **How it waits** | `callback_state='scheduled'` + `callback_next_attempt_at`; the minute cron re-fires the engine with intent `callback_retry`. |
| **Answered but undecided** | `callback_state='answered'` — deliberately NOT retried. The guest heard the options and said "let me think"; ringing them again is nagging, and their pick lands via a2's tool or the app. |

The ladder lives in `_shared/reservation-callback.ts` (pure, tested). A fresh
errand (new booking run, negotiation re-fire, reschedule) resets it to zero.

## Leg 4 · Expiry — a ticket whose time has passed ✅ HAS A PROTOCOL

**`passed` stays derived.** The app computes it (`confirmed` + slot behind us
+ 4 h grace) and no cron writes it — don't "fix" that.

**Stuck `pending` now expires.** The minute cron moves any `pending` ticket
4 h past `reserved_at` (and not mid-run) to `unresolved`, so the app stops
claiming Mesita is on the phone about last night's dinner. `confirmed` rows
are never touched — `no_show` stays unwritten until there is a real signal
the guest didn't turn up.

## Leg 5 · Guest cancels a table the venue is HOLDING ✅ HAS A PROTOCOL

All four guest-side cancel doors (`consumer-web-cancel-reservation`,
`eleven-a2-cancel-reservation`, `eleven-a3-cancel-reservation`, and
`cancelTicket` behind them) now owe the venue a call when — and only when —
the ticket was **`confirmed`**: never ring a venue to cancel something it
never agreed to.

| | |
| --- | --- |
| **Who calls** | **a1**, `call_context="cancellation"` — an aviso, not a booking: no negotiating, no tools, voicemail counts (it's the venue's own line). |
| **State** | `notice_kind='venue_cancel'` + `notice_state` pending → running → done/failed; engine intent `cancel_notice`. |
| **Pacing** | Attempt 1 immediately; retry by the venue's own hours (`nextAttemptAt`), cap **2**; exhausted → `notice_state='failed'`, visible for ops. |
| **Never blocks** | The guest's cancel is instant and local; the courtesy call is a background consequence. A lost engine invoke is swept up by the cron (`notice_state='pending'`). |

## Leg 6 · Venue cancels — telling the guest ✅ HAS A PROTOCOL

`eleven-a4-cancel-reservation`'s `guest_needs_notification` flag is no longer
a dead letter: the venue-side cancel owes `notice_kind='guest_cancel'` and
**a2** rings the guest with `call_context="cancelled_by_venue"` — the news
with tact, an apology from Mesita, and the app for rebooking. Identity is
still verified before any detail is spoken. Pacing: the guest ladder (leg 3)
— immediately, +10 min, +1 h, cap 3, quiet hours, urgent-waiver when the slot
is close. The *"business never calls the consumer"* rule has its relay.

## Leg 6 · Venue cancels — telling the guest ⛔ DECLARED, NOT BUILT

`eleven-a4-cancel-reservation` returns `guest_needs_notification: true` and its
header says *"the guest-notification flow (b2c) is the follow-up consumer of
this record"*. **There is no such consumer.** Nothing reads the flag, so a
venue cancelling through the inbound line leaves the guest believing they have
a table.

This also breaks the routing rule the whole product rests on — *the business
never calls the consumer directly* — because the relay that makes that rule
workable doesn't exist.

### Proposed
Reuse **a2** with `call_context="cancelled_by_venue"`: relay the cancellation,
apologise, point at the app for rebooking. Persist the flag as a real column
(it is currently only in a tool response, so it dies with the HTTP call) and
drive it from the same minute cron as the other legs.

---

## The shape this converges on

Four agents, **two outbound legs**, and a `call_context` that says which
errand each call is running. Adding a5/a6 would multiply agent config for no
gain — the direction is what's fixed, the errand is data:

| Direction | Agent | `call_context` values |
| --- | --- | --- |
| Mesita → venue | **a1** | `booking` · `cancellation` |
| Mesita → guest | **a2** | `confirmation` · `counter_offer` · `cancelled_by_venue` |
| guest → Mesita | **a3** | inbound support |
| venue → Mesita | **a4** | inbound support |

Every outbound leg answers the same four questions: **when does attempt 1
fire · when does a retry fire · how many attempts · what happens at the cap.**
A leg without those four answers is a leg that stops silently — which is
exactly how legs 3, 5 and 6 were lost the first time. Hold every future leg
to this checklist.

---

## Status vocabulary

`reservation_status`: `pending` · `confirmed` · `declined` · `no_show` ·
`cancelled` · `unreachable` · `unresolved`.
Consumer-facing phases: created → booking → confirmed → passed
(or cancelled / not booked).

## The UI overstates a parked ticket

While leg 1 is parked, the consumer app says *"Mesita is on the phone with the
place — you'll see the answer here."* It is not on the phone; it may be waiting
**37 hours** for the venue to open. The copy should reflect `attempts_state`:
`running` = on the phone · `scheduled` = waiting for the venue to open, with
the time · `exhausted` = we couldn't reach them.
