"use client";

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
  Fragment,
  type ReactNode,
} from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  Bell,
  Check,
  ChevronRight,
  Crown,
  Download,
  HelpCircle,
  Instagram,
  Mail,
  Share2,
  Smile,
  Trash2,
} from "lucide-react";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { DeleteAccountSheet } from "@/components/consumer/DeleteAccountSheet";
import { EditProfileSheet } from "@/components/consumer/EditProfileSheet";
import {
  VerifySocialSheet,
  type SocialPlatform,
} from "@/components/consumer/VerifySocialSheet";
import { COUNTRIES, CLASSES, classBadgeClass } from "@/lib/consumer-data";
import {
  useConsumerClass,
  useMockClass,
  setMockClass,
  type MockClass,
} from "@/lib/class-context";
import { cn, errMsg } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  apiFetchConsumerProfile,
  type ConsumerProfile,
} from "@/lib/api/profile";

// Two-tab Profile under an identity hero: story-ring avatar and the two real
// counters Mesita actually tracks (saved places + reservations), plus Edit
// profile. No follower/friend stats — Mesita has no social graph. Consumers
// have a CLASS (Free / Premium) — the old "Plan" tab kept its content but was
// renamed, and /me/plan now redirects to /me/class.
export type ProfileTab = "class" | "settings";

const TABS: { id: ProfileTab; label: string; href: string }[] = [
  { id: "class", label: "Class", href: CONSUMER_ROUTES.me.class },
  { id: "settings", label: "Settings", href: CONSUMER_ROUTES.me.settings },
];

export function ProfileClient({ initialTab }: { initialTab: ProfileTab }) {
  const tab = initialTab;
  const supabase = useBrowserSupabase();
  const [verifyPlatform, setVerifyPlatform] = useState<SocialPlatform | null>(
    null,
  );
  const [editOpen, setEditOpen] = useState(false);

  // Identity payload shared by the hero, the Settings tab, and the edit
  // sheet — one consumer-web-get-profile read per profile visit. The (shell)
  // layout already guarantees the row is complete (onboarding gate).
  const [profile, setProfile] = useState<ConsumerProfile | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ consumer }, authRes] = await Promise.all([
          apiFetchConsumerProfile(supabase),
          supabase.auth.getUser(),
        ]);
        if (cancelled) return;
        setProfile(consumer);
        setEmail(authRes.data.user?.email ?? null);
      } catch (e) {
        if (!cancelled) toast(errMsg(e, "Couldn't load your profile."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Post-checkout landing. The subscribe flow redirects to
  // /me/class?subscription=success once the membership grant lands (instant in
  // the demo mock, post-webhook with real Stripe). Confirm it with a toast;
  // the full page load already re-seeded the real Premium membership upstream.
  // Read straight off the URL (client-only, fires once) rather than
  // useSearchParams, so the page carries no prerender-bailout requirement.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("subscription");
    if (status === "success") {
      toast.success("You're Mesita Premium — welcome in.");
    } else if (status === "cancelled") {
      toast("Checkout cancelled — you can subscribe anytime.");
    }
    // Instagram verify lands here too — the verify sheet redirects with
    // ?instagram=success once the account is connected and Premium is granted.
    if (params.get("instagram") === "success") {
      toast.success("Instagram connected — Mesita Premium unlocked.");
    }
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="scrollbar-hide flex-1 overflow-y-auto">
        <ProfileHero
          profile={profile}
          loading={loading}
          onEditProfile={() => setEditOpen(true)}
        />

        {/* Tab bar pins under the top chrome while the hero scrolls away. */}
        <div className="bg-background/95 sticky top-0 z-20 px-4 pt-3 pb-2 backdrop-blur">
          <div className="border-border bg-card flex rounded-lg border p-1">
            {TABS.map((t) => (
              <Link
                key={t.id}
                href={t.href}
                scroll={false}
                className={cn(
                  "flex-1 rounded-md px-2 py-1.5 text-center text-[12px] font-medium whitespace-nowrap transition",
                  tab === t.id
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </Link>
            ))}
          </div>
        </div>

        {tab === "class" && (
          <div className="px-5 pt-3 pb-8">
            <ClassTab onConnectSocial={(p) => setVerifyPlatform(p)} />
          </div>
        )}
        {tab === "settings" && (
          <div className="px-5 pt-3 pb-8">
            <SettingsTab
              profile={profile}
              email={email}
              onConnectSocial={(p) => setVerifyPlatform(p)}
            />
          </div>
        )}
      </div>

      {/* Kept mounted; LocalSheet's open/onClose contract plays the exit
          animation before it leaves the DOM. */}
      <VerifySocialSheet
        platform={verifyPlatform ?? "instagram"}
        open={verifyPlatform !== null}
        onClose={() => setVerifyPlatform(null)}
      />
      {profile && (
        <EditProfileSheet
          profile={profile}
          email={email}
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onSaved={(updated) => setProfile(updated)}
        />
      )}
    </div>
  );
}

// ─── Identity hero ────────────────────────────────────────────────────────

function ProfileHero({
  profile,
  loading,
  onEditProfile,
}: {
  profile: ConsumerProfile | null;
  loading: boolean;
  onEditProfile: () => void;
}) {
  const { key } = useConsumerClass();
  const isPremium = key === "premium";

  if (loading) {
    return (
      <header className="px-5 pt-5">
        <div className="flex items-center gap-4">
          <div className="bg-muted h-[76px] w-[76px] shrink-0 animate-pulse rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="bg-muted h-5 w-40 animate-pulse rounded" />
            <div className="bg-muted h-3.5 w-28 animate-pulse rounded" />
          </div>
        </div>
        <div className="bg-muted mt-4 h-10 w-full animate-pulse rounded-xl" />
      </header>
    );
  }

  const first = profile?.first_name ?? "";
  const last = profile?.last_name ?? "";
  const name =
    [first, last].filter(Boolean).join(" ") ||
    profile?.full_name ||
    "Mesita member";
  const initials =
    `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() ||
    name.charAt(0).toUpperCase();
  const country = COUNTRIES.find((c) => c.name === profile?.country);
  const classLabel = CLASSES.find((c) => c.id === key)?.label ?? "Free";

  return (
    <header className="px-5 pt-5">
      {/* Avatar beside the identity block — no vanity counters. */}
      <div className="flex items-center gap-4">
        {/* Story-ring avatar: class-tinted gradient ring around initials. */}
        <div
          className={cn(
            "shrink-0 rounded-full p-[2.5px]",
            isPremium ? "bg-tier-premium" : "bg-pink-gradient",
          )}
        >
          <div className="bg-background rounded-full p-[2.5px]">
            <div className="bg-muted flex h-[68px] w-[68px] items-center justify-center rounded-full">
              <span className="font-display text-foreground/70 text-xl font-bold tracking-tight">
                {initials}
              </span>
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="font-display flex items-center gap-1.5 text-[21px] leading-tight font-bold tracking-tight">
            <span className="truncate">{name}</span>
            {isPremium && (
              <BadgeCheck className="text-premium h-5 w-5 shrink-0" />
            )}
          </h1>
          <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-1.5 text-[12.5px] leading-snug">
            {country && (
              <span>
                {country.flag} {country.name}
              </span>
            )}
            {country && <span aria-hidden>·</span>}
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] leading-none font-bold",
                classBadgeClass(key),
              )}
            >
              {isPremium && <Crown className="h-3 w-3 fill-current" />}
              {classLabel}
            </span>
          </p>
        </div>
      </div>

      {/* Edit profile + Invite friends. The invite entry point moved here from
          the removed top-bar share icon — the Me page now owns both the class
          (Class tab below) and the invite affordance. */}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onEditProfile}
          className="border-border bg-card hover:bg-muted flex-1 rounded-xl border py-2.5 text-[13px] font-semibold transition active:scale-[0.99]"
        >
          Edit profile
        </button>
        <Link
          href={CONSUMER_ROUTES.invite}
          className="bg-pink-gradient flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-semibold text-white shadow-sm transition active:scale-[0.99]"
        >
          <Share2 className="h-4 w-4" />
          Invite friends
        </Link>
      </div>
    </header>
  );
}

// ─── Class tab ────────────────────────────────────────────────────────────

function ClassTab({
  onConnectSocial,
}: {
  onConnectSocial: (platform: SocialPlatform) => void;
}) {
  // Three labeled sections, top to bottom: your current class, a Free-vs-
  // Premium comparison, and the ways to join Premium.
  return (
    <div className="flex flex-col gap-6">
      <ClassPreviewToggle />
      <section className="flex flex-col gap-2">
        <SectionEyebrow>Current class</SectionEyebrow>
        <CurrentClassCard />
      </section>
      <section className="flex flex-col gap-2">
        <SectionEyebrow>Comparison</SectionEyebrow>
        <FreeVsPremium />
      </section>
      <section className="flex flex-col gap-2">
        <SectionEyebrow>Classes</SectionEyebrow>
        <WaysToClimb onConnectSocial={onConnectSocial} />
      </section>
    </div>
  );
}

// ─── Demo: class preview toggle ───────────────────────────────────────────

// Dev/demo affordance — flip the signed-in consumer between the three class
// states (Free / Premium via subscription / Premium via Instagram) so every
// surface that reads useConsumerClass() can be previewed without real billing
// or a 1K-follower Instagram. Writes a client-only localStorage override
// (setMockClass) that wins over the real server-seeded class; the whole shell
// re-renders live. Remove alongside the MOCK_ paths once the three states can
// be produced with real data.
const CLASS_PREVIEW_OPTIONS: { value: MockClass; label: string }[] = [
  { value: "free", label: "Free" },
  { value: "subscription", label: "Subscription" },
  { value: "instagram", label: "Instagram" },
];

function ClassPreviewToggle() {
  const override = useMockClass();
  const { key, origin } = useConsumerClass();
  // Highlight the segment matching the live effective state, whether it comes
  // from the override or the real class.
  const selected: MockClass =
    override ??
    (key === "free"
      ? "free"
      : origin === "instagram"
        ? "instagram"
        : "subscription");

  return (
    <div className="border-border/70 rounded-2xl border border-dashed p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold tracking-[0.12em] text-amber-600 uppercase">
          Demo
        </span>
        <span className="text-muted-foreground text-[11px] font-medium">
          Preview class state
        </span>
      </div>
      <div className="bg-muted/60 flex rounded-lg p-1">
        {CLASS_PREVIEW_OPTIONS.map((o) => {
          const active = selected === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => setMockClass(o.value)}
              aria-pressed={active}
              className={cn(
                "flex-1 rounded-md px-2 py-1.5 text-center text-[12px] font-semibold whitespace-nowrap transition",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-foreground/60 text-[10px] font-semibold tracking-[0.16em] uppercase">
      {children}
    </p>
  );
}

// ─── Free vs Premium ──────────────────────────────────────────────────────

// Quick at-a-glance comparison. The three perks that actually differ, with
// the Premium column tinted + emphasized.
const COMPARE_ROWS: { label: string; free: string; premium: string }[] = [
  { label: "Discounts", free: "Base", premium: "Boosted" },
  { label: "Recommendations", free: "Standard", premium: "Personalized" },
  { label: "Max monthly reservations", free: "2", premium: "Unlimited" },
];

function FreeVsPremium() {
  return (
    <div className="border-border bg-card overflow-hidden rounded-2xl border px-2 py-1.5">
      <div className="grid grid-cols-[1.3fr_0.8fr_1fr] items-end gap-1 px-2 pt-2">
        <span />
        <CompareHead label="Free" />
        <CompareHead label="Premium" accent />
      </div>
      <div className="mt-1">
        {COMPARE_ROWS.map((row, i) => (
          <div
            key={row.label}
            className={cn(
              "grid grid-cols-[1.3fr_0.8fr_1fr] items-center gap-1 px-2 py-3.5",
              i > 0 && "border-border/50 border-t",
            )}
          >
            <span className="text-foreground/80 text-[12.5px] leading-tight font-medium">
              {row.label}
            </span>
            <span className="text-foreground/70 text-center text-[12.5px] font-semibold">
              {row.free}
            </span>
            <span className="bg-tier-premium/[0.07] text-premium rounded-lg py-1.5 text-center text-[12.5px] font-semibold">
              {row.premium}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompareHead({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-t-lg px-1 py-1.5",
        accent && "bg-tier-premium/[0.07]",
      )}
    >
      <span className="inline-flex items-center gap-1">
        {accent && <Crown className="text-premium h-3 w-3 fill-current" />}
        <span
          className={cn(
            "font-display text-[13px] font-bold tracking-tight",
            accent && "text-premium",
          )}
        >
          {label}
        </span>
      </span>
    </div>
  );
}

// ─── Ways to climb ────────────────────────────────────────────────────────

// Vertical stack, one card per path: stay Free, or reach Premium by
// Instagram / Subscription. Each card states the requirement + its action;
// the user's current path is flagged.
type ClimbCardData = {
  key: string;
  icon: LucideIcon;
  iconBg: string;
  title: string;
  via?: string;
  accent?: boolean;
  price: string;
  priceNote?: string;
  desc: string;
  reached: boolean;
  reachedLabel: string;
  action?: { label: string; href?: string; onClick?: () => void };
  note?: string;
};

function WaysToClimb({
  onConnectSocial,
}: {
  onConnectSocial: (platform: SocialPlatform) => void;
}) {
  const premium = CLASSES.find((c) => c.id === "premium")!;
  const { key, origin, followers } = useConsumerClass();
  const isFree = key === "free";

  const cards: ClimbCardData[] = [
    {
      key: "free",
      icon: Smile,
      iconBg: "bg-muted text-foreground",
      title: "Free",
      price: "$0",
      priceNote: "always free",
      desc: "Your default account at no cost. Get a base discount at Verified Partners, standard recommendations, and book up to 2 reservations every month.",
      reached: isFree,
      reachedLabel: "Current class",
      note: isFree ? undefined : "Included in every account",
    },
    {
      key: "instagram",
      icon: Instagram,
      iconBg:
        "bg-[linear-gradient(135deg,oklch(0.70_0.20_30),oklch(0.65_0.20_350))] text-white",
      title: "Premium",
      via: "Instagram",
      accent: true,
      price: `${premium.followerThreshold.toLocaleString("en-US")}+ followers`,
      priceNote: "no payment — earned with reach",
      desc: "Connect an Instagram with 1,000+ followers and post a story each time you visit. You get full Premium — boosted discounts, personalized recommendations, and unlimited reservations — without paying a peso.",
      reached: origin === "instagram",
      reachedLabel: "Connected",
      action: { label: "Connect", onClick: () => onConnectSocial("instagram") },
    },
    {
      // Subscription path. Crown icon on purpose — no card imagery anywhere
      // in the app (there is no Mesita Pay / wallet); Stripe checkout owns
      // the payment UI.
      key: "subscription",
      icon: Crown,
      iconBg: "bg-pink-gradient text-white",
      title: "Premium",
      via: "Subscription",
      accent: true,
      price: `$${premium.priceMxn} MXN`,
      priceNote: "per month · cancel anytime",
      desc: "Subscribe and unlock full Premium instantly — boosted discounts, personalized recommendations, and unlimited reservations. No follower count needed; cancel whenever you want.",
      reached: origin === "subscription",
      reachedLabel: "Active",
      action: { label: "Subscribe", href: "/subscribe/premium" },
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      {cards.map((c) => (
        <Fragment key={c.key}>
          <ClimbCard data={c} />
          {c.key === "instagram" && origin === "instagram" && (
            <InstagramConnectedSummary followers={followers} />
          )}
        </Fragment>
      ))}
    </div>
  );
}

// Instagram "profile connected" summary — rendered directly under the
// Instagram path card once the consumer's Premium is actually sourced from
// Instagram (origin === "instagram"). Surfaces the connected account at a
// glance: the verified follower reach that cleared the threshold plus the
// live "post a story each visit" reminder that keeps the perk. The verify
// flow only captures follower count (no handle is stored), so the summary
// leads with reach instead of a @handle.
function InstagramConnectedSummary({ followers }: { followers: number }) {
  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.05] p-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,oklch(0.70_0.20_30),oklch(0.65_0.20_350))] text-white shadow-sm">
        <Instagram className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-display text-[14px] leading-none font-bold tracking-tight">
            Profile connected
          </span>
          <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-600" />
        </div>
        <p className="text-muted-foreground mt-1 text-[12px] leading-snug">
          {followers > 0
            ? `${followers.toLocaleString("en-US")} followers · Premium active`
            : "Premium active"}
        </p>
        <p className="text-muted-foreground/80 mt-0.5 text-[11px] leading-snug">
          Post a story each visit to keep Premium.
        </p>
      </div>
    </div>
  );
}

function ClimbCard({ data }: { data: ClimbCardData }) {
  const Icon = data.icon;

  // Full-width footer: a CTA, the reached-state pill, or a muted note.
  let footer: ReactNode = null;
  if (data.reached) {
    footer = (
      <span className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500/15 py-2.5 text-[12px] font-semibold text-emerald-700">
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
        {data.reachedLabel}
      </span>
    );
  } else if (data.action) {
    const cls =
      "bg-pink-gradient shadow-sm flex items-center justify-center rounded-lg py-2.5 text-[13px] font-semibold text-white transition active:scale-[0.99]";
    footer = data.action.href ? (
      <Link href={data.action.href} className={cls}>
        {data.action.label}
      </Link>
    ) : (
      <button
        type="button"
        onClick={data.action.onClick}
        className={cn(cls, "w-full")}
      >
        {data.action.label}
      </button>
    );
  } else if (data.note) {
    footer = (
      <span className="border-border bg-muted/40 text-muted-foreground flex items-center justify-center rounded-lg border py-2.5 text-[12px] font-medium">
        {data.note}
      </span>
    );
  }

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-2xl border p-5",
        data.accent
          ? "border-tier-premium/30 bg-tier-premium/[0.03]"
          : "border-border bg-card",
      )}
    >
      <div className="flex items-center gap-3.5">
        <span
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm",
            data.iconBg,
          )}
        >
          <Icon className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {data.accent && (
              <Crown className="text-premium h-4 w-4 shrink-0 fill-current" />
            )}
            <span
              className={cn(
                "font-display text-[16px] leading-none font-bold tracking-tight",
                data.accent && "text-premium",
              )}
            >
              {data.title}
            </span>
            {data.via && (
              <span className="text-muted-foreground text-[13px] font-medium">
                via {data.via}
              </span>
            )}
          </div>
          <p className="font-display text-foreground mt-2 text-xl leading-tight font-bold tracking-tight">
            {data.price}
          </p>
          {data.priceNote && (
            <p className="text-muted-foreground mt-0.5 text-[11px] leading-snug">
              {data.priceNote}
            </p>
          )}
        </div>
      </div>
      <p className="text-muted-foreground mt-4 text-[12.5px] leading-relaxed">
        {data.desc}
      </p>
      <div className="mt-4">{footer}</div>
    </article>
  );
}

function CurrentClassCard() {
  // Current-class banner — class name + an origin icon and a short "via …"
  // line so a Premium member sees how they got it (Instagram / subscription
  // / invitation). No follower count — just the door.
  const { key, origin } = useConsumerClass();
  const meta = CLASSES.find((c) => c.id === key)!;
  const brand = `Mesita ${meta.label}`;
  const isPremium = key === "premium";
  const { Icon, via } = (() => {
    if (!isPremium) return { Icon: Smile, via: null as string | null };
    switch (origin) {
      case "instagram":
        return { Icon: Instagram, via: "via Instagram" };
      case "subscription":
        return { Icon: Crown, via: "via subscription" };
      case "invitation":
        return { Icon: Crown, via: "via invitation" };
      default:
        return { Icon: Crown, via: null as string | null };
    }
  })();
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl px-4 py-4 shadow-sm",
        classBadgeClass(key),
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl backdrop-blur",
          isPremium ? "bg-white/20" : "bg-foreground/[0.06]",
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <h2 className="font-display text-2xl leading-tight font-semibold tracking-tight [text-shadow:0_1px_6px_rgba(0,0,0,0.35)]">
          {brand}
        </h2>
        {via && (
          <p className="text-[11px] leading-snug opacity-100 [text-shadow:0_1px_4px_rgba(0,0,0,0.3)]">
            {via}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Settings tab ─────────────────────────────────────────────────────────

const MESITA_SUPPORT_EMAIL = "support@mesita.ai";
const MESITA_PRIVACY_EMAIL = "privacy@mesita.ai";

// Device-level notification flags. These persist in localStorage until the
// push integration lands.
const NOTIF_PUSH_KEY = "mesita:notif:push";
const NOTIF_EMAIL_KEY = "mesita:notif:email";

// Grouped, row-based settings — identity edits happen in the EditProfileSheet
// (same one the hero button opens), socials connect inline, privacy + support
// are direct contact links. No payment rows: there is no Mesita Pay / wallet.
function SettingsTab({
  profile,
  email,
  onConnectSocial,
}: {
  profile: ConsumerProfile | null;
  email: string | null;
  onConnectSocial: (platform: SocialPlatform) => void;
}) {
  const { origin, followers } = useConsumerClass();
  const igConnected = origin === "instagram";

  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      {/* Edit profile lives on the hero button above; a second entry point
          here would be redundant. This group holds read-only account facts. */}
      <SettingsGroup title="Account">
        <SettingsStaticRow
          Icon={Mail}
          tint="muted"
          label="Email"
          sub={email ?? "—"}
        />
      </SettingsGroup>

      <SettingsGroup title="Social">
        {igConnected ? (
          <div className="flex w-full items-center gap-3 px-4 py-3">
            <IconCircle tint="instagram">
              <Instagram className="h-[18px] w-[18px]" />
            </IconCircle>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Instagram</span>
              <span className="text-muted-foreground block truncate text-[11px]">
                {[
                  profile?.instagram_handle && `@${profile.instagram_handle}`,
                  followers > 0 &&
                    `${followers.toLocaleString("en-US")} followers`,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Connected"}
              </span>
            </span>
            <BadgeCheck className="h-5 w-5 shrink-0 text-emerald-600" />
          </div>
        ) : (
          <SettingsActionRow
            Icon={Instagram}
            tint="instagram"
            label="Connect Instagram"
            sub="1,000+ followers unlocks Premium — free"
            onClick={() => onConnectSocial("instagram")}
          />
        )}
      </SettingsGroup>

      <SettingsGroup title="Notifications">
        <StoredToggleRow
          Icon={Bell}
          tint="amber"
          storageKey={NOTIF_PUSH_KEY}
          label="Push notifications"
          sub="Ticket updates and rewards"
        />
        <RowDivider />
        <StoredToggleRow
          Icon={Mail}
          tint="violet"
          storageKey={NOTIF_EMAIL_KEY}
          label="Email"
          sub="Receipts and news"
        />
      </SettingsGroup>

      <SettingsGroup title="Privacy & data">
        <SettingsLinkRow
          Icon={Download}
          tint="emerald"
          href={`mailto:${MESITA_PRIVACY_EMAIL}?subject=${encodeURIComponent(
            "Export my Mesita data",
          )}`}
          label="Export my data"
          sub={MESITA_PRIVACY_EMAIL}
        />
        <RowDivider />
        <SettingsActionRow
          Icon={Trash2}
          tint="destructive"
          label="Delete account"
          sub="Permanently delete your account"
          destructive
          onClick={() => setDeleteOpen(true)}
        />
      </SettingsGroup>

      <SettingsGroup title="Help & support">
        <SettingsLinkRow
          Icon={HelpCircle}
          tint="muted"
          href={`mailto:${MESITA_SUPPORT_EMAIL}`}
          label="Contact us"
          sub={MESITA_SUPPORT_EMAIL}
        />
      </SettingsGroup>

      <SignOutButton
        redirectTo="/"
        className="border-border bg-card hover:bg-muted flex w-full items-center justify-center gap-2 rounded-2xl border py-4 text-sm font-semibold transition"
      />
      <p className="text-muted-foreground -mt-3 text-center text-[11px]">
        Mesita · v2.4.1
      </p>

      <DeleteAccountSheet
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
      />
    </div>
  );
}

// ─── Settings building blocks ─────────────────────────────────────────────

function SettingsGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <SectionEyebrow>{title}</SectionEyebrow>
      <div className="border-border bg-card overflow-hidden rounded-2xl border">
        {children}
      </div>
    </section>
  );
}

function RowDivider() {
  return <div className="border-border/60 border-t" />;
}

type RowTint =
  | "primary"
  | "muted"
  | "instagram"
  | "emerald"
  | "amber"
  | "sky"
  | "violet"
  | "destructive";

const TINT_CLASSES: Record<RowTint, string> = {
  primary: "bg-primary/10 text-primary",
  muted: "bg-muted text-foreground/70",
  instagram:
    "bg-[linear-gradient(135deg,oklch(0.70_0.20_30),oklch(0.65_0.20_350))] text-white",
  emerald: "bg-emerald-500/10 text-emerald-600",
  amber: "bg-amber-500/10 text-amber-600",
  sky: "bg-sky-500/10 text-sky-600",
  violet: "bg-violet-500/10 text-violet-600",
  destructive: "bg-destructive/10 text-destructive",
};

function IconCircle({
  tint,
  children,
}: {
  tint: RowTint;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
        TINT_CLASSES[tint],
      )}
    >
      {children}
    </span>
  );
}

function RowText({
  label,
  sub,
  destructive,
}: {
  label: string;
  sub?: string;
  destructive?: boolean;
}) {
  return (
    <span className="min-w-0 flex-1">
      <span
        className={cn(
          "block text-sm font-semibold",
          destructive && "text-destructive",
        )}
      >
        {label}
      </span>
      {sub && (
        <span className="text-muted-foreground block truncate text-[11px]">
          {sub}
        </span>
      )}
    </span>
  );
}

function SettingsActionRow({
  Icon,
  tint,
  label,
  sub,
  destructive,
  onClick,
}: {
  Icon: LucideIcon;
  tint: RowTint;
  label: string;
  sub?: string;
  destructive?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hover:bg-muted flex w-full items-center gap-3 px-4 py-3 text-left transition"
    >
      <IconCircle tint={tint}>
        <Icon className="h-[18px] w-[18px]" />
      </IconCircle>
      <RowText label={label} sub={sub} destructive={destructive} />
      <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
    </button>
  );
}

function SettingsStaticRow({
  Icon,
  tint,
  label,
  sub,
}: {
  Icon: LucideIcon;
  tint: RowTint;
  label: string;
  sub?: string;
}) {
  return (
    <div className="flex w-full items-center gap-3 px-4 py-3">
      <IconCircle tint={tint}>
        <Icon className="h-[18px] w-[18px]" />
      </IconCircle>
      <RowText label={label} sub={sub} />
    </div>
  );
}

function SettingsLinkRow({
  Icon,
  tint,
  href,
  label,
  sub,
  destructive,
}: {
  Icon: LucideIcon;
  tint: RowTint;
  href: string;
  label: string;
  sub?: string;
  destructive?: boolean;
}) {
  return (
    <a
      href={href}
      className="hover:bg-muted flex w-full items-center gap-3 px-4 py-3 text-left transition"
    >
      <IconCircle tint={tint}>
        <Icon className="h-[18px] w-[18px]" />
      </IconCircle>
      <RowText label={label} sub={sub} destructive={destructive} />
      <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
    </a>
  );
}

// Device-persisted boolean flags. useSyncExternalStore keeps the hydration
// render on the server snapshot (the default) so markup matches, then swaps
// in the stored value — no setState-in-effect cascade. The local listener
// set notifies same-tab subscribers on writes; the storage event covers
// other tabs.
const flagListeners = new Set<() => void>();

function subscribeToFlags(onChange: () => void): () => void {
  flagListeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    flagListeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readFlag(key: string, defaultOn: boolean): boolean {
  try {
    const stored = window.localStorage.getItem(key);
    return stored == null ? defaultOn : stored === "1";
  } catch {
    return defaultOn;
  }
}

function writeFlag(key: string, on: boolean) {
  try {
    window.localStorage.setItem(key, on ? "1" : "0");
  } catch {
    // best-effort persistence
  }
  flagListeners.forEach((l) => l());
}

function useStoredFlag(key: string, defaultOn: boolean): [boolean, () => void] {
  const on = useSyncExternalStore(
    subscribeToFlags,
    () => readFlag(key, defaultOn),
    () => defaultOn,
  );
  const toggle = useCallback(
    () => writeFlag(key, !readFlag(key, defaultOn)),
    [key, defaultOn],
  );
  return [on, toggle];
}

function Switch({ on, small }: { on: boolean; small?: boolean }) {
  return (
    <span
      className={cn(
        "relative shrink-0 rounded-full transition",
        small ? "h-5 w-9" : "h-6 w-10",
        on ? "bg-pink-gradient" : "bg-muted",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 rounded-full bg-white shadow transition-all",
          small ? "h-4 w-4" : "h-5 w-5",
          on ? "left-[18px]" : "left-0.5",
        )}
      />
    </span>
  );
}

function ToggleRow({
  Icon,
  tint,
  label,
  sub,
  on,
  onToggle,
}: {
  Icon: LucideIcon;
  tint: RowTint;
  label: string;
  sub?: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      role="switch"
      aria-checked={on}
      className="hover:bg-muted flex w-full items-center gap-3 px-4 py-3 text-left transition"
    >
      <IconCircle tint={tint}>
        <Icon className="h-[18px] w-[18px]" />
      </IconCircle>
      <RowText label={label} sub={sub} />
      <Switch on={on} />
    </button>
  );
}

function StoredToggleRow({
  Icon,
  tint,
  storageKey,
  label,
  sub,
}: {
  Icon: LucideIcon;
  tint: RowTint;
  storageKey: string;
  label: string;
  sub?: string;
}) {
  const [on, toggle] = useStoredFlag(storageKey, true);
  return (
    <ToggleRow
      Icon={Icon}
      tint={tint}
      label={label}
      sub={sub}
      on={on}
      onToggle={toggle}
    />
  );
}

