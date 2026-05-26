"use client";

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { resetDatabase } from "./actions";

// Must match the EF's CONFIRM_PHRASE.
const CONFIRM_PHRASE = "RESET";

export function DangerClient() {
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
        } non-super-admin auth account(s).`,
      );
      setConfirm("");
    } else {
      setError(r.error);
    }
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-10">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Danger zone
          </h1>
          <p className="text-muted-foreground text-sm">
            Irreversible operations. Super-admins only.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-red-200 bg-red-50/50 p-6">
        <div>
          <h2 className="text-lg font-semibold text-red-700">
            Reset entire database
          </h2>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            Permanently deletes <strong>all</strong> venues, tickets, consumers,
            businesses, staff invites, verifications, venue roles and the cashback
            ledger, and removes every auth account that isn&apos;t a
            super-admin. The super-admin allowlist and app settings are kept.
            This cannot be undone.
          </p>
        </div>

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
            className="border-border h-11 rounded-xl border bg-white px-3 font-mono text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-200"
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
          <p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-700">
            {result}
          </p>
        )}
        {error && (
          <p className="rounded-xl bg-red-100 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
