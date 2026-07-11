"use client";

import { Fragment, useState, useTransition } from "react";
import {
  ChevronDown,
  Crown,
  Eye,
  Loader2,
  Percent,
  Repeat2,
  Sparkles,
  User,
  Users,
  Zap,
} from "lucide-react";
import {
  REWARD_ROWS,
  SUBSCRIPTIONS,
  VISIBILITY_LEVELS,
  computeVisibility,
  dbStateForSubscription,
  subscriptionForPlan,
  type PlanVisibility,
  type SubscriptionId,
} from "@/lib/business/plans";
import { updatePlace, type AdminPlace } from "../actions";
import { ErrorNote, GroupLabel, SectionCard, TINT_CHIP } from "../ui";

const RATE_CHOICES = [10, 20, 50, 70] as const;
const CAP_CHOICES = [200, 500, 1000, 2000] as const;

// "MX$1,000" for MXN places; generic "$" prefix elsewhere.
function formatMoney(amount: number, currency: string | null): string {
  const prefix = !currency || currency === "MXN" ? "MX$" : "$";
  return `${prefix}${amount.toLocaleString("en-US")}`;
}

export function PromosSection({
  place,
  onSaved,
}: {
  place: AdminPlace;
  onSaved: (v: AdminPlace) => void;
}) {
  const [v, setV] = useState(place);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const sub = subscriptionForPlan(v.plan);
  const isFree = sub === "free";

  // Optimistic write: patch local + bubble, persist, revert on error.
  const persist = (patch: Record<string, unknown>) => {
    const prev = v;
    const next = { ...v, ...patch } as AdminPlace;
    setV(next);
    onSaved(next);
    setError(null);
    start(async () => {
      const r = await updatePlace({ id: v.id, ...patch });
      if (!r.ok) {
        setV(prev);
        onSaved(prev);
        setError(r.error);
        return;
      }
      setV(r.data);
      onSaved(r.data);
    });
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Visibility is the product signal — plan + discounts + cap all move the needle. */}
      <VisibilityRail
        plan={v.plan}
        welcome_free_rate={v.welcome_free_rate}
        welcome_premium_rate={v.welcome_premium_rate}
        free_rate={v.free_rate}
        premium_rate={v.premium_rate}
        monthly_promo_cap={v.monthly_promo_cap}
      />

      <SectionCard
        icon={<Percent className="h-4 w-4" />}
        tint="pink"
        title="Promos"
        subtitle="Subscription plan, discount rates per user tier & visit, and the ticket cap. Discount-only — the place never holds money. A better plan and stronger promos boost this place's visibility on Mesita."
        action={pending ? <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" /> : null}
      >
        <RewardsExplainer place={v} />

        <div className="mt-6">
          <GroupLabel>Subscription</GroupLabel>
        </div>
        <div className="mt-2.5 grid gap-3 sm:grid-cols-3">
          {SUBSCRIPTIONS.map((s) => (
            <SubscriptionCard
              key={s.id}
              id={s.id}
              label={s.label}
              price={s.price}
              cadence={s.cadence}
              tagline={s.tagline}
              visibility={s.visibility}
              setup={s.setup}
              featured={!!s.featured}
              isCurrent={sub === s.id}
              pending={pending}
              onPick={() => persist(dbStateForSubscription(s.id))}
            />
          ))}
        </div>

        <div className="mt-8">
          <GroupLabel>
            Discount rates{" "}
            {isFree && <span className="normal-case">· enable a paid plan to set</span>}
          </GroupLabel>
        </div>
        <div className="mt-2.5 flex flex-col gap-2">
          {REWARD_ROWS.map((row) => (
            <div
              key={row.col}
              className="border-border/60 bg-muted/30 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">{row.label}</p>
                <p className="text-muted-foreground text-xs">{row.hint}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Pill
                  active={v[row.col] == null}
                  disabled={isFree || pending}
                  onClick={() => persist({ [row.col]: null })}
                  tone="off"
                >
                  Off
                </Pill>
                {RATE_CHOICES.map((rate) => (
                  <Pill
                    key={rate}
                    active={v[row.col] === rate}
                    disabled={isFree || pending}
                    onClick={() => persist({ [row.col]: rate })}
                  >
                    {rate}%
                  </Pill>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <GroupLabel>Ticket cap {v.currency ? `(${v.currency})` : ""}</GroupLabel>
        </div>
        <div className="border-border/60 bg-muted/30 mt-2.5 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3">
          <p className="text-muted-foreground text-xs">Max discount applied to a single ticket.</p>
          <div className="flex flex-wrap gap-1.5">
            <Pill
              active={v.monthly_promo_cap == null}
              disabled={pending}
              onClick={() => persist({ monthly_promo_cap: null })}
              tone="off"
            >
              No cap
            </Pill>
            {CAP_CHOICES.map((cap) => (
              <Pill
                key={cap}
                active={v.monthly_promo_cap === cap}
                disabled={pending}
                onClick={() => persist({ monthly_promo_cap: cap })}
              >
                {formatMoney(cap, v.currency)}
              </Pill>
            ))}
          </div>
        </div>

        {error && <ErrorNote message={error} />}
      </SectionCard>
    </div>
  );
}

// ── Rewards explainer ─────────────────────────────────────────────────────
// Collapsed disclosure at the top of the Promos card (closed by default —
// the operator opens it when they want the teaching content). The four
// rewards are the cross of visit type (Welcome / Returning) × guest class
// (Free / Premium). Inside: icon-tinted concept tiles, the Premium class
// composition (why Premium guests are part of the product), and a
// horizontally scrolling strip of mock Mesita users echoing the place's
// live configured rates (optimistic state, so they track clicks instantly).
// Names, handles, avatars, spend and the mix percentages are illustrative.

const EXPLAINER_TILES: {
  label: string;
  text: string;
  icon: typeof Sparkles;
  chip: string;
}[] = [
  {
    label: "Welcome",
    icon: Sparkles,
    chip: TINT_CHIP.amber,
    text: "A guest’s first-ever visit at this place. The acquisition lever — a strong Welcome rate is what pulls new people in.",
  },
  {
    label: "Returning",
    icon: Repeat2,
    chip: TINT_CHIP.emerald,
    text: "Every visit after the first. What keeps regulars choosing this place again.",
  },
  {
    label: "Free user",
    icon: User,
    chip: TINT_CHIP.sky,
    text: "A guest on the standard Mesita account, no subscription — most guests start here.",
  },
  {
    label: "Premium user",
    icon: Crown,
    chip: "bg-pink-gradient text-white shadow-sm",
    text: "A guest holding the monthly Mesita membership — most earn it by being magnetic rather than paying for it. They get the stronger Premium rates.",
  },
];

// Premium class composition — the "why" behind giving strangers your best
// rates. Percentages are the product's target mix, not live data.
const PREMIUM_MIX: { pct: number; label: string; bar: string; text: string }[] = [
  {
    pct: 70,
    label: "Instagram magnetic",
    bar: "bg-pink-gradient",
    text: "Followed accounts that must post an Instagram story of the place at check-in — every discounted visit doubles as promotion to their audience.",
  },
  {
    pct: 20,
    label: "Invited magnetic",
    bar: "bg-fuchsia-400",
    text: "Models, local influencers and other head-turning guests Mesita invites in — the kind of presence that makes a room feel like the place to be.",
  },
  {
    pct: 10,
    label: "Committed spenders",
    bar: "bg-amber-400",
    text: "High-spending regulars who simply pay for the membership and use the stronger rates a lot.",
  },
];

// Mock Mesita users for the scroll strip. Pravatar portraits keep the strip
// visual without shipping real guest data; spend figures are invented. The
// premium `via` tags roughly echo the PREMIUM_MIX split.
type PremiumVia = "story" | "invited" | "committed";

const VIA_LABEL: Record<PremiumVia, string> = {
  story: "Magnetic · posts IG stories",
  invited: "Magnetic · invited by Mesita",
  committed: "Committed · top spender",
};

const MOCK_USERS: {
  name: string;
  handle: string | null;
  premium: boolean;
  via?: PremiumVia;
  spend: string;
  avatar: number;
}[] = [
  { name: "Diego Torres", handle: "diego.antojos", premium: true, via: "story", spend: "MX$21,400", avatar: 12 },
  { name: "Sofía Ramírez", handle: "sofia.descubre", premium: false, spend: "MX$12,500", avatar: 47 },
  { name: "Valentina Cruz", handle: "vale.gourmet", premium: true, via: "story", spend: "MX$18,900", avatar: 31 },
  { name: "Andrés Peña", handle: null, premium: false, spend: "MX$9,300", avatar: 59 },
  { name: "Fernanda Ríos", handle: "fernnightlife", premium: true, via: "story", spend: "MX$23,700", avatar: 45 },
  { name: "Luis Ortega", handle: null, premium: false, spend: "MX$14,100", avatar: 68 },
  { name: "María Ibarra", handle: "maricuisine", premium: true, via: "invited", spend: "MX$17,200", avatar: 23 },
  { name: "Regina Salas", handle: null, premium: true, via: "committed", spend: "MX$26,300", avatar: 5 },
];

function RewardsExplainer({ place }: { place: AdminPlace }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-border/60 bg-muted/20 mt-5 overflow-hidden rounded-xl border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="hover:bg-muted/40 flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span
            className={
              "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg " +
              TINT_CHIP.violet
            }
          >
            <Users className="h-4 w-4" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold">Rewards explained</span>
            <span className="text-muted-foreground block truncate text-xs">
              Welcome vs Returning is the visit; Free vs Premium is the guest’s
              Mesita class — and why Premium guests attract more customers.
            </span>
          </span>
        </span>
        <ChevronDown
          className={
            "text-muted-foreground h-4 w-4 shrink-0 transition-transform " +
            (open ? "rotate-180" : "")
          }
          aria-hidden
        />
      </button>

      {open && (
        <div className="border-border/60 border-t px-4 pb-4">
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {EXPLAINER_TILES.map((t) => (
              <div
                key={t.label}
                className="border-border/60 bg-card flex items-start gap-3 rounded-xl border px-4 py-3"
              >
                <span
                  className={
                    "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg " +
                    t.chip
                  }
                >
                  <t.icon className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{t.label}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                    {t.text}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 mb-2">
            <GroupLabel>Who Premium users are</GroupLabel>
          </div>
          <div className="border-border/60 bg-card rounded-xl border p-4">
            <p className="text-muted-foreground text-xs leading-relaxed">
              Premium guests are part of the product: they either attract more
              customers — on the feed or in the room — or are provably loyal.
              Giving them your strongest rates is what brings more people
              through the door.
            </p>
            <div className="mt-3 flex h-2 overflow-hidden rounded-full" aria-hidden>
              {PREMIUM_MIX.map((m) => (
                <div key={m.label} className={m.bar} style={{ width: `${m.pct}%` }} />
              ))}
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {PREMIUM_MIX.map((m) => (
                <div key={m.label} className="flex items-start gap-2.5">
                  <span
                    className={
                      "mt-1 h-2.5 w-2.5 shrink-0 rounded-full " + m.bar
                    }
                    aria-hidden
                  />
                  <p className="text-muted-foreground min-w-0 text-xs leading-relaxed">
                    <span className="text-foreground font-semibold tabular-nums">
                      ~{m.pct}%
                    </span>{" "}
                    <span className="text-foreground font-medium">{m.label}</span>{" "}
                    — {m.text}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 mb-2">
            <GroupLabel>Example Mesita users · mock data</GroupLabel>
          </div>
          <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {MOCK_USERS.map((u) => (
              <MockUserCard
                key={u.name}
                {...u}
                welcomeRate={u.premium ? place.welcome_premium_rate : place.welcome_free_rate}
                returningRate={u.premium ? place.premium_rate : place.free_rate}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MockUserCard({
  name,
  handle,
  premium,
  via,
  spend,
  avatar,
  welcomeRate,
  returningRate,
}: {
  name: string;
  handle: string | null;
  premium: boolean;
  via?: PremiumVia;
  spend: string;
  avatar: number;
  welcomeRate: number | null;
  returningRate: number | null;
}) {
  const tier = premium ? "Premium" : "Free";
  return (
    <article className="border-border/60 bg-card w-56 shrink-0 snap-start rounded-xl border p-4">
      <div className="flex items-center gap-3">
        <span
          className={
            "shrink-0 rounded-full " +
            (premium ? "bg-pink-gradient p-0.5 shadow-sm" : "bg-border p-px")
          }
          aria-hidden
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://i.pravatar.cc/80?img=${avatar}`}
            alt=""
            loading="lazy"
            className="border-card block h-10 w-10 rounded-full border-2 object-cover"
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{name}</p>
          <span
            className={
              "mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase " +
              (premium
                ? "bg-pink-gradient text-white shadow-sm"
                : "bg-muted text-muted-foreground")
            }
          >
            {premium && <Crown className="h-2.5 w-2.5" aria-hidden />}
            {tier}
          </span>
        </div>
      </div>
      {premium && via && (
        <p className="mt-3 inline-flex max-w-full items-center rounded-full bg-fuchsia-500/10 px-2 py-0.5 text-[10px] font-semibold text-fuchsia-700">
          <span className="truncate">{VIA_LABEL[via]}</span>
        </p>
      )}
      {handle ? (
        <a
          href={`https://instagram.com/${handle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground mt-2 flex max-w-full items-center gap-1 text-xs transition"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/channels/instagram.svg"
            alt=""
            aria-hidden
            className="h-3 w-3 shrink-0"
          />
          <span className="truncate">@{handle}</span>
        </a>
      ) : (
        <p className="text-muted-foreground/70 mt-2 flex items-center gap-1 text-xs">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/channels/instagram.svg"
            alt=""
            aria-hidden
            className="h-3 w-3 shrink-0 opacity-50"
          />
          Instagram not linked
        </p>
      )}
      <p className="text-muted-foreground mt-2 text-xs">
        Spend on Mesita{" "}
        <span className="text-foreground font-semibold tabular-nums">{spend}</span>
      </p>
      <p className="text-muted-foreground mt-2 border-t border-dashed pt-2 text-[11px] leading-relaxed">
        First visit <span className="text-foreground font-medium">Welcome · {tier}</span>{" "}
        <RateNow rate={welcomeRate} />, then{" "}
        <span className="text-foreground font-medium">Returning · {tier}</span>{" "}
        <RateNow rate={returningRate} />.
      </p>
    </article>
  );
}

// Live echo of one configured rate — reads off the optimistic Promos state,
// so it tracks the operator's clicks in the matrix above instantly.
function RateNow({ rate }: { rate: number | null }) {
  return typeof rate === "number" ? (
    <span className="text-foreground font-semibold tabular-nums">
      (currently {rate}%)
    </span>
  ) : (
    <span className="italic">(currently Off)</span>
  );
}

// Visibility rail — six levels from plan + discount rates + ticket cap.
// Mesita shows higher-visibility places to more guests on every discovery
// surface — this is the answer the operator needs at a glance, so it gets
// the hero treatment: gradient level name over a faint brand wash.
function VisibilityRail({
  plan,
  welcome_free_rate,
  welcome_premium_rate,
  free_rate,
  premium_rate,
  monthly_promo_cap,
}: {
  plan: string | null;
  welcome_free_rate: number | null;
  welcome_premium_rate: number | null;
  free_rate: number | null;
  premium_rate: number | null;
  monthly_promo_cap: number | null;
}) {
  const current = computeVisibility({
    plan,
    welcome_free_rate,
    welcome_premium_rate,
    free_rate,
    premium_rate,
    monthly_promo_cap,
  });
  const currentIdx = VISIBILITY_LEVELS.indexOf(current);

  return (
    <section className="border-border/70 bg-card shadow-card relative overflow-hidden rounded-2xl border p-5 sm:p-6">
      <div
        aria-hidden
        className="bg-pink-gradient pointer-events-none absolute -top-28 -right-20 h-56 w-96 rounded-full opacity-[0.08] blur-2xl"
      />

      <div className="relative flex items-start justify-between gap-3">
        <div>
          <GroupLabel>Visibility</GroupLabel>
          <p className="font-display mt-2 text-4xl leading-none font-semibold tracking-tight">
            <span className="text-pink-gradient">{current}</span>
          </p>
          <p className="text-muted-foreground mt-2 text-xs leading-snug">
            The visibility Mesita’s algorithm gives this place on every discovery
            surface — plan, discount rates, and ticket cap all add up.
          </p>
        </div>
        <span className="border-border/70 bg-background/70 text-muted-foreground shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium tracking-wider uppercase">
          Step {currentIdx + 1} of {VISIBILITY_LEVELS.length}
        </span>
      </div>

      <div className="relative mt-6 flex items-center">
        {VISIBILITY_LEVELS.map((label, i) => {
          const reached = i < currentIdx;
          const isCurrent = i === currentIdx;
          return (
            <Fragment key={label}>
              {i > 0 && (
                <div
                  className={
                    "h-1.5 flex-1 rounded-full " +
                    (i <= currentIdx ? "bg-pink-gradient" : "bg-muted/80")
                  }
                />
              )}
              <div
                className={
                  "shrink-0 rounded-full transition " +
                  (isCurrent
                    ? "bg-pink-gradient shadow-save ring-pink-500/25 h-4 w-4 ring-4"
                    : reached
                      ? "bg-pink-gradient h-3 w-3"
                      : "bg-muted/80 h-3 w-3")
                }
              />
            </Fragment>
          );
        })}
      </div>

      <div className="relative mt-2 flex justify-between text-[9px] font-semibold tracking-wider uppercase">
        {VISIBILITY_LEVELS.map((label, i) => (
          <span
            key={label}
            className={i === currentIdx ? "text-foreground" : "text-muted-foreground/70"}
          >
            {label}
          </span>
        ))}
      </div>

      <p className="text-muted-foreground relative mt-4 text-xs leading-relaxed">
        <span className="text-foreground font-semibold">How to move up:</span>{" "}
        upgrade the plan — the biggest lever — then switch on stronger discount
        rates, and raise or remove the ticket cap. Each step pushes this place
        higher on every Mesita discovery surface.
      </p>
    </section>
  );
}

function SubscriptionCard({
  id,
  label,
  price,
  cadence,
  tagline,
  visibility,
  setup,
  featured,
  isCurrent,
  pending,
  onPick,
}: {
  id: SubscriptionId;
  label: string;
  price: string;
  cadence: string;
  tagline: string;
  visibility: PlanVisibility;
  setup?: string;
  featured: boolean;
  isCurrent: boolean;
  pending: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={isCurrent || pending}
      className={
        "relative flex flex-col gap-2.5 rounded-2xl border p-4 text-left transition disabled:cursor-default " +
        (isCurrent
          ? "border-foreground/80 bg-card shadow-elev ring-foreground/10 ring-1"
          : featured
            ? "border-pink-300/70 bg-gradient-to-b from-pink-500/[0.07] to-transparent hover:-translate-y-0.5 hover:shadow-card"
            : "border-border bg-card hover:border-foreground/30 hover:-translate-y-0.5 hover:shadow-card")
      }
    >
      {isCurrent && (
        <span className="bg-foreground text-background absolute top-3 right-3 rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase">
          Current
        </span>
      )}
      {!isCurrent && featured && (
        <span className="bg-pink-gradient absolute top-3 right-3 rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider text-white uppercase shadow-sm">
          Recommended
        </span>
      )}
      <div className="flex items-center gap-2 pr-16">
        {id !== "free" && (
          <span
            className={
              "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full " +
              (id === "ultra_discount"
                ? "bg-pink-gradient text-white shadow-sm"
                : TINT_CHIP.pink)
            }
          >
            {id === "ultra_discount" ? (
              <Crown className="h-3.5 w-3.5" />
            ) : (
              <Percent className="h-3.5 w-3.5" />
            )}
          </span>
        )}
        <span className="font-display min-w-0 truncate text-base font-semibold tracking-tight">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-display text-foreground text-2xl leading-none font-bold tabular-nums">
          {price}
        </span>
        <span className="text-muted-foreground text-[11px]">{cadence}</span>
      </div>
      <p className="text-muted-foreground text-[12px] leading-snug">{tagline}</p>
      <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
        <span className="border-border/60 bg-background/70 text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
          <Eye className="h-3 w-3" aria-hidden />
          {visibility} visibility
        </span>
        {setup && (
          <span className="border-border/60 bg-background/70 text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
            <Zap className="h-3 w-3" aria-hidden />
            {setup} setup
          </span>
        )}
      </div>
    </button>
  );
}

function Pill({
  active,
  disabled,
  onClick,
  tone,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  tone?: "off";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`h-8 min-w-11 rounded-lg border px-2.5 text-xs font-semibold tabular-nums transition disabled:opacity-40 ${
        active
          ? tone === "off"
            ? "border-transparent bg-foreground/90 text-background"
            : "bg-pink-gradient border-transparent text-white shadow-sm"
          : "border-border bg-card text-muted-foreground hover:border-pink-400/50 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
