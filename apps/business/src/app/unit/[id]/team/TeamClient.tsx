"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Copy,
  Crown,
  Instagram,
  Loader2,
  Mail,
  MessageCircle,
  Phone as PhoneIcon,
  Plus,
  Send,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { cn, errMsg } from "@/lib/utils";
import {
  ERROR_BOX_CLASS,
  ICON_BUTTON_CLASS,
  INFO_BOX_CLASS,
  PILL_BUTTON_CLASS,
  TINY_LABEL_CLASS,
} from "@/lib/ui-classes";
import { EmptyState, Section } from "@/components/shared";
import { PhonePicker } from "@/components/ui/phone-picker";
import {
  apiInviteEditor,
  apiInviteWaiter,
  apiListTeam,
  apiRemoveMember,
  apiTestWaiterChannel,
  apiUpdateMemberRole,
  type BusinessRole,
  type RemoveKind,
  type TeamSnapshot,
} from "@/lib/api/team";

// member_role enum values, surfaced as "Owner / Editor / Viewer" on
// the Team page. Migration 0025 swapped legacy 'manager' → 'editor'.
const ROLE_LABEL: Record<BusinessRole, string> = {
  owner: "Owner",
  editor: "Editor",
  viewer: "Viewer",
};

const ROLE_CHOICES: BusinessRole[] = ["owner", "editor", "viewer"];
const MANAGER_ROLE_CHOICES: BusinessRole[] = ["owner", "editor"];

type InviteOpen = null | "manager" | "waiter" | "pr";

// In-app confirmation, replacing native window.confirm so destructive
// actions get a styled dialog instead of the browser's gray box.
type ConfirmState = {
  title: string;
  body: string;
  confirmLabel: string;
  tone: "default" | "destructive";
  onConfirm: () => void;
};

export function TeamClient({
  venueId,
  currentUserId,
  initialSnapshot,
}: {
  venueId: string;
  currentUserId: string;
  initialSnapshot: TeamSnapshot;
}) {
  const supabase = useBrowserSupabase();
  // Seeded from the server fetch in page.tsx — no client-side initial
  // load, no second loading indicator. refresh() still runs after every
  // mutating handler to keep the list in sync.
  const [snapshot, setSnapshot] = useState<TeamSnapshot>(initialSnapshot);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState<InviteOpen>(null);
  const [mockPrInstagrams, setMockPrInstagrams] = useState<string[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await apiListTeam(supabase, venueId);
      setSnapshot(next);
      setError(null);
      return next;
    } catch (err) {
      setError(errMsg(err, "Couldn't load the team."));
      return null;
    }
  }, [supabase, venueId]);

  const isOwner =
    snapshot.myRole === "owner" || snapshot.myRole === "super_admin";
  const managers = snapshot.businesses.filter((m) => m.role !== "viewer");
  const pendingManagerInvites = snapshot.pendingBusinessInvites.filter(
    (inv) => inv.role !== "viewer",
  );
  const waiterCount = snapshot.waiters.length;
  const prCount = snapshot.waiters.length + mockPrInstagrams.length;

  // Wrap any mutating action in the shared busy/error/refresh frame.
  async function runAction(
    key: string,
    fn: () => Promise<unknown>,
    failureMessage: string,
  ) {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setError(errMsg(err, failureMessage));
    } finally {
      setBusy(null);
    }
  }

  const handleInviteManager = (email: string, role: BusinessRole) =>
    runAction(
      "invite-manager",
      async () => {
        await apiInviteEditor(supabase, {
          venueId,
          email,
          role,
          redirectBase: window.location.origin,
        });
        setInviteOpen(null);
      },
      "Couldn't send that manager invite.",
    );

  const handleInvitePr = (
    channel: "whatsapp" | "sms" | "instagram",
    value: string,
  ) => {
    if (channel === "instagram") {
      const raw = value.trim();
      if (!raw) return;
      const normalized = `@${raw.replace(/^@+/, "")}`;
      setMockPrInstagrams((prev) =>
        prev.includes(normalized) ? prev : [...prev, normalized],
      );
      setInviteOpen(null);
      return;
    }
    return runAction(
      "invite-pr",
      async () => {
        await apiInviteWaiter(supabase, {
          venueId,
          channel,
          phone: value || undefined,
          redirectBase: window.location.origin,
        });
        setInviteOpen(null);
      },
      `Couldn't connect that PR ${channel === "whatsapp" ? "WhatsApp" : "SMS"}.`,
    );
  };

  const handleInviteWaiter = (channel: "whatsapp" | "sms", phone: string) =>
    runAction(
      "invite-waiter",
      async () => {
        await apiInviteWaiter(supabase, {
          venueId,
          channel,
          phone: phone || undefined,
          redirectBase: window.location.origin,
        });
        setInviteOpen(null);
      },
      "Couldn't create that waiter invite.",
    );

  const handleChangeRole = (
    memberId: string,
    role: BusinessRole,
    currentRole: BusinessRole,
    name: string,
  ) => {
    if (role === currentRole) return;
    setConfirmState({
      title: "Change role",
      body: `Change ${name}'s role from ${ROLE_LABEL[currentRole]} to ${ROLE_LABEL[role]}?`,
      confirmLabel: "Change role",
      tone: "default",
      onConfirm: () =>
        runAction(
          `role-${memberId}`,
          () => apiUpdateMemberRole(supabase, { memberId, role }),
          "Couldn't change that role.",
        ),
    });
  };

  const handleRemoveEditor = (
    memberId: string,
    name: string,
    isSelf: boolean,
  ) => {
    setConfirmState({
      title: isSelf ? "Leave venue" : "Remove member",
      body: isSelf
        ? "Leave this venue? You'll lose dashboard access."
        : `Remove ${name} from this venue? They'll lose dashboard access.`,
      confirmLabel: isSelf ? "Leave" : "Remove",
      tone: "destructive",
      onConfirm: () =>
        runAction(
          `remove-${memberId}`,
          () => apiRemoveMember(supabase, { id: memberId, kind: "editor" }),
          "Couldn't remove that member.",
        ),
    });
  };

  const handleRemove = (id: string, kind: RemoveKind, confirmText: string) => {
    const isRevoke = /^revoke/i.test(confirmText);
    setConfirmState({
      title: isRevoke ? "Revoke invite" : "Remove",
      body: confirmText,
      confirmLabel: isRevoke ? "Revoke" : "Remove",
      tone: "destructive",
      onConfirm: () =>
        runAction(
          `remove-${id}`,
          () => apiRemoveMember(supabase, { id, kind }),
          "Couldn't remove that entry.",
        ),
    });
  };

  const handleTestPing = (channel: "whatsapp" | "sms", phone: string) => {
    const label = channel === "whatsapp" ? "WhatsApp" : "SMS";
    setConfirmState({
      title: "Send test message",
      body: `Send a test ${label} message to ${phone}?`,
      confirmLabel: "Send",
      tone: "default",
      onConfirm: () =>
        runAction(
          `ping-${phone}`,
          async () => {
            const res = await apiTestWaiterChannel(supabase, {
              venueId,
              channel,
              phone,
            });
            setNotice(
              res.mock
                ? `Test ping queued — ${res.note}`
                : `Test ${res.channel} sent to ${res.to}.`,
            );
          },
          "Couldn't send a test ping.",
        ),
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {error && <div className={ERROR_BOX_CLASS}>{error}</div>}
      {notice && <div className={INFO_BOX_CLASS}>{notice}</div>}

      {confirmState && (
        <ConfirmDialog
          {...confirmState}
          onCancel={() => setConfirmState(null)}
          onConfirm={() => {
            const run = confirmState.onConfirm;
            setConfirmState(null);
            run();
          }}
        />
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <TeamStatPill
          label="Managers"
          value={managers.length}
          hint={`${pendingManagerInvites.length} pending`}
        />
        <TeamStatPill
          label="Waiters"
          value={waiterCount}
          hint={`${waiterCount} active`}
        />
        <TeamStatPill
          label="PR channels"
          value={prCount}
          hint={`${prCount} active`}
        />
      </div>

      {/* ── Managers ─────────────────────────────────────────────── */}
      <Section
        title="Managers"
        description="Core team with dashboard access."
        right={
          isOwner && (
            <InviteButton
              label="Invite manager"
              open={inviteOpen === "manager"}
              onClick={() =>
                setInviteOpen(inviteOpen === "manager" ? null : "manager")
              }
            />
          )
        }
      >
        {inviteOpen === "manager" && (
          <EditorInviteForm
            busy={busy === "invite-manager"}
            onSubmit={handleInviteManager}
            roleChoices={MANAGER_ROLE_CHOICES}
            defaultRole="editor"
            submitLabel="Send manager invite"
          />
        )}

        {managers.length === 0 ? (
          <p className="text-muted-foreground text-sm">No managers yet.</p>
        ) : (
          <ul className="divide-border/60 divide-y">
            {managers.map((m) => (
              <li
                key={m.memberId}
                className="hover:bg-muted/25 flex items-center gap-3 rounded-xl px-2 py-2.5 transition"
              >
                <Avatar
                  initial={initialOf(m.fullName, m.email)}
                  tint="bg-pink-gradient"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-[13px] font-semibold">
                      {m.fullName ?? m.email ?? "—"}
                    </p>
                    {m.role === "owner" && (
                      <Crown className="text-tier-gold h-3 w-3" />
                    )}
                  </div>
                  <p className="text-muted-foreground truncate text-[11px]">
                    {m.email ?? "—"}
                  </p>
                </div>
                <RoleSelect
                  role={(m.role as BusinessRole) ?? "editor"}
                  choices={ROLE_CHOICES}
                  disabled={
                    !isOwner ||
                    busy === `role-${m.memberId}` ||
                    m.userId === currentUserId
                  }
                  onChange={(r) =>
                    handleChangeRole(
                      m.memberId,
                      r,
                      (m.role as BusinessRole) ?? "editor",
                      m.fullName ?? m.email ?? "this editor",
                    )
                  }
                />
                <RemoveButton
                  busy={busy === `remove-${m.memberId}`}
                  hidden={!isOwner && m.userId !== currentUserId}
                  label={
                    m.userId === currentUserId
                      ? "Leave venue"
                      : `Remove ${m.fullName ?? m.email}`
                  }
                  onClick={() =>
                    handleRemoveEditor(
                      m.memberId,
                      m.fullName ?? m.email ?? "this editor",
                      m.userId === currentUserId,
                    )
                  }
                />
              </li>
            ))}
          </ul>
        )}

        {pendingManagerInvites.length > 0 && (
          <PendingGroup>
            {pendingManagerInvites.map((inv) => (
              <PendingRow
                key={inv.id}
                icon={<Mail className="text-muted-foreground h-3.5 w-3.5" />}
                title={inv.email}
                subtitle={`Invited as ${teamRoleLabel((inv.role as BusinessRole) ?? "editor")} · expires ${formatRelative(inv.expiresAt)}`}
              >
                <CopyButton
                  text={buildAcceptUrl(inv.token)}
                  label="Copy invite link"
                />
                {isOwner && (
                  <RemoveButton
                    busy={busy === `remove-${inv.id}`}
                    label="Revoke invite"
                    onClick={() =>
                      handleRemove(
                        inv.id,
                        "editorInvite",
                        "Revoke this invite?",
                      )
                    }
                  />
                )}
              </PendingRow>
            ))}
          </PendingGroup>
        )}
      </Section>

      {/* ── Waiters ──────────────────────────────────────────────── */}
      <Section
        title="Waiters"
        description="Floor team that validates tickets from their phone."
        right={
          <InviteButton
            label="Add waiter"
            open={inviteOpen === "waiter"}
            onClick={() =>
              setInviteOpen(inviteOpen === "waiter" ? null : "waiter")
            }
          />
        }
      >
        {inviteOpen === "waiter" && (
          <WaiterInviteForm
            busy={busy === "invite-waiter"}
            onSubmit={handleInviteWaiter}
            onPing={handleTestPing}
          />
        )}

        {snapshot.waiters.length === 0 &&
        inviteOpen !== "waiter" ? (
          <EmptyState
            icon={<MessageCircle className="text-muted-foreground h-5 w-5" />}
            title="No waiters yet"
            description="Invite your floor staff so they can validate tickets from their own phone."
            className="border-border/60 bg-muted/20 rounded-xl border p-7"
          />
        ) : snapshot.waiters.length === 0 ? (
          <p className="text-muted-foreground text-sm">No waiters yet.</p>
        ) : (
          <ul className="divide-border/60 divide-y">
            {snapshot.waiters.map((w) => (
              <li
                key={`${w.userId}:${venueId}`}
                className="hover:bg-muted/25 flex items-center gap-3 rounded-xl px-2 py-2.5 transition"
              >
                <Avatar
                  initial={(w.phone ?? "?").slice(-2)}
                  tint="bg-whatsapp/15 text-whatsapp-deep"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-[13px] font-semibold">
                    {w.phone ?? "—"}
                  </p>
                  <p className="text-muted-foreground text-[11px]">
                    Joined {formatRelative(w.createdAt)}
                  </p>
                </div>
                {w.phone && (
                  <PingButton
                    busy={busy === `ping-${w.phone}`}
                    onClick={() => handleTestPing("whatsapp", w.phone!)}
                  />
                )}
                {isOwner && (
                  <RemoveButton
                    busy={busy === `remove-${w.userId}`}
                    label="Remove waiter"
                    onClick={() =>
                      handleRemove(
                        `${w.userId}:${venueId}`,
                        "waiter",
                        "Remove this waiter?",
                      )
                    }
                  />
                )}
              </li>
            ))}
          </ul>
        )}

      </Section>

      {/* ── PRs ──────────────────────────────────────────────────── */}
      <Section
        title="PRs"
        description="Connect WhatsApp, SMS, or Instagram PR channels that handle reservations."
        right={
          isOwner && (
            <InviteButton
              label="Add WhatsApp"
              open={inviteOpen === "pr"}
              onClick={() => setInviteOpen(inviteOpen === "pr" ? null : "pr")}
            />
          )
        }
      >
        {inviteOpen === "pr" && (
          <PrChannelForm
            busy={busy === "invite-pr"}
            onSubmit={handleInvitePr}
            onPing={handleTestPing}
          />
        )}

        {snapshot.waiters.length === 0 &&
        mockPrInstagrams.length === 0 &&
        inviteOpen !== "pr" ? (
          <EmptyState
            icon={<MessageCircle className="text-muted-foreground h-5 w-5" />}
            title="No PRs yet"
            description="Connect PR WhatsApp numbers so they can handle reservations from their phone."
            className="border-border/60 bg-muted/20 rounded-xl border p-7"
          />
        ) : snapshot.waiters.length === 0 ? (
          <p className="text-muted-foreground text-sm">No PRs yet.</p>
        ) : (
          <>
            {snapshot.waiters.length > 0 && (
              <ul className="divide-border/60 divide-y">
                {snapshot.waiters.map((w) => (
                  <li
                    key={`${w.userId}:${venueId}:pr`}
                    className="hover:bg-muted/25 flex items-center gap-3 rounded-xl px-2 py-2.5 transition"
                  >
                    <Avatar
                      initial={(w.phone ?? "?").slice(-2)}
                      tint="bg-whatsapp/15 text-whatsapp-deep"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-[13px] font-semibold">
                        {w.phone ?? "—"}
                      </p>
                      <p className="text-muted-foreground text-[11px]">
                        Joined {formatRelative(w.createdAt)}
                      </p>
                    </div>
                    {w.phone && (
                      <PingButton
                        busy={busy === `ping-${w.phone}`}
                        onClick={() => handleTestPing("whatsapp", w.phone!)}
                      />
                    )}
                    {isOwner && w.phone && (
                      <RemoveButton
                        busy={busy === `remove-${w.userId}`}
                        label={`Remove ${w.phone}`}
                        onClick={() =>
                          handleRemove(
                            `${w.userId}:${venueId}`,
                            "waiter",
                            "Remove this PR WhatsApp?",
                          )
                        }
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}

            {mockPrInstagrams.length > 0 && (
              <ul className="divide-border/60 divide-y">
                {mockPrInstagrams.map((handle) => (
                  <li
                    key={`pr-ig-${handle}`}
                    className="hover:bg-muted/25 flex items-center gap-3 rounded-xl px-2 py-2.5 transition"
                  >
                    <Avatar initial={handle.slice(1, 2)} tint="bg-pink-gradient" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold">{handle}</p>
                      <p className="text-muted-foreground text-[11px]">
                        Instagram PR (mock for now)
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-pink-500/10 px-2 py-0.5 text-[10px] font-semibold text-pink-700">
                      <Instagram className="h-3 w-3" />
                      Instagram
                    </span>
                    <RemoveButton
                      busy={false}
                      hidden={!isOwner}
                      label={`Remove ${handle}`}
                      onClick={() =>
                        setMockPrInstagrams((prev) => prev.filter((x) => x !== handle))
                      }
                    />
                  </li>
                ))}
              </ul>
            )}

          </>
        )}
      </Section>

      <p className={cn(INFO_BOX_CLASS, "text-center")}>
        WhatsApp / SMS delivery is mocked until Twilio is wired up — invites
        still create real tokens you can share manually.
      </p>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────

// Styled replacement for window.confirm — backdrop + card, Escape and
// backdrop-click both cancel. Destructive actions get a red confirm button.
function ConfirmDialog({
  title,
  body,
  confirmLabel,
  tone,
  onConfirm,
  onCancel,
}: ConfirmState & { onCancel: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
    >
      <div
        className="border-border bg-card w-full max-w-sm rounded-2xl border p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-lg font-semibold tracking-tight">
          {title}
        </h2>
        <p className="text-muted-foreground mt-1.5 text-sm">{body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="border-border bg-background text-foreground hover:bg-muted inline-flex h-10 items-center rounded-full border px-4 text-[13px] font-semibold transition"
          >
            Cancel
          </button>
          <button
            type="button"
            autoFocus
            onClick={onConfirm}
            className={cn(
              "inline-flex h-10 items-center rounded-full px-5 text-[13px] font-semibold text-white shadow-sm transition hover:opacity-90",
              tone === "destructive" ? "bg-destructive" : "bg-pink-gradient",
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function InviteButton({
  open,
  onClick,
  label,
}: {
  open: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        PILL_BUTTON_CLASS,
        "shadow-sm",
        open
          ? "bg-muted text-foreground hover:bg-muted/80"
          : "bg-pink-gradient text-white hover:opacity-90",
      )}
    >
      {open ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
      {open ? "Cancel" : label}
    </button>
  );
}

// Pending-invites group — eyebrow label + stack of subdued tile rows.
// Used identically by both Editors and Waiters sections.
function PendingGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-border/60 mt-1 flex flex-col gap-2 border-t pt-3">
      <p className={TINY_LABEL_CLASS}>Pending invites</p>
      <ul className="flex flex-col gap-2">{children}</ul>
    </div>
  );
}

function PendingRow({
  icon,
  title,
  subtitle,
  titleClassName,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  titleClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <li className="bg-muted/25 border-border/50 flex items-center gap-3 rounded-xl border px-3 py-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-[12px] font-semibold", titleClassName)}>
          {title}
        </p>
        <p className="text-muted-foreground text-[11px]">{subtitle}</p>
      </div>
      {children}
    </li>
  );
}

function EditorInviteForm({
  busy,
  onSubmit,
  roleChoices = ROLE_CHOICES,
  defaultRole = "editor",
  submitLabel = "Send invite",
}: {
  busy: boolean;
  onSubmit: (email: string, role: BusinessRole) => void | Promise<void>;
  roleChoices?: BusinessRole[];
  defaultRole?: BusinessRole;
  submitLabel?: string;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<BusinessRole>(defaultRole);

  return (
    <form
      className="bg-muted/30 border-border/50 flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center"
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = email.trim();
        if (!trimmed) return;
        onSubmit(trimmed, role);
      }}
    >
      <div className="relative flex-1">
        <Mail className="text-muted-foreground absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
        <input
          type="email"
          required
          autoFocus
          placeholder="name@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border-border bg-background focus:border-foreground/40 w-full rounded-full border py-2 pr-3 pl-8 text-[13px] outline-none"
        />
      </div>
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as BusinessRole)}
        className="border-border bg-background w-full rounded-full border px-3 py-2 text-[13px] outline-none sm:w-auto"
      >
        {roleChoices.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABEL[r]}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={busy || email.trim().length === 0}
        className={cn(PILL_BUTTON_CLASS, "px-4 py-2 disabled:opacity-50")}
      >
        {busy ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Send className="h-3 w-3" />
        )}
        {submitLabel}
      </button>
    </form>
  );
}

function PrChannelForm({
  busy,
  onSubmit,
  onPing,
}: {
  busy: boolean;
  onSubmit: (
    channel: "whatsapp" | "sms" | "instagram",
    value: string,
  ) => void | Promise<void>;
  onPing: (channel: "whatsapp" | "sms", phone: string) => void | Promise<void>;
}) {
  const [channel, setChannel] = useState<"whatsapp" | "sms" | "instagram">(
    "whatsapp",
  );
  const [value, setValue] = useState("");
  return (
    <form
      className="bg-muted/30 border-border/50 flex flex-col gap-3 rounded-xl border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = value.trim();
        if (!trimmed) return;
        onSubmit(channel, trimmed);
      }}
    >
      <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center">
        <div className="border-border bg-background flex items-center overflow-hidden rounded-full border p-0.5 text-[12px] font-semibold">
          {(["whatsapp", "sms", "instagram"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setChannel(c)}
              className={cn(
                "inline-flex min-w-[98px] items-center justify-center gap-1.5 rounded-full px-3 py-1.5 transition",
                channel === c
                  ? c === "whatsapp"
                    ? "bg-whatsapp text-white shadow-sm"
                    : c === "sms"
                      ? "bg-sky-600 text-white shadow-sm"
                      : "bg-pink-600 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {c === "whatsapp" ? (
                <MessageCircle className="h-3.5 w-3.5" />
              ) : c === "sms" ? (
                <PhoneIcon className="h-3.5 w-3.5" />
              ) : (
                <Instagram className="h-3.5 w-3.5" />
              )}
              {c === "whatsapp"
                ? "WhatsApp"
                : c === "sms"
                  ? "SMS"
                  : "Instagram"}
            </button>
          ))}
        </div>
        {channel === "instagram" ? (
          <div className="border-border bg-background flex w-full min-w-0 items-center gap-2 rounded-full border px-3 py-2 lg:flex-1">
            <Instagram className="text-muted-foreground h-4 w-4" />
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="@yourprhandle"
              className="w-full bg-transparent text-[13px] outline-none"
              spellCheck={false}
              autoCapitalize="none"
            />
          </div>
        ) : (
          <PhonePicker
            value={value}
            onChange={setValue}
            placeholder="33 1234 5678"
            className="w-full min-w-0 lg:flex-1"
          />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={busy || value.trim().length === 0}
          className={cn(PILL_BUTTON_CLASS, "shrink-0 px-4 py-2 disabled:opacity-50")}
        >
          {busy ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Send className="h-3 w-3" />
          )}
          Connect{" "}
          {channel === "whatsapp"
            ? "WhatsApp"
            : channel === "sms"
              ? "SMS"
              : "Instagram"}
        </button>
        {channel !== "instagram" && (
          <button
            type="button"
            disabled={busy || value.trim().length === 0}
            onClick={() => onPing(channel, value.trim())}
            className={cn(
              "border-border bg-background text-foreground inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-[13px] font-semibold transition hover:bg-muted disabled:opacity-50",
            )}
          >
            <Send className="h-3.5 w-3.5" />
            Ping
          </button>
        )}
      </div>
    </form>
  );
}

function WaiterInviteForm({
  busy,
  onSubmit,
  onPing,
}: {
  busy: boolean;
  onSubmit: (
    channel: "whatsapp" | "sms",
    phone: string,
  ) => void | Promise<void>;
  onPing: (channel: "whatsapp" | "sms", phone: string) => void | Promise<void>;
}) {
  const [channel, setChannel] = useState<"whatsapp" | "sms">("whatsapp");
  const [phone, setPhone] = useState("");

  return (
    <form
      className="bg-muted/30 border-border/50 flex flex-col gap-3 rounded-xl border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(channel, phone.trim());
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
            channel === "whatsapp"
              ? "bg-whatsapp/15 text-whatsapp-deep"
              : "bg-sky-500/15 text-sky-700",
          )}
        >
          {channel === "whatsapp" ? (
            <MessageCircle className="h-3.5 w-3.5" />
          ) : (
            <PhoneIcon className="h-3.5 w-3.5" />
          )}
          Sending via {channel === "whatsapp" ? "WhatsApp" : "SMS"}
        </span>
      </div>

      <div className="flex w-full flex-col gap-3">
        <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center">
          <div className="border-border bg-background flex items-center overflow-hidden rounded-full border p-0.5 text-[12px] font-semibold">
            {(["whatsapp", "sms"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setChannel(c)}
                className={cn(
                  "inline-flex min-w-[108px] items-center justify-center gap-1.5 rounded-full px-3 py-1.5 transition",
                  channel === c
                    ? c === "whatsapp"
                      ? "bg-whatsapp text-white shadow-sm"
                      : "bg-sky-600 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {c === "whatsapp" ? (
                  <MessageCircle className="h-3.5 w-3.5" />
                ) : (
                  <PhoneIcon className="h-3.5 w-3.5" />
                )}
                {c === "whatsapp" ? "WhatsApp" : "SMS"}
              </button>
            ))}
          </div>
          <PhonePicker
            value={phone}
            onChange={setPhone}
            placeholder="33 1234 5678 (optional)"
            className="w-full min-w-0 lg:flex-1"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={busy}
            className={cn(PILL_BUTTON_CLASS, "shrink-0 px-4 py-2 disabled:opacity-50")}
          >
            {busy ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Send className="h-3 w-3" />
            )}
            Add
          </button>
          <button
            type="button"
            disabled={busy || phone.trim().length === 0}
            onClick={() => onPing(channel, phone.trim())}
            className="border-border bg-background text-foreground inline-flex h-10 items-center gap-2 rounded-full border px-4 text-[13px] font-semibold transition hover:bg-muted disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            Ping
          </button>
        </div>
      </div>
      <p className="text-muted-foreground text-[11px]">
        {channel === "whatsapp"
          ? "Invite is sent by WhatsApp. Phone is optional: with phone, only that number can claim; without it, anyone with the link can join."
          : "Invite is sent by SMS. Phone is optional: with phone, only that number can claim; without it, anyone with the link can join."}
      </p>
    </form>
  );
}

function RoleSelect({
  role,
  choices,
  disabled,
  onChange,
}: {
  role: BusinessRole;
  choices: BusinessRole[];
  disabled: boolean;
  onChange: (r: BusinessRole) => void;
}) {
  return (
    <select
      value={role}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as BusinessRole)}
      className="border-border bg-background text-foreground hidden rounded-full border px-2.5 py-1 text-[11px] font-medium disabled:cursor-not-allowed disabled:opacity-60 sm:block"
    >
      {choices.map((r) => (
        <option key={r} value={r}>
          {ROLE_LABEL[r]}
        </option>
      ))}
    </select>
  );
}

function RemoveButton({
  busy,
  hidden,
  label,
  onClick,
}: {
  busy: boolean;
  hidden?: boolean;
  label: string;
  onClick: () => void;
}) {
  if (hidden) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label={label}
      title={label}
      className={cn(
        ICON_BUTTON_CLASS,
        "hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive border-transparent bg-transparent",
      )}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Trash2 className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

function PingButton({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label="Send test ping"
      title="Send test ping"
      className={ICON_BUTTON_CLASS}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Send className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          /* swallow */
        }
      }}
      className={ICON_BUTTON_CLASS}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

function Avatar({ initial, tint }: { initial: string; tint: string }) {
  return (
    <span
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[11px] font-bold uppercase shadow-sm",
        tint,
        tint.includes("gradient") && "text-white",
      )}
    >
      {initial.trim() || "·"}
    </span>
  );
}

function TeamStatPill({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="border-border bg-card rounded-xl border px-3 py-2.5">
      <p className={TINY_LABEL_CLASS}>{label}</p>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <p className="font-display text-xl font-semibold tracking-tight">{value}</p>
        <p className="text-muted-foreground text-[11px]">{hint}</p>
      </div>
    </div>
  );
}

function ChannelIcon({ channel }: { channel: "whatsapp" | "sms" }) {
  if (channel === "whatsapp") {
    return (
      <span className="bg-whatsapp/15 text-whatsapp-deep flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
        <MessageCircle className="h-4 w-4" />
      </span>
    );
  }
  return (
    <span className="bg-muted text-muted-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
      <UserPlus className="h-4 w-4" />
    </span>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────

function initialOf(name: string | null, email: string | null): string {
  const src = (name ?? email ?? "?").trim();
  return src.slice(0, 1).toUpperCase();
}

function buildAcceptUrl(token: string, kind?: "waiter"): string {
  if (typeof window === "undefined") return "";
  const url = new URL("/accept-invite", window.location.origin);
  url.searchParams.set("token", token);
  if (kind) url.searchParams.set("kind", kind);
  return url.toString();
}

function formatRelative(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(ms);
  const day = 24 * 60 * 60 * 1000;
  if (abs < day) {
    const hr = Math.round(abs / (60 * 60 * 1000));
    return ms >= 0 ? `in ${hr}h` : `${hr}h ago`;
  }
  const d = Math.round(abs / day);
  return ms >= 0 ? `in ${d}d` : `${d}d ago`;
}

function teamRoleLabel(role: BusinessRole): string {
  if (role === "viewer") return "PR";
  if (role === "editor") return "Manager";
  return ROLE_LABEL[role];
}
