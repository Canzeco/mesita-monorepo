# web-consumer — Design system

Calibration map for Mesita’s consumer app (`consumer.mesita.ai`).  
Readers: agents reviewing or building consumer UI (and the mobile twin), and humans doing the same.

## 1. Authority & readers

| Source | Wins for |
| --- | --- |
| `src/app/globals.css` (+ `src/app/layout.tsx` fonts) | Token values (colors, radius, gradients, shadows), font faces |
| **This file** | When-to-use, surface templates, chip/card/motion vocabulary, DO/DON’T |
| `CLAUDE.md` / `AGENTS.md` | Package law (EF-only clients, overlay primitives, parked blocks, route contract) |
| Product Rules (Notion) | Light theme, place-not-venue, doors model, mobile look-alike |

**Rule:** DESIGN.md cites CSS **variable / utility names**, not parallel oklch recipes. If a token or overlay pattern changes, update this file in the **same PR**.

This package intentionally uses **Inter** (`--font-body`) + **Fraunces** (`--font-display`). Generic “avoid Inter” taste rules do **not** override this file for `apps/web-consumer`.

Mobile (`apps/mobile-consumer`) must **look very alike** — same IA, tokens, brand moments, and feature parity (sole deliberate exception: no Stripe subscribe UI in the iOS binary).

## 2. Voice & principles

- **Premium, not dashboard.** Consumer surfaces must feel branded: gradients on hero/promo, tinted icon circles, differentiated chips, calibrated copy. Plain wireframe stacks are a regression (`CLAUDE.md`).
- **Light theme only** on app surfaces. Semantic tokens (`bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`). Never `bg-zinc-900` / `text-white` as the page canvas (photo overlays and on-media chrome may invert locally).
- **Pink is accent, not canvas.** Brand chroma on CTAs (`bg-pink-gradient`), marks, and rare highlights. Canvas / borders / body stay near-neutral.
- **One composition per first viewport.** Hero/promo moments: brand + one headline + one short support + one CTA group + one dominant visual. Don’t pack stats, schedules, or secondary marketing into the first screen.
- **Cards only when interactive.** Default: no decorative cards. Prefer full-bleed media, lists, and sheets. If removing border/shadow/radius doesn’t hurt interaction, it shouldn’t be a card.
- **Parked ≠ dead.** Unused feature components + mock data may be deliberately parked — check for parking comments / ComingSoon before deleting.

## 3. Surface templates

| Surface | Shell / pattern | Notes |
| --- | --- | --- |
| **Tab shell** | BottomNav + page content | Five tabs: Home / Search / Rewards / Reservations / Profile (`/me`) |
| **Home swipe** | Full-bleed place cards | Photo-first; info layer overlays media carefully |
| **Search** | Map + results panel | Results modal **height fits content** (header + rows); `max-height` for scroll — never a fixed tall empty panel |
| **Favorites** | Two-column photo tile grid + "More like your saves" | Tiles, not thumbnail rows — the photo IS the content. **Every tile the same size**, 3:4 portrait, no hero span on odd counts (Pato, 2026-08-10 — the even rhythm wins over closing the trailing gap). The suggestions section exists so the screen is full at 1 save, not just at 5 |
| **Rewards wallet** | `shrink-0` header (`PitchSteps` + the tab switcher) over **one column** of ticket rows | The four steps are the wallet's **masthead — always visible, on every tab, never gated** (Pato, 2026-08-10; supersedes MESITA-1018's New-only scoping). Header never scrolls: an orientation control that scrolls away has stopped orienting. Tickets are scanned for state and QR at arm's length — never gridded |
| **Route modals** | `@modal` via `SlideOverShell` / `BottomSheetShell` from **segment `layout.tsx`** | Never mount route modals from `page.tsx` |
| **Local overlays** | `LocalSheet` / `LocalDialog` | Never bare `fixed inset-0` / ad-hoc `absolute` overlays |
| **Profile** | Flat `/me` | Class & Settings open as modals, not sub-routes |
| **Auth / gate** | Branded atmosphere (`bg-hero` where used) | Keep CTA `rounded-full` / pink-gradient primary |

**Z-scale (mandatory):** BottomNav `40` · `@modal` `120` · local overlay `130` · Toaster `140`.

## 4. Tokens

Authority: `src/app/globals.css`. Fonts: Inter → `--font-body`, Fraunces → `--font-display` (`layout.tsx`).

### Colors (semantic)

`background` · `foreground` · `card` · `popover` · `primary` · `secondary` · `muted` · `accent` · `destructive` · `border` · `input` · `ring`  
(+ matching `*-foreground` where defined)

### Radius

`--radius` = `0.5rem` (tighter than admin); ladder `--radius-sm` … `--radius-3xl`.  
Common: sheets/cards `rounded-2xl`, fields `rounded-xl`, pills/CTAs often `rounded-full` or `rounded-xl`.

### Gradients & shadows

| Utility | Use |
| --- | --- |
| `bg-hero` | Auth / empty atmospheres |
| `bg-pink-gradient` / `text-pink-gradient` | Primary brand CTAs, premium moments |
| `shadow-glow` | Brand CTA / mark emphasis |
| `shadow-elev` | Elevated sheets, drawers, floating chrome |

## 5. Typography (observed)

| Role | Classes (live) |
| --- | --- |
| Screen / modal title | `font-display text-lg\|text-2xl font-semibold tracking-tight` |
| Place / hero name | `font-display` + tight tracking; size follows density |
| Eyebrow / meta | `text-[10px]`–`text-xs`, often `uppercase tracking-wide` or muted |
| Body | `text-sm` / `text-[13px] leading-snug\|relaxed text-muted-foreground` |
| Dense chips | `text-[10px]`–`text-xs font-semibold` / `font-bold` |
| Numerals | `tabular-nums`; display sizes use `font-display` |

Don’t invent a parallel type scale in PRs — extend these roles.

## 6. Chip / card / control vocabulary

| Name | Where | When |
| --- | --- | --- |
| **PromoChip** | `components/consumer/PromoChip.tsx` | Discount / strategy affordance on place surfaces |
| **Filter / zone chips** | Discovery + search | Selected state = filled; idle = muted border/pill |
| **Gift / share cards** | `share/GiftCardDeck.tsx` | Differentiated gradients per audience; gloss overlay OK |
| **Reservation / ticket rows** | list components | Interactive rows — not decorative card stacks |
| **ComingSoonModal** | parked tabs/modes | Tab stays visible; tap opens modal (don’t hide IA) |
| **FavoriteTile** | `components/consumer/home/FavoriteTile.tsx` | Place tile in a photo grid (Favorites + its suggestions). Uniform 3:4 portrait — no size variants. Discovery surfaces only, never for tickets |
| **JourneyRail** | `components/consumer/rewards/JourneyRail.tsx` | The four ticket steps as **live progress** inside the wizard sheet. Import it if another surface ever needs the same rail — re-implementing it is what produced two disagreeing counters before MESITA-1015. The wallet's New tab shows `PitchSteps` instead: a pitch, not a progress bar |
| **EmptyState** | `@/components/shared` | Zero states — centres in its space, carries one action. No dashed decorative box |
| **Spinner / Skeleton** | `@/components/shared` | Loading — never invent a third spinner. Skeletons mirror the destination's shape (grid → grid) |
| **Toaster** | `components/consumer/Toaster.tsx` | Transient feedback at z-140 |

**Icon circles:** tinted soft backgrounds (`bg-*-500/10` + matching text) for feature glyphs — differentiate siblings; don’t wash the whole canvas.

## 7. Motion budget

Ship intentional motion; avoid noise.

| Motion | Typical use |
| --- | --- |
| Sheet / slide-over enter-exit | Route + local overlays (shell-owned) |
| Active press scale | Primary CTAs (`active:scale-[0.99]`) |
| Carousel / swipe | Home deck, photo chrome |
| Chip / tab transitions | Short color/opacity only |

Don’t add parallax, multi-layer shadows, or perpetual glow loops on content surfaces.

## 8. Interaction state matrix

| State | Expected UI |
| --- | --- |
| Loading | `Spinner` / `Skeleton` / `DeckSkeleton`. **Anything reading `useSavedPlaces` must gate on `hydrated`** — the store is empty until localStorage is read, so branching on count first flashes the empty state at everyone who has saves |
| Empty | `EmptyState` — centred in the space, one action. Never a box pinned to the top of a tall container |
| Partial | State it. A list that silently drops rows it couldn't resolve reads as data loss; count them and say so |
| Error | Shared error note / toast — don’t fork one-off banners |
| Parked surface | Visible IA + `ComingSoonModal` |
| Destructive | Explicit confirm sheet (`DeleteAccountSheet` pattern) |
| Premium / class | Match doors model chrome; subscribe checkout may hand off to web on iOS |

## 9. DO / DON’T

**DO**

- Use semantic tokens + overlay primitives from the table above.
- Keep Search results panel height content-driven (cap with max-height).
- Mirror web → mobile look and capability in the same change when possible.
- Update DESIGN.md in the same PR as token or pattern changes.
- Cite this file in design reviews.

**DON’T**

- `bg-zinc-900` app canvases; dark-mode defaults; purple glow themes.
- Mount route modals from `page.tsx`.
- Bare `fixed inset-0` overlays bypassing LocalSheet/Dialog.
- Fixed tall empty panels on **any** surface — a screen whose content fills a
  quarter of its height reads as broken, not restrained. If a layout can't fill
  the space at the count users actually have, the screen needs a second job, not
  a bigger card. (Search results were the first case; Favorites was the second.)
- Two-column grids outside discovery. Tickets and task queues stay one column.
- Delete parked building blocks without checking park intent.
- Hand-edit `AGENTS.md` (regenerate via `deno task sync-rules`).

## 10. Debt / known gaps

- `PromoChip` still resolves its rate from the legacy per-class place columns
  rather than the v10 engine (MESITA-1019). It renders on the swipe card, the
  Favorites tile and the place profile — don't add a fourth reader of those
  columns.
- Mobile has no ticket wizard, so `JourneyRail` has no twin there yet; the
  rewards flows are structurally divergent between web and mobile.
- Some on-media chrome still uses raw `bg-black/60` (intentional for photo contrast); don’t spread that to page canvases.
- Ask AI (`/home/ai`) and Social remain parked behind redirects / ComingSoon until explicitly un-parked.
