"use client";

import { useEffect, useState, Fragment, type ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Instagram,
  ChevronRight,
  Check,
  BadgeCheck,
  Crown,
  Share2,
  Smile,
  User as UserIcon,
  CreditCard,
  Bell,
  Shield,
  HelpCircle,
} from "lucide-react";
import { SignOutButton } from "@/components/auth/SignOutButton";
import {
  VerifySocialSheet,
  type SocialPlatform,
} from "@/components/consumer/VerifySocialSheet";
import { TIERS, tierBadgeClass } from "@/lib/consumer-data";
import { useMembership } from "@/lib/membership-context";
import { cn, errMsg } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  apiFetchConsumerProfile,
  apiUpdateConsumerProfile,
  type ConsumerProfile,
} from "@/lib/api/profile";

// Three-tab Profile. Invite is folded in as a sub-tab; the standalone
// /invite route is primary and /share stays as a legacy deep link alias.
// The Coupons tab was removed —
// coupons are "hidden" (users save the place, redeem a QR at the place),
// so the wallet surface didn't earn its spot in the Profile.
export type ProfileTab = "plan" | "settings";

const TABS: { id: ProfileTab; label: string; href: string }[] = [
  { id: "plan", label: "Plan", href: CONSUMER_ROUTES.me.plan },
  { id: "settings", label: "Settings", href: CONSUMER_ROUTES.me.settings },
];

// Profile shell. The previous large avatar + name + "country · age ·
// sex" hero block was removed — the TopBar already renders the user's
// display name in the center column and the class chip on the right,
// so the inline block was duplicate chrome that ate vertical space.
// Identity-driven copy ships back here when there's something
// genuinely useful to surface (e.g. a per-user CTA), not before.
//
// The consumer (shell) layout enforces onboarding completion before
// this page renders, so all identity fields are already guaranteed
// real upstream.

export function ProfileClient({ initialTab }: { initialTab: ProfileTab }) {
  const tab = initialTab;
  const [verifyPlatform, setVerifyPlatform] = useState<SocialPlatform | null>(
    null,
  );

  // Post-checkout landing. The subscribe flow redirects to
  // /me/plan?subscription=success once the membership grant lands (instant in
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
      <div className="px-4 pt-4">
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

      <div className="scrollbar-hide flex-1 overflow-y-auto">
        {tab === "plan" && (
          <div className="px-5 pt-5 pb-8">
            <ClassTab onConnectSocial={(p) => setVerifyPlatform(p)} />
          </div>
        )}
        {tab === "settings" && (
          <div className="px-5 pt-5 pb-8">
            <SettingsTab />
          </div>
        )}
      </div>

      {verifyPlatform && (
        <VerifySocialSheet
          platform={verifyPlatform}
          onClose={() => setVerifyPlatform(null)}
        />
      )}
    </div>
  );
}

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
        <SectionEyebrow>Current plan</SectionEyebrow>
        <CurrentClassCard />
      </section>
      <section className="flex flex-col gap-2">
        <SectionEyebrow>Comparison</SectionEyebrow>
        <FreeVsPremium />
      </section>
      <section className="flex flex-col gap-2">
        <SectionEyebrow>Plans</SectionEyebrow>
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

// Horizontal scroller, one card per path: stay Free, or reach Premium by
// Instagram / Subscription / Invitation. Each card states the requirement +
// its action; the user's current path is flagged.
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
  const premium = TIERS.find((t) => t.id === "premium")!;
  const { tier, origin, followers } = useMembership();
  const isFree = tier === "free";

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
      reachedLabel: "Current plan",
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
      key: "subscription",
      icon: CreditCard,
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
  // Current-plan banner — plan name + an origin icon and a short "via …"
  // line so a Premium member sees how they got it (Instagram / subscription
  // / invitation). No follower count — just the door.
  const { tier, origin } = useMembership();
  const meta = TIERS.find((t) => t.id === tier)!;
  const brand = `Mesita ${meta.label}`;
  const isPremium = tier === "premium";
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
        tierBadgeClass(tier),
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

// Settings row config — each row carries the route it should drive when
// the corresponding screen ships. Rows where we already have a real route
// link directly; the rest fire a toast pointing at the support email so
// users have somewhere to go right now.

const MESITA_SUPPORT_EMAIL = "support@mesita.ai";
const MESITA_PRIVACY_EMAIL = "privacy@mesita.ai";
const NOTIF_PUSH_KEY = "mesita:notif:push";
const NOTIF_EMAIL_KEY = "mesita:notif:email";

// Single-page settings. Everything is configured inline here — no nested
// drill-in screens. Personal details write through consumer-update-profile;
// notification toggles persist on the device until the push integration
// lands; privacy + support are direct contact links.
function SettingsTab() {
  const supabase = useBrowserSupabase();

  const [profile, setProfile] = useState<ConsumerProfile | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

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
        setFirstName(consumer.first_name ?? "");
        setLastName(consumer.last_name ?? "");
        setPhone(consumer.phone ?? authRes.data.user?.phone ?? "");
        setEmail(authRes.data.user?.email ?? null);
      } catch (e) {
        if (!cancelled) toast(errMsg(e, "Couldn't load your details."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const dirty =
    !!profile &&
    (firstName.trim() !== (profile.first_name ?? "") ||
      lastName.trim() !== (profile.last_name ?? "") ||
      phone.trim() !== (profile.phone ?? ""));

  const saveDetails = async () => {
    if (!profile || !dirty || saving) return;
    if (!firstName.trim() || !lastName.trim()) {
      toast("First and last name are required.");
      return;
    }
    setSaving(true);
    try {
      // Preserve the fields not edited here (sex/birthday/country) so the
      // required-field EF contract stays satisfied.
      const updated = await apiUpdateConsumerProfile(supabase, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        sex: (profile.sex as "male" | "female" | "other") ?? "other",
        birthday: profile.birthday ?? "",
        country: profile.country ?? "",
        phone: phone.trim() || undefined,
      });
      setProfile(updated);
      toast("Details saved.");
    } catch (e) {
      toast(errMsg(e, "Couldn't save your details."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Invite — promoted out of the bottom tab bar into Profile. Kept
          prominent (pink-gradient card) since it's a growth surface. */}
      <Link
        href={CONSUMER_ROUTES.share}
        className="bg-pink-gradient shadow-glow flex items-center gap-3 rounded-2xl p-4 text-white transition hover:opacity-95"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20">
          <Share2 className="h-5 w-5" />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-semibold">Invite friends</span>
          <span className="block text-xs text-white/85">
            Share Mesita — you both get rewards
          </span>
        </span>
        <ChevronRight className="h-5 w-5 text-white/80" />
      </Link>

      {/* Personal details — editable inline. */}
      <SettingsSection Icon={UserIcon} title="Personal details">
        {loading ? (
          <p className="text-muted-foreground px-4 py-3 text-sm">Loading…</p>
        ) : (
          <div className="flex flex-col gap-3 p-4">
            <div className="grid grid-cols-2 gap-3">
              <SettingsField
                label="First name"
                value={firstName}
                onChange={setFirstName}
                placeholder="First name"
              />
              <SettingsField
                label="Last name"
                value={lastName}
                onChange={setLastName}
                placeholder="Last name"
              />
            </div>
            <SettingsField
              label="Phone"
              value={phone}
              onChange={setPhone}
              placeholder="+52 …"
              inputMode="tel"
            />
            <div>
              <span className="text-muted-foreground mb-1 block text-[11px] font-medium">
                Email
              </span>
              <p className="border-border bg-muted/40 text-muted-foreground rounded-lg border px-3 py-2 text-sm">
                {email ?? "—"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void saveDetails()}
              disabled={!dirty || saving}
              className="btn-primary mt-1 py-2.5 text-sm disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        )}
      </SettingsSection>

      {/* Notifications — device-level toggles until push lands. */}
      <SettingsSection Icon={Bell} title="Notifications">
        <div className="flex flex-col">
          <NotificationToggle
            storageKey={NOTIF_PUSH_KEY}
            label="Push notifications"
            sub="Ticket updates and rewards"
          />
          <div className="border-border border-t" />
          <NotificationToggle
            storageKey={NOTIF_EMAIL_KEY}
            label="Email"
            sub="Receipts and news"
          />
        </div>
      </SettingsSection>

      {/* Privacy & data + Help — direct contact links. */}
      <SettingsSection Icon={Shield} title="Privacy & data">
        <div className="flex flex-col">
          <SettingsLinkRow
            href={`mailto:${MESITA_PRIVACY_EMAIL}?subject=${encodeURIComponent(
              "Export my Mesita data",
            )}`}
            label="Export my data"
            sub={MESITA_PRIVACY_EMAIL}
          />
          <div className="border-border border-t" />
          <SettingsLinkRow
            href={`mailto:${MESITA_PRIVACY_EMAIL}?subject=${encodeURIComponent(
              "Delete my Mesita account",
            )}`}
            label="Delete account"
            sub="Request account deletion"
          />
        </div>
      </SettingsSection>

      <SettingsSection Icon={HelpCircle} title="Help & support">
        <div className="flex flex-col">
          <SettingsLinkRow
            href={`mailto:${MESITA_SUPPORT_EMAIL}`}
            label="Contact us"
            sub={MESITA_SUPPORT_EMAIL}
          />
        </div>
      </SettingsSection>

      <SignOutButton
        redirectTo="/"
        className="border-border bg-card hover:bg-muted flex w-full items-center justify-center gap-2 rounded-lg border py-4 text-sm font-semibold transition"
      />
      <p className="text-muted-foreground -mt-3 text-center text-[11px]">
        Mesita · v2.4.1
      </p>
    </div>
  );
}

function SettingsSection({
  Icon,
  title,
  children,
}: {
  Icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <p className="text-muted-foreground mb-2 flex items-center gap-1.5 text-[11px] font-medium tracking-[0.18em] uppercase">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </p>
      <div className="border-border bg-card overflow-hidden rounded-2xl border">
        {children}
      </div>
    </section>
  );
}

function SettingsField({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "text" | "tel";
}) {
  return (
    <label className="block">
      <span className="text-muted-foreground mb-1 block text-[11px] font-medium">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="border-border bg-background focus:border-primary w-full rounded-lg border px-3 py-2 text-sm outline-none"
      />
    </label>
  );
}

function NotificationToggle({
  storageKey,
  label,
  sub,
}: {
  storageKey: string;
  label: string;
  sub: string;
}) {
  const [on, setOn] = useState(true);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored != null) setOn(stored === "1");
    } catch {
      // localStorage unavailable — keep the default.
    }
  }, [storageKey]);

  const toggle = () => {
    setOn((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {
        // best-effort persistence
      }
      return next;
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={on}
      className="hover:bg-muted flex w-full items-center gap-3 px-4 py-3 text-left transition"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="text-muted-foreground block text-[11px]">{sub}</span>
      </span>
      <span
        className={cn(
          "relative h-6 w-10 shrink-0 rounded-full transition",
          on ? "bg-pink-gradient" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
            on ? "left-[18px]" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}

function SettingsLinkRow({
  href,
  label,
  sub,
}: {
  href: string;
  label: string;
  sub: string;
}) {
  return (
    <a
      href={href}
      className="hover:bg-muted flex w-full items-center gap-3 px-4 py-3 text-left transition"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="text-muted-foreground block text-[11px]">{sub}</span>
      </span>
      <ChevronRight className="text-muted-foreground h-4 w-4" />
    </a>
  );
}
