"use client";

import { useState, useTransition } from "react";
import { Loader2, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { grantAdmin, revokeAdmin, type AdminRow } from "./actions";
import { PageContainer, PageHeader } from "@/components/PageContainer";

export function AdminConfigClient({
  initialAdmins,
  self,
  loadError,
}: {
  initialAdmins: AdminRow[];
  self: string | null;
  loadError: string | null;
}) {
  return (
    <PageContainer size="3xl" className="flex flex-col gap-6 sm:gap-8">
      <PageHeader
        eyebrow="Operations · Admins"
        title="Admins"
        description="Manage who has admin access. Super-admins only."
      />

      <AdminsCard initialAdmins={initialAdmins} self={self} loadError={loadError} />
    </PageContainer>
  );
}

// ─── Admins ──────────────────────────────────────────────────────────────

function AdminsCard({
  initialAdmins,
  self,
  loadError,
}: {
  initialAdmins: AdminRow[];
  self: string | null;
  loadError: string | null;
}) {
  const [admins, setAdmins] = useState<AdminRow[]>(initialAdmins);
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(loadError);
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [adding, startAdd] = useTransition();
  const [removing, startRemove] = useTransition();

  const add = () => {
    const e = email.trim().toLowerCase();
    if (!e || adding) return;
    setError(null);
    startAdd(async () => {
      const r = await grantAdmin(e, note.trim());
      if (!r.ok) {
        setError(r.error);
        return;
      }
      // Reconcile from the row the EF actually wrote (authoritative note,
      // created_at, added_by), then keep the list in created_at order to
      // match admin-list-admins.
      const row = r.admin;
      setAdmins((prev) =>
        [...prev.filter((a) => a.email !== row.email), row].sort((a, b) =>
          a.created_at.localeCompare(b.created_at),
        ),
      );
      setEmail("");
      setNote("");
    });
  };

  const remove = (target: string) => {
    if (removing) return;
    setError(null);
    setBusyEmail(target);
    startRemove(async () => {
      const r = await revokeAdmin(target);
      setBusyEmail(null);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setAdmins((prev) => prev.filter((a) => a.email !== target));
    });
  };

  const onlyOne = admins.length <= 1;

  return (
    <section className="border-border bg-card rounded-2xl border p-4 sm:p-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="text-muted-foreground h-4 w-4" />
        <h2 className="font-display text-base font-semibold tracking-tight">
          Admins
        </h2>
        <span className="text-muted-foreground text-xs tabular-nums">
          · {admins.length}
        </span>
      </div>
      <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
        Everyone on the super-admin allowlist. Add or remove by email — the
        account doesn&apos;t need to exist yet.
      </p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="name@example.com"
          autoComplete="off"
          spellCheck={false}
          className="border-border bg-background focus:border-foreground h-10 flex-1 rounded-xl border px-3 text-sm outline-none"
        />
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Note (optional)"
          maxLength={280}
          className="border-border bg-background focus:border-foreground h-10 flex-1 rounded-xl border px-3 text-sm outline-none"
        />
        <button
          type="button"
          onClick={add}
          disabled={adding || email.trim().length === 0}
          className="bg-foreground text-background inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
        >
          {adding ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <UserPlus className="h-3.5 w-3.5" />
          )}
          Add
        </button>
      </div>

      {error && <ErrorNote message={error} />}

      <ul className="border-border divide-border/60 mt-5 divide-y overflow-hidden rounded-xl border">
        {admins.length === 0 && (
          <li className="text-muted-foreground px-4 py-4 text-sm">
            No admins loaded.
          </li>
        )}
        {admins.map((a) => {
          const isSelf = !!self && a.email === self;
          const busy = busyEmail === a.email;
          return (
            <li
              key={a.email}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {a.email}
                  {isSelf && (
                    <span className="text-muted-foreground ml-1.5 text-xs font-normal">
                      · you
                    </span>
                  )}
                </p>
                {a.note && (
                  <p className="text-muted-foreground truncate text-xs">
                    {a.note}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => remove(a.email)}
                disabled={isSelf || onlyOne || busy || removing}
                title={
                  isSelf
                    ? "You can't remove yourself"
                    : onlyOne
                      ? "Can't remove the last admin"
                      : "Remove admin"
                }
                className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}


