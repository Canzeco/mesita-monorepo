"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  Crown,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  Send,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { cn, errMsg } from "@/lib/utils";
import { ERROR_BOX_CLASS, INFO_BOX_CLASS } from "@/lib/ui-classes";
import {
  apiInviteManager,
  apiInviteWaiter,
  apiListTeam,
  apiRemoveMember,
  apiTestWaiterChannel,
  apiUpdateMemberRole,
  type ManagerRole,
  type RemoveKind,
  type TeamSnapshot,
} from "@/lib/api/team";

// "manager" is the legacy DB enum value — surfaced as "Editor" in the
// UI because that's how the user labels read/write members on the Team
// page.
const ROLE_LABEL: Record<ManagerRole, string> = {
  owner: "Owner",
  manager: "Editor",
  viewer: "Viewer",
};

const ROLE_CHOICES: ManagerRole[] = ["owner", "manager", "viewer"];

type InviteOpen = null | "manager" | "waiter";

export function TeamClient({
  venueId,
  currentUserId,
}: {
  venueId: string;
  currentUserId: string;
}) {
  const supabase = useBrowserSupabase();
  const [snapshot, setSnapshot] = useState<TeamSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState<InviteOpen>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await apiListTeam(supabase, venueId);
      setSnapshot(next);
      setError(null);
    } catch (err) {
      setError(errMsg(err, "Couldn't load the team."));
    }
  }, [supabase, venueId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const next = await apiListTeam(supabase, venueId);
        if (!cancelled) setSnapshot(next);
      } catch (err) {
        if (!cancelled) setError(errMsg(err, "Couldn't load the team."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, venueId]);

  const myRole = useMemo<ManagerRole | null>(() => {
    const me = snapshot?.managers.find((m) => m.userId === currentUserId);
    if (!me) return null;
    return (ROLE_CHOICES as string[]).includes(me.role)
      ? (me.role as ManagerRole)
      : null;
  }, [snapshot, currentUserId]);
  const isOwner = myRole === "owner";

  const handleInviteManager = async (email: string, role: ManagerRole) => {
    setBusy("invite-manager");
    setError(null);
    try {
      await apiInviteManager(supabase, {
        venueId,
        email,
        role,
        redirectBase: window.location.origin,
      });
      await refresh();
      setInviteOpen(null);
    } catch (err) {
      setError(errMsg(err, "Couldn't send that invite."));
    } finally {
      setBusy(null);
    }
  };

  const handleInviteWaiter = async (
    channel: "whatsapp" | "sms",
    phone: string,
  ) => {
    setBusy("invite-waiter");
    setError(null);
    try {
      await apiInviteWaiter(supabase, {
        venueId,
        channel,
        phone: phone || undefined,
        redirectBase: window.location.origin,
      });
      await refresh();
      setInviteOpen(null);
    } catch (err) {
      setError(errMsg(err, "Couldn't create that waiter invite."));
    } finally {
      setBusy(null);
    }
  };

  const handleChangeRole = async (memberId: string, role: ManagerRole) => {
    setBusy(`role-${memberId}`);
    setError(null);
    try {
      await apiUpdateMemberRole(supabase, { memberId, role });
      await refresh();
    } catch (err) {
      setError(errMsg(err, "Couldn't change that role."));
    } finally {
      setBusy(null);
    }
  };

  const handleRemove = async (id: string, kind: RemoveKind, confirm: string) => {
    if (!window.confirm(confirm)) return;
    setBusy(`remove-${id}`);
    setError(null);
    try {
      await apiRemoveMember(supabase, { id, kind });
      await refresh();
    } catch (err) {
      setError(errMsg(err, "Couldn't remove that entry."));
    } finally {
      setBusy(null);
    }
  };

  const handleTestPing = async (
    channel: "whatsapp" | "sms",
    phone: string,
  ) => {
    setBusy(`ping-${phone}`);
    setError(null);
    try {
      const res = await apiTestWaiterChannel(supabase, { venueId, channel, phone });
      window.alert(
        res.mock
          ? `Test ping queued — ${res.note}`
          : `Test ${res.channel} sent to ${res.to}.`,
      );
    } catch (err) {
      setError(errMsg(err, "Couldn't send a test ping."));
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-12 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading team…
      </div>
    );
  }

  if (!snapshot) {
    return error ? <div className={ERROR_BOX_CLASS}>{error}</div> : null;
  }

  return (
    <div className="flex flex-col gap-6">
      {error && <div className={ERROR_BOX_CLASS}>{error}</div>}

      {/* ── Managers ─────────────────────────────────────────────── */}
      <section className="border-border bg-card rounded-2xl border">
        <header className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
          <div>
            <p className="font-display text-base font-semibold">Managers</p>
            <p className="text-muted-foreground mt-0.5 text-[12px]">
              Sign in with email. Owners can invite or remove anyone.
            </p>
          </div>
          {isOwner && (
            <InviteButton
              label="Invite manager"
              open={inviteOpen === "manager"}
              onClick={() =>
                setInviteOpen(inviteOpen === "manager" ? null : "manager")
              }
            />
          )}
        </header>

        {inviteOpen === "manager" && (
          <ManagerInviteForm
            busy={busy === "invite-manager"}
            onCancel={() => setInviteOpen(null)}
            onSubmit={handleInviteManager}
          />
        )}

        <ul className="divide-y divide-border/60">
          {snapshot.managers.length === 0 ? (
            <li className="text-muted-foreground px-5 py-6 text-sm">
              No managers yet.
            </li>
          ) : (
            snapshot.managers.map((m) => (
              <li key={m.memberId} className="flex items-center gap-3 px-5 py-3">
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
                  role={(m.role as ManagerRole) ?? "manager"}
                  disabled={
                    !isOwner ||
                    busy === `role-${m.memberId}` ||
                    m.userId === currentUserId
                  }
                  onChange={(r) => handleChangeRole(m.memberId, r)}
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
                    handleRemove(
                      m.memberId,
                      "manager",
                      m.userId === currentUserId
                        ? "Leave this venue?"
                        : `Remove ${m.fullName ?? m.email} from this venue?`,
                    )
                  }
                />
              </li>
            ))
          )}
        </ul>

        {snapshot.pendingManagerInvites.length > 0 && (
          <div className="border-t border-border/60 px-5 py-3">
            <p className="text-muted-foreground mb-2 text-[10px] font-medium tracking-[0.18em] uppercase">
              Pending invites
            </p>
            <ul className="flex flex-col gap-2">
              {snapshot.pendingManagerInvites.map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-center gap-3 rounded-xl bg-muted/40 px-3 py-2"
                >
                  <Mail className="text-muted-foreground h-4 w-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold">
                      {inv.email}
                    </p>
                    <p className="text-muted-foreground text-[11px]">
                      Invited as {ROLE_LABEL[(inv.role as ManagerRole) ?? "manager"]} ·
                      {" "}expires {formatRelative(inv.expiresAt)}
                    </p>
                  </div>
                  <CopyButton
                    text={buildAcceptUrl(inv.token)}
                    label="Copy invite link"
                  />
                  {isOwner && (
                    <RemoveButton
                      busy={busy === `remove-${inv.id}`}
                      label="Revoke invite"
                      onClick={() =>
                        handleRemove(inv.id, "mgrInvite", "Revoke this invite?")
                      }
                    />
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ── Waiters ──────────────────────────────────────────────── */}
      <section className="border-border bg-card rounded-2xl border">
        <header className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
          <div>
            <p className="font-display text-base font-semibold">Waiters</p>
            <p className="text-muted-foreground mt-0.5 text-[12px]">
              Validate guest tickets from their own phone via WhatsApp or SMS.
            </p>
          </div>
          <InviteButton
            label="Invite waiter"
            open={inviteOpen === "waiter"}
            onClick={() =>
              setInviteOpen(inviteOpen === "waiter" ? null : "waiter")
            }
          />
        </header>

        {inviteOpen === "waiter" && (
          <WaiterInviteForm
            busy={busy === "invite-waiter"}
            onCancel={() => setInviteOpen(null)}
            onSubmit={handleInviteWaiter}
          />
        )}

        <ul className="divide-y divide-border/60">
          {snapshot.waiters.length === 0 ? (
            <li className="text-muted-foreground px-5 py-6 text-sm">
              No waiters yet.
            </li>
          ) : (
            snapshot.waiters.map((w) => (
              <li
                key={`${w.userId}:${venueId}`}
                className="flex items-center gap-3 px-5 py-3"
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
            ))
          )}
        </ul>

        {snapshot.pendingWaiterInvites.length > 0 && (
          <div className="border-t border-border/60 px-5 py-3">
            <p className="text-muted-foreground mb-2 text-[10px] font-medium tracking-[0.18em] uppercase">
              Pending invites
            </p>
            <ul className="flex flex-col gap-2">
              {snapshot.pendingWaiterInvites.map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-center gap-3 rounded-xl bg-muted/40 px-3 py-2"
                >
                  <ChannelIcon channel={inv.channel} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[12px] font-semibold">
                      {inv.phone ?? "Link only (no phone)"}
                    </p>
                    <p className="text-muted-foreground text-[11px]">
                      via {inv.channel === "whatsapp" ? "WhatsApp" : "SMS"} ·
                      {" "}expires {formatRelative(inv.expiresAt)}
                    </p>
                  </div>
                  <CopyButton
                    text={buildAcceptUrl(inv.token, "waiter")}
                    label="Copy invite link"
                  />
                  {inv.phone && (
                    <PingButton
                      busy={busy === `ping-${inv.phone}`}
                      onClick={() => handleTestPing(inv.channel, inv.phone!)}
                    />
                  )}
                  <RemoveButton
                    busy={busy === `remove-${inv.id}`}
                    label="Revoke invite"
                    onClick={() =>
                      handleRemove(inv.id, "waiterInvite", "Revoke this invite?")
                    }
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <p className={cn(INFO_BOX_CLASS, "text-center")}>
        WhatsApp / SMS delivery is mocked until Twilio is wired up — invites
        still create real tokens you can share manually.
      </p>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────

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
      className="bg-foreground text-background inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition hover:opacity-90"
    >
      {open ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
      {open ? "Cancel" : label}
    </button>
  );
}

function ManagerInviteForm({
  busy,
  onCancel,
  onSubmit,
}: {
  busy: boolean;
  onCancel: () => void;
  onSubmit: (email: string, role: ManagerRole) => void | Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ManagerRole>("manager");

  return (
    <form
      className="border-b border-border/60 bg-muted/30 px-5 py-4"
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = email.trim();
        if (!trimmed) return;
        onSubmit(trimmed, role);
      }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
          onChange={(e) => setRole(e.target.value as ManagerRole)}
          className="border-border bg-background w-full rounded-full border px-3 py-2 text-[13px] outline-none sm:w-auto"
        >
          {ROLE_CHOICES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={busy || email.trim().length === 0}
            className="bg-foreground text-background inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-semibold disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            Send invite
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground text-[12px]"
          >
            Cancel
          </button>
        </div>
      </div>
      <p className="text-muted-foreground mt-2 text-[11px]">
        We&apos;ll email them a link to set their password and join this venue.
      </p>
    </form>
  );
}

function WaiterInviteForm({
  busy,
  onCancel,
  onSubmit,
}: {
  busy: boolean;
  onCancel: () => void;
  onSubmit: (
    channel: "whatsapp" | "sms",
    phone: string,
  ) => void | Promise<void>;
}) {
  const [channel, setChannel] = useState<"whatsapp" | "sms">("whatsapp");
  const [phone, setPhone] = useState("");

  return (
    <form
      className="border-b border-border/60 bg-muted/30 px-5 py-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(channel, phone.trim());
      }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="border-border bg-background flex items-center overflow-hidden rounded-full border p-0.5 text-[12px] font-semibold">
          {(["whatsapp", "sms"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setChannel(c)}
              className={cn(
                "rounded-full px-3 py-1 transition",
                channel === c
                  ? c === "whatsapp"
                    ? "bg-whatsapp/20 text-whatsapp-deep"
                    : "bg-foreground text-background"
                  : "text-muted-foreground",
              )}
            >
              {c === "whatsapp" ? "WhatsApp" : "SMS"}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Phone className="text-muted-foreground absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
          <input
            type="tel"
            inputMode="tel"
            placeholder="+52 33 1234 5678 (optional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="border-border bg-background focus:border-foreground/40 w-full rounded-full border py-2 pr-3 pl-8 font-mono text-[13px] outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={busy}
            className="bg-foreground text-background inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-semibold disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            Create invite
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground text-[12px]"
          >
            Cancel
          </button>
        </div>
      </div>
      <p className="text-muted-foreground mt-2 text-[11px]">
        Phone is optional. With it, the invite is bound so only that number can
        claim. Without it, anyone with the link can join as waiter.
      </p>
    </form>
  );
}

function RoleSelect({
  role,
  disabled,
  onChange,
}: {
  role: ManagerRole;
  disabled: boolean;
  onChange: (r: ManagerRole) => void;
}) {
  return (
    <select
      value={role}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as ManagerRole)}
      className="border-border bg-background text-foreground hidden rounded-full border px-2.5 py-1 text-[11px] font-medium disabled:cursor-not-allowed disabled:opacity-60 sm:block"
    >
      {ROLE_CHOICES.map((r) => (
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
      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex h-8 w-8 items-center justify-center rounded-full transition disabled:opacity-50"
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
      className="border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground flex h-8 w-8 items-center justify-center rounded-full border disabled:opacity-50"
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
      className="border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground flex h-8 w-8 items-center justify-center rounded-full border"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function Avatar({ initial, tint }: { initial: string; tint: string }) {
  return (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold uppercase",
        tint,
        tint.includes("gradient") && "text-white",
      )}
    >
      {initial.trim() || "·"}
    </span>
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
