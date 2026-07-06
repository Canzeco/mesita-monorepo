"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  ChevronRight,
  Crown,
  Instagram,
  MessageCircle,
  Phone,
  Settings as SettingsIcon,
  Share2,
  UserRound,
} from "lucide-react";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { DeleteAccountSheet } from "@/components/consumer/DeleteAccountSheet";
import { EditProfileSheet } from "@/components/consumer/EditProfileSheet";
import { VerifySocialSheet } from "@/components/consumer/VerifySocialSheet";
import { ShareModal } from "@/components/consumer/me/ShareModal";
import { ClassModal } from "@/components/consumer/me/ClassModal";
import { SettingsModal } from "@/components/consumer/me/SettingsModal";
import { ContactModal } from "@/components/consumer/me/ContactModal";
import { COUNTRIES, CLASSES } from "@/lib/consumer-data";
import { useConsumerClass } from "@/lib/class-context";
import { cn, errMsg } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  apiFetchConsumerProfile,
  type ConsumerProfile,
} from "@/lib/api/profile";

// The Me surface — a static identity summary followed by a stack of modular
// boxes, each opening its own bottom-sheet modal: Share, Class, Instagram,
// Personal details, Settings, and Contact. The old two-tab
// (Class / Settings) layout was replaced; both /me/class and /me/settings
// still render this page, and /me/settings opens the Settings box on arrival.
export type ProfileTab = "class" | "settings";

export function ProfileClient({ initialTab }: { initialTab: ProfileTab }) {
  const supabase = useBrowserSupabase();

  // One consumer-web-get-profile read per visit; the (shell) layout already
  // guarantees the row is complete (onboarding gate).
  const [profile, setProfile] = useState<ConsumerProfile | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal state. Only one is meaningfully open at a time; each is a LocalSheet
  // kept mounted so its exit animation plays. /me/settings deep-links open the
  // Settings box — seeded from the prop so there is no setState-in-effect.
  const [shareOpen, setShareOpen] = useState(false);
  const [classOpen, setClassOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(initialTab === "settings");
  const [contactOpen, setContactOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

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

  // Post-checkout / Instagram-verify landing. The subscribe + verify flows
  // redirect here with a status query; confirm it with a toast (the full page
  // load already re-seeded the real membership upstream). Read straight off
  // the URL so the page carries no prerender-bailout requirement.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("subscription");
    if (status === "success") {
      toast.success("You're Mesita Premium — welcome in.");
    } else if (status === "cancelled") {
      toast("Checkout cancelled — you can subscribe anytime.");
    }
    if (params.get("instagram") === "success") {
      toast.success("Instagram connected — Mesita Premium unlocked.");
    }
  }, []);

  // Instagram connect is triggered from two boxes (Instagram, Class) — close
  // the Class sheet first so two LocalSheets never stack at z-[130].
  function openVerify() {
    setClassOpen(false);
    setVerifyOpen(true);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="scrollbar-hide flex-1 overflow-y-auto px-4 pt-5 pb-8">
        <div className="flex flex-col gap-3">
          <ProfileSummaryCard profile={profile} loading={loading} />

          <BoxRow
            Icon={Share2}
            tint="pink"
            title="Share"
            summary="Invite friends to Mesita"
            onClick={() => setShareOpen(true)}
          />

          <ClassBox onClick={() => setClassOpen(true)} />

          <InstagramBox profile={profile} onClick={() => setVerifyOpen(true)} />

          <BoxRow
            Icon={UserRound}
            tint="sky"
            title="Personal details"
            summary="Name, phone, birthday, photo"
            onClick={() => profile && setEditOpen(true)}
            disabled={!profile}
          />

          <BoxRow
            Icon={SettingsIcon}
            tint="muted"
            title="Settings"
            summary="Notifications, permissions, language"
            onClick={() => setSettingsOpen(true)}
          />

          <BoxRow
            Icon={MessageCircle}
            tint="emerald"
            title="Contact"
            summary="Email, help, Instagram"
            onClick={() => setContactOpen(true)}
          />

          <SignOutButton
            redirectTo="/"
            className="border-border bg-card hover:bg-muted mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border py-4 text-sm font-semibold transition"
          />
          <p className="text-muted-foreground -mt-1 text-center text-[11px]">
            Mesita · v2.4.1
          </p>
        </div>
      </div>

      {/* All modals kept mounted; LocalSheet plays the exit animation before
          going inert. */}
      <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} />
      <ClassModal
        open={classOpen}
        onClose={() => setClassOpen(false)}
        onConnectInstagram={openVerify}
      />
      <VerifySocialSheet
        platform="instagram"
        open={verifyOpen}
        onClose={() => setVerifyOpen(false)}
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
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onDeleteAccount={() => setDeleteOpen(true)}
      />
      <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} />
      <DeleteAccountSheet
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
      />
    </div>
  );
}

// ─── Profile summary (static, not clickable) ──────────────────────────────

function ProfileSummaryCard({
  profile,
  loading,
}: {
  profile: ConsumerProfile | null;
  loading: boolean;
}) {
  const { key, origin } = useConsumerClass();
  const isPremium = key === "premium";

  if (loading) {
    return (
      <div
        className={cn(
          "border-border overflow-hidden rounded-3xl border p-4",
          isPremium
            ? "from-primary/[0.14] via-secondary/[0.10] to-accent/[0.12] bg-gradient-to-br"
            : "from-primary/[0.07] via-secondary/[0.06] to-accent/[0.07] bg-gradient-to-br",
        )}
      >
        <div className="flex flex-col items-center gap-2 pb-3">
          <div className="bg-muted h-[68px] w-[68px] shrink-0 animate-pulse rounded-full" />
          <div className="bg-muted h-4 w-40 animate-pulse rounded" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-card/70 h-[54px] animate-pulse rounded-2xl"
            />
          ))}
        </div>
      </div>
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
  const handle = profile?.instagram_handle ?? null;
  const avatarUrl = profile?.avatar_url ?? null;
  // The profile is "verified" once an Instagram account is claimed — that's
  // the real verification mechanic (a subscription doesn't verify identity).
  const verified = Boolean(handle) || origin === "instagram";

  return (
    <section
      className={cn(
        "border-border overflow-hidden rounded-3xl border p-4",
        // Tinted card so it reads as a distinct panel from the white option
        // boxes below; the white fact tiles pop against it (richer for Premium).
        isPremium
          ? "from-primary/[0.14] via-secondary/[0.10] to-accent/[0.12] bg-gradient-to-br"
          : "from-primary/[0.07] via-secondary/[0.06] to-accent/[0.07] bg-gradient-to-br",
      )}
    >
      {/* Centered hero — avatar on top, name centered below it. */}
      <div className="flex flex-col items-center gap-2 pb-3 text-center">
        {/* Story-ring avatar: class-tinted gradient ring around initials. */}
        <div
          className={cn(
            "shrink-0 rounded-full p-[2.5px]",
            isPremium ? "bg-tier-premium" : "bg-pink-gradient",
          )}
        >
          <div className="bg-card rounded-full p-[2.5px]">
            <div className="bg-muted relative flex h-[64px] w-[64px] items-center justify-center overflow-hidden rounded-full">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={name}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              ) : (
                <span className="font-display text-foreground/70 text-xl font-bold tracking-tight">
                  {initials}
                </span>
              )}
            </div>
          </div>
        </div>

        <h2 className="font-display flex max-w-full items-center justify-center gap-1.5 text-[19px] leading-tight font-bold tracking-tight">
          <span className="truncate">{name}</span>
          {verified && (
            <BadgeCheck className="text-premium h-5 w-5 shrink-0" />
          )}
        </h2>
      </div>

      {/* Four white fact tiles — phone, Instagram, class, country — popping
          against the tinted card. */}
      <div className="grid grid-cols-2 gap-2">
        <FactTile
          Icon={Phone}
          tint="sky"
          label="Phone"
          value={profile?.phone || "Not added"}
          muted={!profile?.phone}
        />
        <FactTile
          Icon={Instagram}
          tint="pink"
          label="Instagram"
          value={handle ? `@${handle}` : "Not connected"}
          muted={!handle}
        />
        <FactTile
          Icon={Crown}
          tint={isPremium ? "premium" : "amber"}
          label="Class"
          value={`Mesita ${classLabel}`}
        />
        <FactTile
          emoji={country?.flag ?? "🌐"}
          tint="neutral"
          label="Country"
          value={country?.name ?? "Not set"}
          muted={!country}
        />
      </div>
    </section>
  );
}

type FactTint =
  | "sky"
  | "pink"
  | "premium"
  | "amber"
  | "emerald"
  | "violet"
  | "neutral";

const FACT_TINT: Record<FactTint, string> = {
  sky: "bg-sky-500/[0.12] text-sky-600",
  pink: "bg-pink-gradient text-white",
  premium: "bg-tier-premium text-white",
  amber: "bg-amber-500/15 text-amber-600",
  emerald: "bg-emerald-500/[0.12] text-emerald-600",
  violet: "bg-violet-500/[0.12] text-violet-600",
  neutral: "bg-muted text-foreground/70",
};

function FactTile({
  Icon,
  emoji,
  tint,
  label,
  value,
  muted,
}: {
  Icon?: LucideIcon;
  emoji?: string;
  tint: FactTint;
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="bg-card ring-border/50 flex items-center gap-2.5 rounded-2xl p-2.5 shadow-sm ring-1">
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[14px] shadow-sm",
          FACT_TINT[tint],
        )}
      >
        {Icon ? (
          <Icon className="h-[18px] w-[18px]" />
        ) : (
          <span aria-hidden>{emoji}</span>
        )}
      </span>
      <div className="min-w-0">
        <p className="text-muted-foreground text-[9.5px] leading-none font-semibold tracking-[0.1em] uppercase">
          {label}
        </p>
        <p
          className={cn(
            "mt-1 truncate text-[13px] font-bold",
            muted && "text-muted-foreground font-medium",
          )}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

// ─── Modular boxes ─────────────────────────────────────────────────────────

type BoxTint = "pink" | "sky" | "emerald" | "violet" | "muted" | "premium";

const BOX_TINT: Record<BoxTint, string> = {
  pink: "bg-pink-gradient text-white",
  sky: "bg-sky-500/10 text-sky-600",
  emerald: "bg-emerald-500/10 text-emerald-600",
  violet: "bg-violet-500/10 text-violet-600",
  muted: "bg-muted text-foreground/70",
  premium: "bg-tier-premium text-white",
};

function BoxShell({
  iconTint,
  icon,
  title,
  summary,
  trailing,
  onClick,
  disabled,
}: {
  iconTint: BoxTint;
  icon: ReactNode;
  title: string;
  summary: string;
  trailing?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "border-border bg-card flex w-full items-center gap-3.5 rounded-2xl border p-4 text-left transition active:scale-[0.99]",
        disabled ? "opacity-60" : "hover:bg-muted/50",
      )}
    >
      <span
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-sm",
          BOX_TINT[iconTint],
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold tracking-tight">
          {title}
        </span>
        <span className="text-muted-foreground block truncate text-[12px]">
          {summary}
        </span>
      </span>
      {trailing}
      <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
    </button>
  );
}

function BoxRow({
  Icon,
  tint,
  title,
  summary,
  onClick,
  disabled,
}: {
  Icon: LucideIcon;
  tint: BoxTint;
  title: string;
  summary: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <BoxShell
      iconTint={tint}
      icon={<Icon className="h-[22px] w-[22px]" />}
      title={title}
      summary={summary}
      onClick={onClick}
      disabled={disabled}
    />
  );
}

function ClassBox({ onClick }: { onClick: () => void }) {
  const { key, origin } = useConsumerClass();
  const isPremium = key === "premium";
  const label = CLASSES.find((c) => c.id === key)?.label ?? "Free";
  const via = isPremium && origin !== "default" ? ` · via ${origin}` : "";
  return (
    <BoxShell
      iconTint={isPremium ? "premium" : "muted"}
      icon={<Crown className="h-[22px] w-[22px]" />}
      title="Class"
      summary={`Mesita ${label}${via}`}
      trailing={
        !isPremium ? (
          <span className="bg-tier-premium/10 text-premium mr-1 inline-flex shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold">
            Upgrade
          </span>
        ) : undefined
      }
      onClick={onClick}
    />
  );
}

function InstagramBox({
  profile,
  onClick,
}: {
  profile: ConsumerProfile | null;
  onClick: () => void;
}) {
  const { origin, followers } = useConsumerClass();
  const handle = profile?.instagram_handle ?? null;
  const connected = origin === "instagram" || Boolean(handle);
  const summary = connected
    ? [
        handle && `@${handle}`,
        followers > 0 && `${followers.toLocaleString("en-US")} followers`,
      ]
        .filter(Boolean)
        .join(" · ") || "Connected"
    : "Add Instagram to unlock Premium";
  return (
    <BoxShell
      iconTint="pink"
      icon={<Instagram className="h-[22px] w-[22px]" />}
      title="Instagram"
      summary={summary}
      trailing={
        connected ? (
          <BadgeCheck className="mr-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        ) : undefined
      }
      onClick={onClick}
    />
  );
}

