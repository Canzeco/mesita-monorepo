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
  Bookmark,
  Check,
  ChevronRight,
  Crown,
  Download,
  Globe,
  HelpCircle,
  Instagram,
  Mail,
  MapPin,
  Smile,
  Trash2,
  UserPen,
} from "lucide-react";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { EditProfileSheet } from "@/components/consumer/EditProfileSheet";
import {
  VerifySocialSheet,
  type SocialPlatform,
} from "@/components/consumer/VerifySocialSheet";
import { COUNTRIES, CLASSES, classBadgeClass } from "@/lib/consumer-data";
import { useConsumerClass } from "@/lib/class-context";
import { useSavedPlaces } from "@/lib/saved-places";
import { cn, errMsg } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  apiFetchConsumerProfile,
  apiUpdateProfileVisibility,
  type ConsumerClass,
  type ConsumerProfile,
  type ProfileVisibilityPatch,
} from "@/lib/api/profile";

// Two-tab Profile under an Instagram-style identity hero: story-ring avatar,
// real stats (saved places / reservations / IG followers), Edit profile +
// Invite friends. Consumers have a CLASS (Free / Premium) — the old "Plan"
// tab kept its content but was renamed, and /me/plan now redirects to
// /me/class.
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
  const [usage, setUsage] = useState<ConsumerClass["usage"] | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ consumer, consumerClass }, authRes] = await Promise.all([
          apiFetchConsumerProfile(supabase),
          supabase.auth.getUser(),
        ]);
        if (cancelled) return;
        setProfile(consumer);
        setUsage(consumerClass.usage);
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
          reservationsUsed={usage?.reservations_used ?? 0}
          onEditProfile={() => setEditOpen(true)}
          onConnectSocial={(p) => setVerifyPlatform(p)}
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
              loading={loading}
              onEditProfile={() => setEditOpen(true)}
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

function compact(n: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

function ProfileHero({
  profile,
  loading,
  reservationsUsed,
  onEditProfile,
  onConnectSocial,
}: {
  profile: ConsumerProfile | null;
  loading: boolean;
  reservationsUsed: number;
  onEditProfile: () => void;
  onConnectSocial: (platform: SocialPlatform) => void;
}) {
  const { key, origin, followers } = useConsumerClass();
  const { savedIds } = useSavedPlaces();
  const isPremium = key === "premium";
  const igConnected = origin === "instagram";

  if (loading) {
    return (
      <header className="px-5 pt-5">
        <div className="flex items-center gap-5">
          <div className="bg-muted h-[86px] w-[86px] shrink-0 animate-pulse rounded-full" />
          <div className="flex flex-1 items-center justify-around">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="bg-muted h-10 w-14 animate-pulse rounded-lg"
              />
            ))}
          </div>
        </div>
        <div className="bg-muted mt-4 h-5 w-40 animate-pulse rounded" />
        <div className="bg-muted mt-2 h-3.5 w-28 animate-pulse rounded" />
        <div className="mt-4 flex gap-2">
          <div className="bg-muted h-10 flex-1 animate-pulse rounded-xl" />
          <div className="bg-muted h-10 flex-1 animate-pulse rounded-xl" />
        </div>
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
      <div className="flex items-center gap-5">
        {/* Story-ring avatar: class-tinted gradient ring around initials. */}
        <div
          className={cn(
            "shrink-0 rounded-full p-[2.5px]",
            isPremium ? "bg-tier-premium" : "bg-pink-gradient",
          )}
        >
          <div className="bg-background rounded-full p-[2.5px]">
            <div className="bg-muted flex h-[76px] w-[76px] items-center justify-center rounded-full">
              <span className="font-display text-foreground/70 text-2xl font-bold tracking-tight">
                {initials}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-around">
          <Stat
            value={compact(savedIds.size)}
            label="Saved"
            href={CONSUMER_ROUTES.favorites}
          />
          <Stat
            value={compact(reservationsUsed)}
            label="Reservations"
            href={CONSUMER_ROUTES.saved.reservations}
          />
          <Stat
            value={igConnected ? compact(followers) : "—"}
            label="Followers"
            onClick={
              igConnected ? undefined : () => onConnectSocial("instagram")
            }
          />
        </div>
      </div>

      <div className="mt-3.5">
        <h1 className="font-display flex items-center gap-1.5 text-[21px] leading-tight font-bold tracking-tight">
          {name}
          {isPremium && (
            <BadgeCheck className="text-premium h-5 w-5 shrink-0" />
          )}
        </h1>
        <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-[12.5px] leading-snug">
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

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onEditProfile}
          className="border-border bg-card hover:bg-muted flex-1 rounded-xl border py-2.5 text-[13px] font-semibold transition active:scale-[0.99]"
        >
          Edit profile
        </button>
        <Link
          href={CONSUMER_ROUTES.share}
          className="bg-pink-gradient flex-1 rounded-xl py-2.5 text-center text-[13px] font-semibold text-white shadow-sm transition hover:opacity-95 active:scale-[0.99]"
        >
          Invite friends
        </Link>
      </div>
    </header>
  );
}

function Stat({
  value,
  label,
  href,
  onClick,
}: {
  value: string;
  label: string;
  href?: string;
  onClick?: () => void;
}) {
  const body = (
    <span className="flex flex-col items-center">
      <span className="font-display text-[17px] leading-tight font-bold tracking-tight">
        {value}
      </span>
      <span className="text-muted-foreground text-[11px] leading-snug">
        {label}
      </span>
    </span>
  );
  if (href) {
    return (
      <Link href={href} className="px-1">
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="px-1">
        {body}
      </button>
    );
  }
  return <span className="px-1">{body}</span>;
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

// Device-level flags. Notification prefs persist here until the push
// integration lands. The profile-visibility flags are account-level
// (consumers.profile_* via consumer-web-update-profile, MESITA-76); their
// localStorage keys survive as the render cache / offline fallback that
// useProfileVisibilityFlag keeps in sync with the server.
const NOTIF_PUSH_KEY = "mesita:notif:push";
const NOTIF_EMAIL_KEY = "mesita:notif:email";
const PROFILE_PUBLIC_KEY = "mesita:profile:public";
const PROFILE_SHOW_SAVES_KEY = "mesita:profile:show-saves";
const PROFILE_SHOW_VISITS_KEY = "mesita:profile:show-visits";

// Grouped, row-based settings — identity edits happen in the EditProfileSheet
// (same one the hero button opens), socials connect inline, privacy + support
// are direct contact links. No payment rows: there is no Mesita Pay / wallet.
function SettingsTab({
  profile,
  email,
  loading,
  onEditProfile,
  onConnectSocial,
}: {
  profile: ConsumerProfile | null;
  email: string | null;
  loading: boolean;
  onEditProfile: () => void;
  onConnectSocial: (platform: SocialPlatform) => void;
}) {
  const { origin, followers } = useConsumerClass();
  const igConnected = origin === "instagram";

  const [publicProfile, togglePublicProfile] = useProfileVisibilityFlag(
    profile,
    "profile_public",
    PROFILE_PUBLIC_KEY,
  );
  const [showSaves, toggleShowSaves] = useProfileVisibilityFlag(
    profile,
    "profile_show_saves",
    PROFILE_SHOW_SAVES_KEY,
  );
  const [showVisits, toggleShowVisits] = useProfileVisibilityFlag(
    profile,
    "profile_show_visits",
    PROFILE_SHOW_VISITS_KEY,
  );

  const detailsSub = loading
    ? "Loading…"
    : [profile?.full_name, profile?.phone].filter(Boolean).join(" · ") ||
      "Add your details";

  return (
    <div className="flex flex-col gap-6">
      <SettingsGroup title="Account">
        <SettingsActionRow
          Icon={UserPen}
          tint="primary"
          label="Edit profile"
          sub={detailsSub}
          onClick={onEditProfile}
        />
        <RowDivider />
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
                {followers > 0
                  ? `${followers.toLocaleString("en-US")} followers · connected`
                  : "Connected"}
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
        <RowDivider />
        <ToggleRow
          Icon={Globe}
          tint="sky"
          label="Public profile"
          sub={
            publicProfile
              ? "Friends can see your social activity"
              : "Only you can see your activity"
          }
          on={publicProfile}
          onToggle={togglePublicProfile}
        />
        {publicProfile && (
          <div className="border-border/60 bg-muted/25 border-t">
            <NestedToggleRow
              Icon={Bookmark}
              label="Show saved places"
              on={showSaves}
              onToggle={toggleShowSaves}
            />
            <NestedToggleRow
              Icon={MapPin}
              label="Show visits & reviews"
              on={showVisits}
              onToggle={toggleShowVisits}
            />
          </div>
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
        <SettingsLinkRow
          Icon={Trash2}
          tint="destructive"
          href={`mailto:${MESITA_PRIVACY_EMAIL}?subject=${encodeURIComponent(
            "Delete my Mesita account",
          )}`}
          label="Delete account"
          sub="Request account deletion"
          destructive
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
  onClick,
}: {
  Icon: LucideIcon;
  tint: RowTint;
  label: string;
  sub?: string;
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
      <RowText label={label} sub={sub} />
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

// Account-level visibility flag (MESITA-76). Renders off the same
// hydration-safe localStorage store as useStoredFlag, but the server value
// from consumer-web-get-profile wins once the profile loads, and toggles
// persist through consumer-web-update-profile — optimistic flip first,
// reverted with a toast if the write fails. localStorage doubles as the
// offline fallback.
type ProfileVisibilityField = keyof ProfileVisibilityPatch;

function useProfileVisibilityFlag(
  profile: ConsumerProfile | null,
  field: ProfileVisibilityField,
  storageKey: string,
): [boolean, () => void] {
  const supabase = useBrowserSupabase();
  const on = useSyncExternalStore(
    subscribeToFlags,
    () => readFlag(storageKey, true),
    () => true,
  );

  useEffect(() => {
    const server = profile?.[field];
    if (typeof server === "boolean" && server !== readFlag(storageKey, true)) {
      writeFlag(storageKey, server);
    }
  }, [profile, field, storageKey]);

  const toggle = useCallback(() => {
    const next = !readFlag(storageKey, true);
    writeFlag(storageKey, next);
    apiUpdateProfileVisibility(supabase, { [field]: next }).catch(() => {
      writeFlag(storageKey, !next);
      toast("Couldn't save that setting — check your connection.");
    });
  }, [supabase, field, storageKey]);

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

// Indented child option under the Public-profile toggle — visually nested
// (inset background, smaller icon + switch) so the hierarchy reads at a
// glance.
function NestedToggleRow({
  Icon,
  label,
  on,
  onToggle,
}: {
  Icon: LucideIcon;
  label: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      role="switch"
      aria-checked={on}
      className="hover:bg-muted/60 flex w-full items-center gap-3 py-2.5 pr-4 pl-[30px] text-left transition"
    >
      <span className="bg-card text-foreground/60 border-border flex h-7 w-7 shrink-0 items-center justify-center rounded-full border">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1 text-[13px] font-medium">{label}</span>
      <Switch on={on} small />
    </button>
  );
}
