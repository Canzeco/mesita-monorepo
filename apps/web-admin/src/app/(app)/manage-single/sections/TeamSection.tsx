"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { ChevronDown, Mail, Trash2, UserPlus } from "lucide-react";
import {
  inviteEditor,
  listTeam,
  removeMember,
  updateMemberRole,
  type AdminPlace,
  type TeamSnapshot,
} from "../actions";
import {
  ConfirmDialog,
  SelectField,
  Spinner,
  TextField,
} from "@/components/admin-ui/manage";
import { ErrorNote } from "@/components/ErrorNote";
import { usePlaceUI } from "../PlaceUIContext";
import { formatShortDate } from "@/lib/format";

/** All three place roles — owner is unique & transferable (MESITA-919). */
const MEMBER_ROLES = ["owner", "editor", "viewer"] as const;
type MemberRole = (typeof MEMBER_ROLES)[number];

/** Invites never create an owner — transfer from an existing member. */
const INVITE_ROLES = ["editor", "viewer"] as const;

const ROLE_LABEL: Record<MemberRole, string> = {
  owner: "Owner",
  editor: "Editor",
  viewer: "Viewer",
};

type ConfirmTarget =
  | {
      kind: "remove";
      key: string;
      label: string;
      roleLabel: string;
      run: () => Promise<{ ok: boolean; error?: string }>;
    }
  | {
      kind: "transfer";
      key: string;
      label: string;
      memberId: string;
    }
  | {
      kind: "role";
      key: string;
      label: string;
      memberId: string;
      next: MemberRole;
      from: MemberRole;
    };

export function TeamSection({ place }: { place: AdminPlace }) {
  const [snap, setSnap] = useState<TeamSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, start] = useTransition();
  const [confirm, setConfirm] = useState<ConfirmTarget | null>(null);
  const [inviteFlash, setInviteFlash] = useState(false);

  // Expand state lives above the tab (PlaceUIContext) so it survives
  // Profile → Controls → Profile. Decision 4 of MESITA-1399.
  const { teamExpanded, setTeamExpanded } = usePlaceUI();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("editor");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const r = await listTeam(place.id);
    setLoading(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setSnap(r.data);
  }, [place.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await listTeam(place.id);
      if (cancelled) return;
      setLoading(false);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setSnap(r.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [place.id]);

  const members = useMemo(() => {
    if (!snap) return [];
    return [...snap.members].sort((a, b) => {
      if (a.role === "owner" && b.role !== "owner") return -1;
      if (b.role === "owner" && a.role !== "owner") return 1;
      return (a.fullName ?? a.email ?? "").localeCompare(
        b.fullName ?? b.email ?? "",
      );
    });
  }, [snap]);

  const ownerCount = members.filter((m) => m.role === "owner").length;

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(true);
    setError(null);
    start(async () => {
      const r = await fn();
      setBusy(false);
      if (!r.ok) {
        setError(r.error ?? "Action failed.");
        return;
      }
      await load();
    });
  };

  const invite = () => {
    if (!email.trim()) return;
    if (role === "owner") {
      setError("Cannot invite as owner — transfer ownership from a member.");
      return;
    }
    run(async () => {
      const r = await inviteEditor(place.id, email.trim(), role);
      if (r.ok) {
        setEmail("");
        setInviteFlash(true);
        window.setTimeout(() => setInviteFlash(false), 2000);
      }
      return r;
    });
  };

  const onRolePick = (
    memberId: string,
    name: string,
    from: string,
    next: string,
  ) => {
    if (from === next) return;
    if (!MEMBER_ROLES.includes(next as MemberRole)) return;
    const fromRole = from as MemberRole;
    const nextRole = next as MemberRole;
    if (nextRole === "owner") {
      setConfirm({
        kind: "transfer",
        key: memberId,
        label: name,
        memberId,
      });
      return;
    }
    setConfirm({
      kind: "role",
      key: memberId,
      label: name,
      memberId,
      next: nextRole,
      from: fromRole,
    });
  };

  const pending = snap?.pendingBusinessInvites.length ?? 0;
  const summary = loading
    ? "Checking…"
    : !snap
      ? "Couldn't load"
      : [
          `${members.length} member${members.length === 1 ? "" : "s"}`,
          pending > 0 ? `${pending} pending invite${pending === 1 ? "" : "s"}` : null,
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <div>
      {/* Collapsed by default and expanded in place — no modal, because this
          tab already carries two overlay idioms (ProductModal, ConfirmDialog).
          The whole row is the control, so the hit area clears 44px. */}
      <button
        type="button"
        aria-expanded={teamExpanded}
        aria-controls="team-panel"
        onClick={() => setTeamExpanded(!teamExpanded)}
        className="flex w-full items-center gap-3 py-2.5 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">Team</span>
          <span className="text-muted-foreground mt-0.5 block text-xs leading-snug">
            {summary}
          </span>
        </span>
        <span className="text-muted-foreground inline-flex shrink-0 items-center gap-1 type-label font-semibold">
          Manage
          <ChevronDown
            className={
              "h-3.5 w-3.5 transition-transform " + (teamExpanded ? "rotate-180" : "")
            }
            aria-hidden
          />
        </span>
      </button>

      {/* Hidden with CSS, never unmounted: listTeam runs on mount and the
          summary above needs its counts whether or not the panel is open. */}
      <div id="team-panel" className={teamExpanded ? "" : "hidden"} aria-hidden={!teamExpanded}>
      {error && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <ErrorNote message={error} />
          {!snap && !loading ? (
            <button
              type="button"
              onClick={() => void load()}
              className="bg-foreground text-background inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold transition hover:opacity-90"
            >
              Retry
            </button>
          ) : null}
        </div>
      )}

      <div className="border-border bg-muted/20 mt-5 flex flex-wrap items-end gap-3 rounded-xl border p-4">
        <div className="min-w-[12rem] flex-1">
          <TextField
            label="Invite member"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="email@place.com"
            disabled={busy}
          />
        </div>
        <div className="w-36">
          <SelectField
            label="Role"
            value={role}
            options={INVITE_ROLES.map((r) => ({
              value: r,
              label: ROLE_LABEL[r],
            }))}
            onChange={setRole}
            disabled={busy}
          />
        </div>
        <button
          type="button"
          onClick={invite}
          disabled={busy || !email.trim()}
          className="bg-foreground text-background inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
        >
          <UserPlus className="h-3.5 w-3.5" /> Invite
        </button>
        {inviteFlash ? (
          <span className="text-muted-foreground w-full text-xs" aria-live="polite">
            Invite sent.
          </span>
        ) : null}
      </div>

      {loading ? (
        <Spinner label="Loading team…" />
      ) : !snap ? null : (
        <div className="mt-5 flex flex-col gap-5">
          <Group title="Members" count={members.length}>
            {members.map((m) => {
              const isOwner = m.role === "owner";
              return (
                <Row key={m.memberId}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {m.fullName ?? m.email ?? "—"}
                      {isOwner ? (
                        <span className="text-muted-foreground ml-1.5 type-meta font-semibold tracking-wide uppercase">
                          Owner
                        </span>
                      ) : null}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {m.email ?? "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={m.role}
                      disabled={busy}
                      onChange={(e) =>
                        onRolePick(
                          m.memberId,
                          m.fullName ?? m.email ?? "this member",
                          m.role,
                          e.target.value,
                        )
                      }
                      className="border-border bg-card focus:border-foreground h-8 rounded-lg border px-2 text-xs capitalize outline-none disabled:opacity-50"
                    >
                      {MEMBER_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                    <RemoveBtn
                      disabled={busy || (isOwner && ownerCount <= 1)}
                      title={
                        isOwner && ownerCount <= 1
                          ? "Transfer ownership before removing the owner"
                          : "Remove"
                      }
                      onClick={() =>
                        setConfirm({
                          kind: "remove",
                          key: m.memberId,
                          label: m.fullName ?? m.email ?? "this member",
                          roleLabel: ROLE_LABEL[(m.role as MemberRole) ?? "editor"] ?? m.role,
                          run: () => removeMember(m.memberId, "editor"),
                        })
                      }
                    />
                  </div>
                </Row>
              );
            })}
            {members.length === 0 && (
              <Empty>
                No one from this place has an account yet. Invite them above and
                they get console access as soon as they accept.
              </Empty>
            )}
          </Group>

          <Group title="Pending invites" count={snap.pendingBusinessInvites.length}>
            {snap.pendingBusinessInvites.map((p) => (
              <Row key={p.id}>
                <div className="flex min-w-0 items-center gap-2">
                  <Mail className="text-muted-foreground h-4 w-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.email}</p>
                    <p className="text-muted-foreground truncate text-xs capitalize">
                      {ROLE_LABEL[(p.role as MemberRole) ?? "editor"] ?? p.role} ·
                      expires {formatShortDate(p.expiresAt)}
                    </p>
                  </div>
                </div>
                <RemoveBtn
                  disabled={busy}
                  onClick={() =>
                    setConfirm({
                      kind: "remove",
                      key: p.id,
                      label: p.email,
                      roleLabel: `${ROLE_LABEL[(p.role as MemberRole) ?? "editor"] ?? p.role} invite`,
                      run: () => removeMember(p.id, "editorInvite"),
                    })
                  }
                />
              </Row>
            ))}
            {snap.pendingBusinessInvites.length === 0 && (
              <Empty>No pending invites.</Empty>
            )}
          </Group>
        </div>
      )}

      </div>

      <ConfirmDialog
        open={confirm != null}
        title={
          confirm?.kind === "transfer"
            ? "Transfer ownership?"
            : confirm?.kind === "role"
              ? "Change role?"
              : "Remove access?"
        }
        body={
          confirm?.kind === "transfer" ? (
            <p>
              Make{" "}
              <span className="text-foreground font-semibold">{confirm.label}</span>{" "}
              the owner? The current owner becomes an editor. Only one owner
              per place.
            </p>
          ) : confirm?.kind === "role" ? (
            <p>
              Change{" "}
              <span className="text-foreground font-semibold">{confirm.label}</span>{" "}
              from {ROLE_LABEL[confirm.from]} to {ROLE_LABEL[confirm.next]}?
            </p>
          ) : (
            <p>
              Remove{" "}
              <span className="text-foreground font-semibold">{confirm?.label}</span>{" "}
              as{" "}
              <span className="text-foreground font-semibold">
                {confirm?.kind === "remove" ? confirm.roleLabel : ""}
              </span>
              ? They lose console access immediately.
            </p>
          )
        }
        confirmLabel={
          confirm?.kind === "transfer"
            ? "Transfer"
            : confirm?.kind === "role"
              ? "Change role"
              : "Remove"
        }
        danger={confirm?.kind === "remove"}
        busy={busy}
        onConfirm={() => {
          if (!confirm) return;
          const t = confirm;
          setConfirm(null);
          if (t.kind === "remove") {
            run(t.run);
            return;
          }
          if (t.kind === "transfer") {
            run(() => updateMemberRole(t.memberId, "owner"));
            return;
          }
          run(() => updateMemberRole(t.memberId, t.next));
        }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

function Group({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-muted-foreground type-label font-semibold tracking-[0.12em] uppercase">
        {title} · {count}
      </p>
      <div className="mt-2 flex flex-col gap-2">{children}</div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-border bg-background flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground px-1 text-xs leading-relaxed">{children}</p>
  );
}

function RemoveBtn({
  disabled,
  onClick,
  title = "Remove",
}: {
  disabled: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      className="border-border text-muted-foreground hover:border-destructive/50 hover:text-destructive inline-flex h-8 w-8 items-center justify-center rounded-lg border transition disabled:opacity-50"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
