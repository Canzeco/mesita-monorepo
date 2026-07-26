"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/PageContainer";
import { resetDatabase } from "./actions";

// DB Config — database-wide operator actions. Today: reset the environment
// (moved here from Admin Config 2026-07-26). Super-admins only.

// Must match the EF's CONFIRM_PHRASE.
const CONFIRM_PHRASE = "RESET";

export function DbConfigClient() {
  return (
    <PageContainer size="3xl" className="flex flex-col gap-6 sm:gap-8">
      <PageHeader
        eyebrow="Operations · Database"
        title="DB Config"
        description="Database-wide operator actions. Handle with care — these run against the live singleton backend. Super-admins only."
      />
      <ResetCard />
    </PageContainer>
  );
}

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
          <h2 className="text-lg font-semibold text-red-700">Reset database</h2>
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
        <p className="rounded-xl bg-red-100 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
    </section>
  );
}
