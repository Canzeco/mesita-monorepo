"use client";

import { useState, useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Trash2,
  UserPlus,
} from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import {
  grantAdmin,
  resetDatabase,
  revokeAdmin,
  type AdminRow,
} from "./actions";
import { PageContainer, PageHeader } from "@/components/PageContainer";

// Must match the EF's CONFIRM_PHRASE.
const CONFIRM_PHRASE = "RESET";

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
        eyebrow="Operations · Admin"
        title="Admin Config"
        description="Manage who has admin access and reset the environment. Super-admins only."
      />

      <AdminsCard initialAdmins={initialAdmins} self={self} loadError={loadError} />
      <ResetCard />
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

// ─── Reset database ──────────────────────────────────────────────────────

function ResetCard() {
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const armed = confirm === CONFIRM_PHRASE;

  async function onReset() {
    if (!armed || busy) return;
    setBusy(true);
    setResult(null);
    setError(null);
    const r = await resetDatabase(confirm);
    setBusy(false);
    if (r.ok) {
      setResult(
        `Database reset complete. Removed ${
          r.deletedAuthUsers ?? "?"
        } non-admin auth account(s).`,
      );
      setConfirm("");
    } else {
      setError(r.error);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-red-200 bg-red-50/50 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-red-700">
            Reset database
          </h2>
          <p className="text-muted-foreground text-sm">
            Irreversible. Everything goes except the admins.
          </p>
        </div>
      </div>

      <p className="text-muted-foreground text-sm leading-relaxed">
        Permanently deletes <strong>all</strong> places, tickets, consumers,
        businesses, staff invites, verifications and place roles, and removes
        every auth account that isn&apos;t an admin. The admin allowlist and app
        settings are kept. This cannot be undone.
      </p>

      <label className="flex flex-col gap-1.5">
        <span className="text-foreground text-sm font-medium">
          Type{" "}
          <span className="rounded bg-red-100 px-1.5 py-0.5 font-mono text-red-700">
            {CONFIRM_PHRASE}
          </span>{" "}
          to confirm
        </span>
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={CONFIRM_PHRASE}
          autoComplete="off"
          spellCheck={false}
          className="border-border bg-card h-11 rounded-xl border px-3 font-mono text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-200"
        />
      </label>

      <button
        type="button"
        onClick={onReset}
        disabled={!armed || busy}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-red-600 px-5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Resetting…
          </>
        ) : (
          "Reset database"
        )}
      </button>

      {result && (
        <p className="inline-flex items-center gap-1.5 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {result}
        </p>
      )}
      {error && (
        <p className="rounded-xl bg-red-100 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}

