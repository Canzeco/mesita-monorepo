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
import { CLASSES } from "@/lib/consumer-data";
import { useConsumerClass } from "@/lib/class-context";
import { cn, errMsg } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  apiFetchConsumerProfile,
  type ConsumerProfile,
} from "@/lib/api/profile";

// The Me surface — a static identity summary followed by a stack of modular
// boxes, each opening its own bottom-sheet modal, ordered conversion →
// account → support: Class, Instagram, Personal details, Settings, Share,
// and Contact. This is a single flat page at /me
// (the old two-tab /me/class · /me/settings layout is retired); `openSettings`
// opens the Settings box on arrival for the legacy /me/settings deep link.
export function ProfileClient({
  openSettings = false,
}: {
  openSettings?: boolean;
}) {
  const supabase = useBrowserSupabase();

  // One consumer-web-get-profile read per visit; the (shell) layout already
  // guarantees the row is complete (onboarding gate).
  const [profile, setProfile] = useState<ConsumerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal state. Only one is meaningfully open at a time; each is a LocalSheet
  // kept mounted so its exit animation plays. The legacy /me/settings deep link
  // opens the Settings box — seeded from the prop so there is no
  // setState-in-effect.
  const [shareOpen, setShareOpen] = useState(false);
  const [classOpen, setClassOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(openSettings);
  const [contactOpen, setContactOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { consumer } = await apiFetchConsumerProfile(supabase);
        if (cancelled) return;
        setProfile(consumer);
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

          {/* Conversion cluster first — the free upgrade path + membership.
              These are plain action buttons: no user data (that lives in the
              card above), just what tapping them does. */}
          <BoxRow
            Icon={Instagram}
            tint="pink"
            title="Instagram"
            summary="Connect Instagram to upgrade your class"
            onClick={() => setVerifyOpen(true)}
          />

          <BoxRow
            Icon={Crown}
            tint="amber"
            title="Class"
            summary="Upgrade your class for better rewards"
            onClick={() => setClassOpen(true)}
          />

          {/* Account management. */}
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

          {/* Secondary / support — least-frequent, outward-facing. */}
          <BoxRow
            Icon={Share2}
            tint="pink"
            title="Share"
            summary="Invite friends to Mesita"
            onClick={() => setShareOpen(true)}
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

// Whole years since `birthday` (YYYY-MM-DD). Returns null for a missing or
// unparseable value so the meta line simply omits it.
function ageFromBirthday(birthday: string | null | undefined): number | null {
  if (!birthday) return null;
  const dob = new Date(birthday);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

// Title-case the stored sex enum (male/female/other) for display; null-safe.
function formatSex(sex: string | null | undefined): string | null {
  if (!sex) return null;
  return sex.charAt(0).toUpperCase() + sex.slice(1);
}

function ProfileSummaryCard({
  profile,
  loading,
}: {
  profile: ConsumerProfile | null;
  loading: boolean;
}) {
  const { key, origin, followers, handle: classHandle } = useConsumerClass();
  const isPremium = key === "premium";

  if (loading) {
    return (
      <div className="border-border bg-muted/50 overflow-hidden rounded-3xl border p-4">
        <div className="flex items-center gap-4">
          <div className="bg-muted h-[72px] w-[72px] shrink-0 animate-pulse rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="bg-muted h-4 w-40 animate-pulse rounded" />
            <div className="bg-muted h-3 w-28 animate-pulse rounded" />
          </div>
        </div>
        <div className="border-border/60 mt-4 space-y-2.5 border-t pt-3.5">
          <div className="bg-muted h-4 w-36 animate-pulse rounded" />
          <div className="bg-muted h-4 w-44 animate-pulse rounded" />
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
  const avatarUrl = profile?.avatar_url ?? null;
  const phone = profile?.phone ?? null;

  // Sex + age on one line under the phone — country is intentionally omitted.
  const age = ageFromBirthday(profile?.birthday);
  const sexLabel = formatSex(profile?.sex);
  const meta = [sexLabel, age != null ? `${age}` : null]
    .filter(Boolean)
    .join(" · ");

  // Every piece of the member's actual data lives here in the card — name,
  // phone, class, Instagram. The boxes below are pure action buttons and carry
  // no user data (so "why class?" is answered once, here).
  const classLabel = CLASSES.find((c) => c.id === key)?.label ?? "Free";
  const classVia = isPremium && origin !== "default" ? origin : null;
  // Real handle lives on the profile; fall back to the class-context handle
  // (carries the demo handle for the Instagram preview state).
  const handle = profile?.instagram_handle ?? classHandle;
  const igConnected = origin === "instagram" || Boolean(handle);

  return (
    // Branded tinted panel — a soft class-tinted gradient so the identity card
    // reads as premium and distinct from the white option boxes below (richer
    // for Premium).
    <section
      className={cn(
        "border-border overflow-hidden rounded-3xl border p-4",
        isPremium
          ? "from-primary/[0.14] via-secondary/[0.10] to-accent/[0.12] bg-gradient-to-br"
          : "from-primary/[0.08] via-secondary/[0.06] to-accent/[0.08] bg-gradient-to-br",
      )}
    >
      <div className="flex items-center gap-4">
        {/* Story-ring avatar: class-tinted gradient ring around initials. */}
        <div
          className={cn(
            "shrink-0 rounded-full p-[2.5px]",
            isPremium ? "bg-tier-premium" : "bg-pink-gradient",
          )}
        >
          <div className="bg-card rounded-full p-[2.5px]">
            <div className="bg-muted relative flex h-[66px] w-[66px] items-center justify-center overflow-hidden rounded-full">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={name}
                  fill
                  sizes="66px"
                  className="object-cover"
                />
              ) : (
                <span className="font-display text-foreground/70 text-2xl font-bold tracking-tight">
                  {initials}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Name over phone, stacked to the right of the avatar. */}
        <div className="min-w-0 flex-1">
          <h2 className="font-display truncate text-[20px] leading-tight font-bold tracking-tight">
            {name}
          </h2>
          <p
            className={cn(
              "mt-1 truncate text-[14px]",
              phone
                ? "text-muted-foreground font-medium"
                : "text-muted-foreground/70",
            )}
          >
            {phone || "No phone added"}
          </p>
          {meta && (
            <p className="text-muted-foreground/70 mt-0.5 truncate text-[13px]">
              {meta}
            </p>
          )}
        </div>
      </div>

      {/* Data block: Instagram + class, the member's real state — all of it,
          right here so the buttons below stay data-agnostic. */}
      <div className="border-border/60 mt-4 flex flex-col gap-2.5 border-t pt-3.5">
        <div className="flex items-center gap-2.5">
          <span className="bg-pink-gradient flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white shadow-sm">
            <Instagram className="h-[15px] w-[15px]" />
          </span>
          {igConnected ? (
            <>
              <span className="truncate text-[13px] font-semibold tracking-tight">
                {handle ? `@${handle}` : "Connected"}
              </span>
              {followers > 0 && (
                <span className="text-muted-foreground shrink-0 text-[12px]">
                  {followers.toLocaleString("en-US")} followers
                </span>
              )}
              <BadgeCheck className="text-foreground/60 ml-auto h-[18px] w-[18px] shrink-0" />
            </>
          ) : (
            <span className="text-muted-foreground/80 text-[13px]">
              Not connected
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg shadow-sm",
              isPremium
                ? "bg-tier-premium text-white"
                : "bg-amber-400/20 text-amber-700",
            )}
          >
            <Crown className="h-[15px] w-[15px]" />
          </span>
          <span className="text-[13px] font-semibold tracking-tight">
            Mesita {classLabel}
          </span>
          {classVia && (
            <span className="text-muted-foreground text-[12px]">
              via {classVia}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Modular boxes ─────────────────────────────────────────────────────────

type BoxTint =
  | "pink"
  | "sky"
  | "emerald"
  | "violet"
  | "amber"
  | "muted"
  | "premium";

// Each option-box icon gets its own tinted circle so the Me page reads as a
// premium, colorful surface (never a flat gray stack).
const BOX_TINT: Record<BoxTint, string> = {
  pink: "bg-pink-gradient text-white",
  sky: "bg-sky-500/15 text-sky-600",
  emerald: "bg-emerald-500/15 text-emerald-600",
  violet: "bg-violet-500/15 text-violet-600",
  amber: "bg-amber-400/20 text-amber-700",
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
