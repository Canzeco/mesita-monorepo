"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Mail, Trash2, UserPlus, Users } from "lucide-react";
import {
  inviteEditor,
  listTeam,
  removeMember,
  updateMemberRole,
  type AdminPlace,
  type TeamSnapshot } from "../actions";
import {ConfirmDialog,SectionCard,SelectField,Spinner,TextField} from "../ui";
import { ErrorNote } from "@/components/ErrorNote";

const ROLES = ["owner", "editor", "viewer"];

type RemoveTarget = {
  key: string;
  label: string;
  roleLabel: string;
  run: () => Promise<{ ok: boolean; error?: string }>;
};

export function TeamSection({ place }: { place: AdminPlace }) {
  const [snap, setSnap] = useState<TeamSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, start] = useTransition();
  const [removeTarget, setRemoveTarget] = useState<RemoveTarget | null>(null);
  const [inviteFlash, setInviteFlash] = useState(false);

  // Invite form
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");

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

  // Initial fetch: set state only after the await (load() reused for refresh).
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

  const askRemove = (
    key: string,
    label: string,
    roleLabel: string,
    removeFn: () => Promise<{ ok: boolean; error?: string }>,
  ) => setRemoveTarget({ key, label, roleLabel, run: removeFn });

  return (
    <SectionCard
      icon={<Users className="h-4 w-4" />}
      tint="indigo"
      title="Team"
      subtitle={`Business members, pending invites and waiters for ${place.name}. Actions save immediately.`}
    >
      {error && <ErrorNote message={error} />}

      {/* Invite */}
      <div className="border-border bg-muted/20 mt-5 flex flex-wrap items-end gap-3 rounded-xl border p-4">
        <div className="min-w-[12rem] flex-1">
          <TextField
            label="Invite manager"
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
            options={ROLES.map((r) => ({ value: r, label: r }))}
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
          <Group title="Managers" count={snap.businesses.length}>
            {snap.businesses.map((m) => (
              <Row key={m.memberId}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{m.fullName ?? m.email ?? "—"}</p>
                  <p className="text-muted-foreground truncate text-xs">{m.email ?? "—"}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <select
                    value={m.role}
                    disabled={busy}
                    onChange={(e) => run(() => updateMemberRole(m.memberId, e.target.value))}
                    className="border-border bg-card focus:border-foreground h-8 rounded-lg border px-2 text-xs capitalize outline-none disabled:opacity-50"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <RemoveBtn
                    disabled={busy}
                    onClick={() =>
                      askRemove(
                        m.memberId,
                        m.fullName ?? m.email ?? "this member",
                        m.role,
                        () => removeMember(m.memberId, "editor"),
                      )
                    }
                  />
                </div>
              </Row>
            ))}
            {snap.businesses.length === 0 && (
              <Empty>No business members on this project yet.</Empty>
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
                      {p.role} · expires {new Date(p.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <RemoveBtn
                  disabled={busy}
                  onClick={() =>
                    askRemove(p.id, p.email, `${p.role} invite`, () =>
                      removeMember(p.id, "editorInvite"),
                    )
                  }
                />
              </Row>
            ))}
            {snap.pendingBusinessInvites.length === 0 && (
              <Empty>No pending invites.</Empty>
            )}
          </Group>

          <Group title="Waiters" count={snap.waiters.length}>
            {snap.waiters.map((w) => (
              <Row key={w.userId}>
                <p className="text-sm font-medium tabular-nums">{w.phone ?? "—"}</p>
                <RemoveBtn
                  disabled={busy}
                  onClick={() =>
                    askRemove(`${w.userId}:${place.id}`, w.phone ?? "this waiter", "waiter", () =>
                      removeMember(`${w.userId}:${place.id}`, "waiter"),
                    )
                  }
                />
              </Row>
            ))}
            {snap.waiters.length === 0 && <Empty>No waiters linked.</Empty>}
          </Group>
        </div>
      )}

      <ConfirmDialog
        open={removeTarget != null}
        title="Remove access?"
        body={
          <p>
            Remove{" "}
            <span className="text-foreground font-semibold">{removeTarget?.label}</span> as{" "}
            <span className="text-foreground font-semibold">{removeTarget?.roleLabel}</span>?
            They lose console access immediately.
          </p>
        }
        confirmLabel="Remove"
        danger
        busy={busy}
        onConfirm={() => {
          if (!removeTarget) return;
          const t = removeTarget;
          setRemoveTarget(null);
          run(t.run);
        }}
        onCancel={() => setRemoveTarget(null)}
      />
    </SectionCard>
  );
}

function Group({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase">
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
  return <p className="text-muted-foreground px-1 text-xs leading-relaxed">{children}</p>;
}

function RemoveBtn({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title="Remove"
      className="border-border text-muted-foreground hover:border-destructive/50 hover:text-destructive inline-flex h-8 w-8 items-center justify-center rounded-lg border transition disabled:opacity-50"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
