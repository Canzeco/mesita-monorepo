"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Copy,
  Crown,
  Instagram,
  Loader2,
  Mail,
  Megaphone,
  MessageCircle,
  Phone as PhoneIcon,
  Send,
  Trash2,
} from "lucide-react";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { cn, errMsg } from "@/lib/utils";
import {
  ERROR_BOX_CLASS,
  ICON_BUTTON_CLASS,
  INFO_BOX_CLASS,
  PILL_BUTTON_CLASS,
} from "@/lib/ui-classes";
import { PhonePicker } from "@/components/ui/phone-picker";
import { apiUpdateVenue } from "@/lib/api/venues";
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

function waiterInvitePhoneKey(phone: string | null | undefined): string {
  if (!phone) return "";
  return phone.replace(/\D/g, "");
}

type InviteOpen = null | "manager" | "waiter";

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
  initialWhatsappPrUrl,
  initialInstagramPrUrl,
}: {
  venueId: string;
  currentUserId: string;
  initialSnapshot: TeamSnapshot;
  initialWhatsappPrUrl: string;
  initialInstagramPrUrl: string;
}) {
  const supabase = useBrowserSupabase();
  // Seeded from the server fetch in page.tsx — no client-side initial
  // load, no second loading indicator. refresh() still runs after every
  // mutating handler to keep the list in sync.
  const [snapshot, setSnapshot] = useState<TeamSnapshot>(initialSnapshot);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState<InviteOpen>(null);
  const [prWhatsapp, setPrWhatsapp] = useState(initialWhatsappPrUrl);
  const [prInstagram, setPrInstagram] = useState(initialInstagramPrUrl);
  const [savedPrChannels, setSavedPrChannels] = useState({
    whatsapp: initialWhatsappPrUrl,
    instagram: initialInstagramPrUrl,
  });
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
  const pendingWaiterInvites = snapshot.pendingWaiterInvites ?? [];
  const activeWaiterCount = snapshot.waiters.length;
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

  const persistPrChannels = () => {
    const whatsapp = prWhatsapp.trim();
    const instagram = prInstagram.trim();
    if (
      whatsapp === savedPrChannels.whatsapp.trim() &&
      instagram === savedPrChannels.instagram.trim()
    ) {
      return;
    }
    return runAction(
      "save-pr-channels",
      async () => {
        await apiUpdateVenue(supabase, {
          id: venueId,
          whatsapp_pr_urls: whatsapp ? [whatsapp] : [],
          instagram_pr_urls: instagram ? [instagram] : [],
        });
        setSavedPrChannels({ whatsapp: prWhatsapp, instagram: prInstagram });
        setNotice("PR channels saved.");
      },
      "Couldn't save PR channels.",
    );
  };

  const applyWaiterInviteResult = (
    res: Awaited<ReturnType<typeof apiInviteWaiter>>,
    channel: "whatsapp" | "sms",
  ) => {
    const phoneKey = waiterInvitePhoneKey(res.phone);
    setSnapshot((prev) => ({
      ...prev,
      pendingWaiterInvites: [
        {
          id: res.inviteId,
          phone: res.phone,
          channel: res.channel,
          token: res.token,
          createdAt: new Date().toISOString(),
          expiresAt: res.expiresAt,
        },
        ...(prev.pendingWaiterInvites ?? []).filter(
          (p) =>
            p.id !== res.inviteId && waiterInvitePhoneKey(p.phone) !== phoneKey,
        ),
      ],
    }));
    if (res.sent) {
      setNotice(
        res.resent
          ? `Invitación reenviada por WhatsApp a ${res.phone}.`
          : `Invitación enviada por WhatsApp a ${res.phone}. Queda pendiente hasta que respondan sí.`,
      );
    } else {
      setNotice(
        res.sendError
          ? res.resent
            ? `No se pudo reenviar por WhatsApp: ${res.sendError}`
            : `Invitación pendiente — no se envió por WhatsApp: ${res.sendError}`
          : channel === "whatsapp"
            ? "Invitación pendiente — agrega el teléfono y usa Reenviar en la fila."
            : "Invitación pendiente — usa WhatsApp; el mesero acepta respondiendo sí en Mesita Ops.",
      );
    }
  };

  const handleInviteWaiter = (channel: "whatsapp" | "sms", phone: string) =>
    runAction(
      "invite-waiter",
      async () => {
        const res = await apiInviteWaiter(supabase, {
          venueId,
          channel,
          phone: phone || undefined,
        });
        applyWaiterInviteResult(res, channel);
        setInviteOpen(null);
      },
      "Couldn't create that waiter invite.",
    );

  const handleResendWaiterInvite = (
    channel: "whatsapp" | "sms",
    phone: string,
  ) =>
    runAction(
      `resend-waiter-${phone}`,
      async () => {
        const res = await apiInviteWaiter(supabase, {
          venueId,
          channel,
          phone,
        });
        applyWaiterInviteResult(res, channel);
      },
      "Couldn't resend that waiter invite.",
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
    <div className="flex flex-col gap-3">
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

      <TeamModule
        icon={<Crown className="h-4 w-4" />}
        title="Managers"
        active={managers.length}
        pending={pendingManagerInvites.length}
        action={
          isOwner ? (
            <InviteButton
              label="Invite"
              open={inviteOpen === "manager"}
              onClick={() =>
                setInviteOpen(inviteOpen === "manager" ? null : "manager")
              }
            />
          ) : null
        }
      >
        {inviteOpen === "manager" && (
          <EditorInviteForm
            busy={busy === "invite-manager"}
            onSubmit={handleInviteManager}
            roleChoices={MANAGER_ROLE_CHOICES}
            defaultRole="editor"
            submitLabel="Send invite"
          />
        )}

        {managers.length === 0 && pendingManagerInvites.length === 0 ? (
          <TeamEmpty message="No managers yet" />
        ) : (
          <TeamList>
            {managers.map((m) => (
              <TeamMemberRow key={m.memberId}>
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
              </TeamMemberRow>
            ))}
            {pendingManagerInvites.map((inv) => (
              <PendingRow
                key={inv.id}
                icon={<Mail className="text-muted-foreground h-3.5 w-3.5" />}
                title={inv.email}
                subtitle={`${teamRoleLabel((inv.role as BusinessRole) ?? "editor")} · ${formatRelative(inv.expiresAt)}`}
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
          </TeamList>
        )}
      </TeamModule>

      <TeamModule
        icon={<PhoneIcon className="h-4 w-4" />}
        title="Waiters"
        active={activeWaiterCount}
        pending={pendingWaiterInvites.length}
        action={
          <InviteButton
            label="Add"
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

        {activeWaiterCount === 0 && pendingWaiterInvites.length === 0 ? (
          <TeamEmpty message="No waiters yet" />
        ) : (
          <TeamList>
            {snapshot.waiters.map((w) => (
              <TeamMemberRow key={`${w.userId}:${venueId}`}>
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
              </TeamMemberRow>
            ))}
            {pendingWaiterInvites.map((inv) => (
              <PendingRow
                key={inv.id}
                icon={
                  inv.channel === "whatsapp" ? (
                    <MessageCircle className="text-whatsapp-deep h-3.5 w-3.5" />
                  ) : (
                    <PhoneIcon className="text-muted-foreground h-3.5 w-3.5" />
                  )
                }
                title={inv.phone ?? "—"}
                subtitle={`Pending · ${formatRelative(inv.expiresAt)}`}
              >
                {inv.phone && (
                  <PingButton
                    busy={busy === `resend-waiter-${inv.phone}`}
                    onClick={() =>
                      handleResendWaiterInvite(inv.channel, inv.phone!)
                    }
                    label="Resend invite"
                  />
                )}
                {isOwner && (
                  <RemoveButton
                    busy={busy === `remove-${inv.id}`}
                    label="Revoke invite"
                    onClick={() =>
                      handleRemove(
                        inv.id,
                        "waiterInvite",
                        "Revoke this waiter invite?",
                      )
                    }
                  />
                )}
              </PendingRow>
            ))}
          </TeamList>
        )}
      </TeamModule>

      <TeamModule
        icon={<Megaphone className="h-4 w-4" />}
        title="PR channels"
        active={0}
        meta={`${(prWhatsapp.trim() ? 1 : 0) + (prInstagram.trim() ? 1 : 0)} connected`}
      >
        <TeamList>
          <PrChannelEditRow
            label="WhatsApp"
            icon={<MessageCircle className="h-3.5 w-3.5" />}
            iconTone="bg-whatsapp/15 text-whatsapp-deep"
            placeholder="https://wa.me/52…"
            value={prWhatsapp}
            disabled={busy === "save-pr-channels"}
            onChange={setPrWhatsapp}
            onCommit={persistPrChannels}
          />
          <PrChannelEditRow
            label="Instagram"
            icon={<Instagram className="h-3.5 w-3.5" />}
            iconTone="bg-pink-500/12 text-pink-600"
            placeholder="https://instagram.com/…"
            value={prInstagram}
            disabled={busy === "save-pr-channels"}
            onChange={setPrInstagram}
            onCommit={persistPrChannels}
          />
        </TeamList>
      </TeamModule>
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

function TeamModule({
  icon,
  title,
  active,
  pending = 0,
  meta,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  active: number;
  pending?: number;
  meta?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const subtitle =
    meta ??
    `${active} active${pending > 0 ? ` · ${pending} pending` : ""}`;

  return (
    <section className="border-border bg-card overflow-hidden rounded-2xl border shadow-[0_8px_28px_-24px_rgba(0,0,0,0.35)]">
      <div className="border-border/60 flex items-center gap-3 border-b px-4 py-3">
        <span className="bg-muted text-foreground/75 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          <p className="text-muted-foreground text-[11px]">{subtitle}</p>
        </div>
        {action}
      </div>
      <div className="flex flex-col gap-2.5 p-3">{children}</div>
    </section>
  );
}

function TeamList({ children }: { children: React.ReactNode }) {
  return (
    <ul className="border-border/70 bg-background divide-border/60 divide-y overflow-hidden rounded-xl border">
      {children}
    </ul>
  );
}

function TeamMemberRow({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2.5 px-3 py-2.5">{children}</li>
  );
}

function TeamEmpty({ message }: { message: string }) {
  return (
    <div className="border-border/60 bg-muted/15 text-muted-foreground flex min-h-[4.5rem] items-center justify-center rounded-xl border border-dashed px-4 text-center text-[12px]">
      {message}
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
        "shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold transition",
        open
          ? "border-border bg-muted text-foreground border"
          : "bg-pink-gradient text-white hover:opacity-90",
      )}
    >
      {open ? "Cancel" : label}
    </button>
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
    <li className="bg-muted/25 flex items-center gap-2.5 px-3 py-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-[12px] font-semibold", titleClassName)}>
          {title}
        </p>
        <p className="text-muted-foreground truncate text-[10px]">{subtitle}</p>
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

function PrChannelEditRow({
  label,
  icon,
  iconTone,
  placeholder,
  value,
  disabled,
  onChange,
  onCommit,
}: {
  label: string;
  icon: React.ReactNode;
  iconTone: string;
  placeholder: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onCommit: () => void;
}) {
  return (
    <TeamMemberRow>
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          iconTone,
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold">{label}</p>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onCommit}
          placeholder={placeholder}
          disabled={disabled}
          spellCheck={false}
          autoCapitalize="none"
          className="placeholder:text-muted-foreground/50 text-muted-foreground focus:text-foreground w-full truncate bg-transparent py-0.5 text-[11px] outline-none disabled:opacity-60"
        />
      </div>
    </TeamMemberRow>
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
            placeholder="33 1234 5678"
            className="w-full min-w-0 lg:flex-1"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={
              busy || (channel === "whatsapp" && phone.trim().length === 0)
            }
            className={cn(
              PILL_BUTTON_CLASS,
              "shrink-0 px-4 py-2 disabled:opacity-50",
            )}
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
            className="border-border bg-background text-foreground hover:bg-muted inline-flex h-10 items-center gap-2 rounded-full border px-4 text-[13px] font-semibold transition disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            Ping
          </button>
        </div>
      </div>
      <p className="text-muted-foreground text-[11px]">
        {channel === "whatsapp"
          ? "Les llega un WhatsApp en lenguaje natural; para unirse responden sí en Mesita Ops."
          : "Usa WhatsApp. El mesero acepta respondiendo sí en el chat de Ops."}
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

function PingButton({
  busy,
  onClick,
  label = "Send test ping",
}: {
  busy: boolean;
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label={label}
      title={label}
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
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold uppercase",
        tint,
        tint.includes("gradient") && "text-white",
      )}
    >
      {initial.trim() || "·"}
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
