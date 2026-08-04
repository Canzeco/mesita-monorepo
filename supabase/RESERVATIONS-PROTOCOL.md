# Reservations — the lifecycle protocols

Every timing rule the Reservationist obeys, in one place — the ONE protocol across all four agents. A reservation is not
one conversation: it is **several independent legs**, each of which needs its
own answer to *"what happens when this doesn't work?"* **Two of the six have
that answer. Four do not** — and a leg without one stops silently, forever.
Those gaps are marked ⛔ below. Everything here was read out of the code, not
invented, so nobody has to re-derive it from the engine; the proposed cadences
are labelled as proposals precisely because they are product calls.

Code is the source of truth. Where this file and the code disagree, the code
wins and this file is stale — fix it in the same session.

- Engine: `functions/supabase-edgefunc-reservation-call/index.ts`
- Retry math: `functions/_shared/reservation-retry.ts`
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

## Leg 3 · Confirmation — a2 phones the guest ⛔ NO PROTOCOL

**One shot. No retry, no cap, no schedule, nothing.**

The engine writes `callback_state` (`ringing` → `answered` / `no_answer` /
`failed` / `unknown` / `skipped`) and **nothing ever reads it again**. The
retry cron selects only `attempts_state='scheduled'`, which is leg 1; there is
no `callback_next_attempt_at` and no cron that considers the callback at all.

Consequences, all currently live:

- **Guest doesn't answer** → the venue has confirmed the table and the guest is
  never told. Ticket sits `pending` forever.
- **Guest answers but doesn't decide** (hears the alternatives, says "let me
  think") → `callback_state='answered'` and the ticket is inert. Observed on
  ticket `55011809`.
- **Call fails to place** → `callback_state='failed'`, same dead end.

### Proposed (NOT IMPLEMENTED — needs Pato's call on cadence)

Calling a customer is an annoyance budget, so the numbers are a product
decision, not an engineering one. A sane default to argue with:

| | |
| --- | --- |
| Attempt 1 | Immediately when the venue verdict lands (today's behaviour). |
| Attempt 2 | **+10 min** on no-answer. |
| Attempt 3 | **+1 h**, and only while the reservation is still more than 2 h away. |
| Cap | **3**, then stop calling and fall back to the app — the guest is never rung a fourth time. |
| Quiet hours | Never dial the guest outside **09:00–22:00 venue-local**; hold until the window opens. |
| Close to service | Inside 2 h of `reserved_at`, stop calling entirely and leave it in-app — a call that lands after the table time is worse than none. |

Implementing it needs a `callback_next_attempt_at` column plus one more branch
in the existing retry cron, which already runs every minute.

## Leg 4 · Expiry — a ticket whose time has passed ⛔ PARTIAL

**`passed` is fine.** It is *derived* in the consumer app
(`confirmed` + slot behind us + 4 h grace — you may still be at the table),
deliberately never written by a cron, and the Upcoming/History split uses the
same rule. Don't "fix" that by adding a writer.

**A stuck `pending` ticket is the gap.** Nothing terminalises one whose
`reserved_at` has gone by, and `pending` is not in the "not booked" set
(`declined` · `unreachable` · `unresolved` · `no_show`), so it renders as
*booking* forever — the guest is told Mesita is on the phone about a dinner
that happened last night. The enum has `no_show` and **nothing writes it**.

Proposed: a sweeper on the existing minute cron moving `pending` past
`reserved_at + 4 h` to `unresolved` (never agreed), and `confirmed` past the
same window to `no_show` only once there is a signal the guest didn't turn up
— absent that signal, leave `confirmed` alone and let `passed` derive.

## Leg 5 · Guest cancels a table the venue is HOLDING ⛔ NO PROTOCOL

**Nobody tells the venue. Ever.**

There are three guest-side cancel doors — `consumer-web-cancel-reservation`
(app), `eleven-a2-cancel-reservation` (on the confirmation call),
`eleven-a3-cancel-reservation` (inbound line) — and **not one of them contacts
the venue**. When the table was already `confirmed`, the venue is holding it
for a party that will never arrive. Mesita made that booking by phone, so from
the restaurant's side this is Mesita generating no-shows. It is the most
reputation-damaging gap in the system, and the cheapest to close.

### Proposed
- Fires **only** when the ticket was `confirmed` (nothing to release
  otherwise — never ring a venue to cancel something it never agreed to).
- Reuses **a1**, not a new agent: same c2b outbound direction, with
  `call_context="cancellation"` and a release branch in its graph.
- Same retry shape as leg 1 (2 attempts, open-hours aware) — a release is less
  urgent than a booking but still time-sensitive; unreached after the cap
  leaves a flag for ops rather than failing silently.
- Never blocks the cancel itself: the guest's cancellation is instant and
  local; the courtesy call is a background consequence.

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
| Mesita → venue | **a1** | `booking` · `cancellation` *(new)* |
| Mesita → guest | **a2** | `confirmation` · `counter_offer` · `cancelled_by_venue` *(new)* |
| guest → Mesita | **a3** | inbound support |
| venue → Mesita | **a4** | inbound support |

Every outbound leg then wants the same four answers, and the two that exist
already answer them: **when does attempt 1 fire · when does a retry fire · how
many attempts · what happens at the cap.** A leg without those four answers is
a leg that stops silently, which is exactly how legs 3, 5 and 6 got lost.

Implementation order by real-world harm:
1. **Leg 5** — Mesita is currently generating no-shows at venues.
2. **Leg 3** — venue confirmed, guest never learns.
3. **Leg 6** — guest shows up to a cancelled table.
4. **Leg 4** — cosmetic: stuck tickets read "booking" forever.

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
