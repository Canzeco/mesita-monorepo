# Reservations — the lifecycle protocols

Every timing rule the Reservationist obeys, in one place — ONE protocol across
the four agents. A reservation is not one conversation: it is **independent
legs**, each with its own answer to *"what happens when this doesn't work?"*
All six shipped legs have that answer (2026-08-04, PRs #607 + the hardening
round); legs 7–8 are **designed, not built** and say so.

**Precedence (one rule, three homes):** code is the source of truth; this file
is the code-level mirror and loses to the code; the Notion 🍽️ Reservations
page is the product-level narrative and loses to this file. Fix drift in the
same session you find it.

- Engine: `functions/supabase-edgefunc-reservation-call/index.ts` — intents
  `book` · `callback_retry` · `cancel_notice`
- Waker: `functions/supabase-cron-reservation-retries/index.ts` (pg_cron, 1 min)
- Place pacing: `functions/_shared/reservation-retry.ts` (opening hours)
- Guest pacing: `functions/_shared/reservation-callback.ts` (the ladder)
- Run discipline: `functions/_shared/reservation-run.ts` (platform failures,
  outage backoff, notice caps)
- Guest answer: `functions/eleven-a2-confirm-reservation/index.ts`
- Offers: `functions/_shared/reservation-alternatives.ts`

---

## Run discipline — the rules under every leg

**run_id (generation token).** Every engine claim rotates `run_id` and stamps
`claimed_at`; every background write is guarded `.eq(run_id)` and the runner
ABORTS on zero rows — before its next call, because a placed call can't be
recalled. Every user door (cancel, reschedule, console confirm/decline)
rotates `run_id` too, so an in-flight run is **orphaned** the instant the user
acts. The token also rides every outbound call as a bound dynamic variable:
`eleven-a1-report-outcome` / `eleven-a2-confirm-reservation` /
`eleven-a2-cancel-reservation` ignore writes from a stale call (`stale_run:
true`, the agent wraps up gracefully). Claims are compare-and-swap — two
concurrent invokes can never double-dial.

**Platform failures never burn attempts.** A call fails two ways: the OTHER
SIDE didn't answer (a protocol event — charge the attempt) or the PLATFORM
killed it (quota error 1002, 5xx, network — our outage). The engine
classifies both the placement failure (HTTP status) and the failed
conversation (`metadata.error.code`); platform failures park on their own
clock — `outage_retries`, 15 min doubling to 4 h, ±20% jitter so a recovered
platform isn't re-slammed, **cap 8** then a badge-visible error. The protocol
ladders resume untouched when the platform recovers.

**The reaper.** A worker that dies mid-run (deploy, ~400s wall) leaves
`running`/`calling`/`ringing` states no crash handler can reach. The cron
reaps any claim older than **10 minutes** back to `scheduled`, due now,
attempts intact. Zombies self-heal within a minute of going stale.

**Sweep order is load-bearing.** The cron buries dead work before waking live
work: 1) expiry, 2) moot notices, 3) reaper, 4) wakes — and every wake is
`reserved_at`-bounded, so recovery after a cron outage can never dial a place
about a slot that already passed.

**Abuse & cost guards** (`reservations_config.limits`, admin-tunable): every
unit of abuse here is a metered phone call. Reschedules: **3 per ticket per
day** (each one resets `call_attempts` = buys place calls). Place calls:
**10 per place per day** (bookings + notices share the meter,
`reservation_call_counters` + an atomic bump function). **Kill switch**: a
hard stop on ALL outbound reservation calls — everything parks and resumes
within a minute of flipping it back.

**Ops surface.** `notice_state='failed'`, `attempts_state='error'`,
`callback_state='failed'`, and confirmed-but-unheard guests feed the
**Needs attention** list on the admin Reservations Config page — the reader
this protocol's failure states report to. A state nobody reads stops
silently; that sentence is why this file exists.

---

## Leg 1 · Booking — a1 phones the place ✅

| | |
| --- | --- |
| **Attempt 1** | Immediately when the guest taps Reserve, **whatever the hour** — many places run a 24/7 AI receptionist, and a closed line is itself information. |
| **Attempt 2** | **+5 min** if the place is open right now · **~30 min after it next opens** if closed. |
| **Cap** | **2** (`ATTEMPTS`, fixed by protocol — the admin config accepts an `attempts` value and deliberately ignores it). |
| **How it waits** | Parks: `attempts_state='scheduled'` + `next_attempt_at`; the minute cron wakes it. |
| **Hours source** | `places.hours` + longitude → place-local clock (`_shared/local-time.ts` + `local-time-open.ts`) — the one open-now reading every caller shares (Memo reads the same helpers). |
| **Terminal** | Cap with no answer → `status='unreachable'`. |

Verdicts a1 reports (`a1_report_outcome`): `confirmed` · `counter_offer` ·
`declined` · `unreachable` (retries like a no-answer) · `wrong_number`
(terminal — redialling rings the same stranger). An answered call with no
report falls to the analysis heuristic and goes terminal, which is why every
spoken path funnels through exactly one report node.

## Leg 2 · Negotiation — the counter-offer loop ✅

**2 rounds** (`MAX_NEGOTIATION_ROUNDS`), then parked in-app. Shortcut: a slot
the place ITSELF offered confirms on the spot (`matchesOffer`, structured
`{time, date?, note?}` alternatives) — no second place call, no round burned;
a1's close asks the place to hold its offers so this acts on a promise
already made. Genuinely new proposals re-fire leg 1.

## Leg 3 · Confirmation — a2 phones the guest ✅

| | |
| --- | --- |
| **Ladder** | Immediately when the verdict lands · **+10 min** · **+1 h** · **cap 3** — never a fourth ring. |
| **Quiet hours** | No guest call outside **09:00–22:00 place-local**, waived when the slot is **< 6 h** away. |
| **Cutoff** | Nothing past `reserved_at − 30 min`. |
| **How it waits** | `callback_state='scheduled'` + `callback_next_attempt_at` → cron → intent `callback_retry`. |
| **Answered-undecided** | Deliberately NOT retried — an undecided guest is not an unreached one. |

A **console confirm** (`business-web-confirm-reservation`) seeds this same
ladder (~10 min out, quiet-hours safe) — both confirm doors converge on the
identical guest experience. Fresh errand = fresh ladder.

**Guest notify preference (MESITA-787):** `reservations.guest_notify` is
`call` (default) or `app`. When `app`, every a2 guest-facing errand is skipped
(confirm, counter-offer, cancel notice, callback_retry) and the ticket is the
notification; console confirm does not seed the ladder. Guests accept
confirmations / place alternatives in-app via
`consumer-web-confirm-reservation`.

## Leg 4 · Expiry ✅

`pending` 4 h past `reserved_at` → `unresolved` in the cron (never touching a
mid-flight run). `passed` stays **derived** in the app — don't add a writer.
`confirmed` is never expired; `no_show` stays unwritten until leg 8 exists.

## Leg 5 · Guest cancels a table the place is HOLDING ✅

All four cancel doors (`consumer-web-cancel-reservation` +
`eleven-a2/a3-cancel-reservation`, all through `cancelTicket`) owe the place a
call when — and only when — the ticket was **`confirmed`**: never ring a place
to cancel what it never agreed to.

| | |
| --- | --- |
| **Who calls** | **a1**, `call_context="cancellation"` — an aviso: no booking, no tools, voicemail counts (it's the place's own line). |
| **State** | `notice_kind='venue_cancel'`, `notice_state` pending → running → done/failed. Engine intent `cancel_notice`. |
| **Pacing** | Attempt 1 immediately; retry by the place's hours, cap **2** (`noticeNextAt`); exhausted → `failed`, badge-visible. |
| **Never blocks** | The cancel is instant and local; the call is a background consequence. A lost invoke is swept as `notice_state='pending'`. |

## Leg 6 · Place cancels — telling the guest ✅

`eleven-a4-cancel-reservation` owes `notice_kind='guest_cancel'`; **a2** rings
the guest with `call_context="cancelled_by_venue"` — identity before any
detail, the news with tact, an apology, the app for rebooking. Pacing: the
guest ladder. **A guest VOICEMAIL is not a told guest**: a voicemail-answered
notice takes one more ladder rung before delivery is claimed (the place side
keeps voicemail=delivered — their own line, message stands). The *"business
never calls the consumer"* rule has its relay.

## Reschedule of a CONFIRMED table = a MODIFICATION

The place holds a live table, so a1 doesn't ask like a stranger: `call_context
="modification"` — *move the existing booking* (old slot rides
`modification_of` + dynamic vars). If the place can't do the change, a1 asks
them to cancel the old booking too (→ `declined`, both slots settled). If the
run **exhausts unreachable**, the old hold is released through leg 5's
machinery (`notice_kind='venue_cancel'` speaking the OLD slot). A confirmed
modification clears `modification_of` — the place moved it on that very call.
Reschedules are capped (guards above) and rotate `run_id`.

---

## Legs 7–8 · DESIGNED, NOT BUILT — do not assume live

**Leg 7 · The reminder call** (the industry's no-show killer). a2 rings the
guest ~3 h before the slot: *"¿sigue en pie?"* — confirm / reschedule / cancel
reuse the existing a2 tools verbatim. Config-gated OFF by default
(`reservations_config.reminder`, to be added at build time): +1 call per
confirmed reservation is the single biggest volume increase in the system and
gets flipped deliberately. Quiet-hours rule: reminders NEVER use the < 6 h
urgent waiver (a T-3h reminder for a 9 a.m. table must not ring at 6 a.m.);
a reminder that can't fit the window is skipped, not deferred past the slot.
Cap 1 — a reminder is never retried; the app is the fallback.

**Leg 8 · No-show attestation** — the only honest writer of `no_show`. The
place attests after the slot: a console tap on the reservation (business app)
or the a4 inbound line ("no llegó"). Writes `no_show` + `attested_by`;
`passed` stays derived for unattested tickets. Consumers of the status:
admin analytics (no-show rate per place) and the future guest-reliability
signal — name them before building, a status nobody reads is this protocol's
original sin.

**Retention (policy, job pending).** ElevenLabs conversations (recordings +
transcripts carrying names and phone numbers) are deleted after **90 days**
by a scheduled job (the API supports deletion); ticket rows keep outcomes but
shed `notice_conversation_id`/`callback_conversation_id`/`last_conversation_id`
and the `attempts` log on the same clock. LFPDPPP posture: stated retention,
scheduled deletion. Build the job before real volume — but not before the
fleet is proven (deleting conversations today deletes the only debugging
evidence).

---

## The shape this converges on

Four agents, two outbound directions, `call_context` names the errand:

| Direction | Agent | `call_context` values |
| --- | --- | --- |
| Mesita → place | **a1** | `booking` · `modification` · `cancellation` |
| Mesita → guest | **a2** | `confirmation` · `counter_offer` · `cancelled_by_venue` · *(leg 7: `reminder`)* |
| guest → Mesita | **a3** | inbound support |
| place → Mesita | **a4** | inbound support |

Every outbound leg answers the same four questions: **when does attempt 1
fire · when does a retry fire · how many attempts · what happens at the
cap** — plus, since the hardening round: **who reads its failure state.**
A leg missing any of those five stops silently; hold every future leg to the
checklist.

## Status vocabulary

`reservation_status`: `pending` · `confirmed` · `declined` · `no_show` ·
`cancelled` · `unreachable` · `unresolved`.
Consumer-facing phases: created → booking → confirmed → passed
(or cancelled / not booked).

## Parked-ticket copy (MESITA-954)

Consumer adapters read `attempts_state` (+ `next_attempt_at` from the list EF):
`running` = on the phone · `scheduled` = waiting for the place to open (with
the next-try time when known) · `exhausted` = couldn't reach them. Counter-offer
copy still wins when structured alternatives are present.
