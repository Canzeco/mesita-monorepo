"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Mail, Trash2, UserPlus, Users } from "lucide-react";
import {
  inviteEditor,
  listTeam,
  removeMember,
  updateMemberRole,
  type AdminPlace,
  type TeamSnapshot,
} from "../actions";
import { ErrorNote, SectionCard, Spinner } from "../ui";

const ROLES = ["owner", "editor", "viewer"];

export function TeamSection({ place }: { place: AdminPlace }) {
  const [snap, setSnap] = useState<TeamSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, start] = useTransition();

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
      if (r.ok) setEmail("");
      return r;
    });
  };

  return (
    <SectionCard
      icon={<Users className="text-muted-foreground h-4 w-4" />}
      title="Team"
      subtitle={`Managers, pending invites and waiters for ${place.name}.`}
    >
      {error && <ErrorNote message={error} />}

      {/* Invite */}
      <div className="border-border bg-background mt-5 flex flex-wrap items-end gap-3 rounded-xl border p-4">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-sm font-medium">Invite manager</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@place.com"
            disabled={busy}
            className="border-border bg-card focus:border-foreground h-9 rounded-lg border px-3 text-sm outline-none disabled:opacity-50"
          />
        </label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          disabled={busy}
          className="border-border bg-card focus:border-foreground h-9 rounded-lg border px-2 text-sm capitalize outline-none disabled:opacity-50"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={invite}
          disabled={busy || !email.trim()}
          className="bg-foreground text-background inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
        >
          <UserPlus className="h-3.5 w-3.5" /> Invite
        </button>
      </div>

      {loading ? (
        <Spinner label="Loading team…" />
      ) : !snap ? null : (
        <div className="mt-5 flex flex-col gap-5">
          {/* Managers */}
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
                  <RemoveBtn disabled={busy} onClick={() => run(() => removeMember(m.memberId, "editor"))} />
                </div>
              </Row>
            ))}
            {snap.businesses.length === 0 && <Empty>No managers.</Empty>}
          </Group>

          {/* Pending invites */}
          {snap.pendingBusinessInvites.length > 0 && (
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
                  <RemoveBtn disabled={busy} onClick={() => run(() => removeMember(p.id, "editorInvite"))} />
                </Row>
              ))}
            </Group>
          )}

          {/* Waiters */}
          <Group title="Waiters" count={snap.waiters.length}>
            {snap.waiters.map((w) => (
              <Row key={w.userId}>
                <p className="text-sm font-medium tabular-nums">{w.phone ?? "—"}</p>
                <RemoveBtn disabled={busy} onClick={() => run(() => removeMember(`${w.userId}:${place.id}`, "waiter"))} />
              </Row>
            ))}
            {snap.waiters.length === 0 && <Empty>No waiters.</Empty>}
          </Group>
        </div>
      )}
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
  return <p className="text-muted-foreground px-1 text-xs">{children}</p>;
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
