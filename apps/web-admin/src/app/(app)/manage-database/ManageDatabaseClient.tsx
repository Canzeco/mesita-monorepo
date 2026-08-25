"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/PageContainer";
import { Button, TextField } from "@/components/admin-ui/config";
import { continueStoragePurge, resetDatabase } from "./actions";

// Manage Database — database-wide operator actions. Today: reset the
// environment (moved here from Admins 2026-07-26). Super-admins only.

// Must match the EF's CONFIRM_PHRASE.
const CONFIRM_PHRASE = "RESET";

// The EF wipes the DB in one call but purges storage a time-budgeted slice at
// a time, so one press can take several round trips. This is the ceiling on
// them: at ~20s and thousands of files per slice it is far past any real
// catalog, and it means a bucket that somehow refills can't spin forever.
const MAX_PURGE_PASSES = 60;

export function ManageDatabaseClient() {
  return (
    <PageContainer size="3xl" className="flex flex-col gap-6 sm:gap-8">
      <PageHeader
        eyebrow="Manage · Database"
        title="Database"
        description="Database-wide operator actions. Handle with care — these run against the live singleton backend. Super-admins only."
      />
      <ResetCard />
    </PageContainer>
  );
}

function ResetCard() {
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const armed = confirm === CONFIRM_PHRASE;

  async function onReset() {
    if (!armed || busy) return;
    setBusy(true);
    setProgress(null);
    setResult(null);
    setWarning(null);
    setError(null);

    // Pass 1 wipes the DB and starts the purge; the rest only drain storage.
    let r = await resetDatabase(confirm);
    if (!r.ok) {
      setBusy(false);
      setError(r.error);
      return;
    }

    const truncatedTables = r.truncatedTables;
    const deletedAuthUsers = r.deletedAuthUsers;
    let purged = r.purgedStorageObjects;
    let passes = 1;

    while (r.ok && !r.storageDone && !r.storagePurgeError) {
      if (passes >= MAX_PURGE_PASSES) {
        setWarning(
          `Stopped after ${passes} storage passes with ${r.remainingStorageObjects} file(s) left. ` +
            `The database is reset — press again to clear the rest.`,
        );
        break;
      }
      setProgress(
        `Database emptied. Clearing stored files — ${purged} done, ` +
          `${r.remainingStorageObjects} to go…`,
      );
      r = await continueStoragePurge(confirm);
      passes += 1;
      if (!r.ok) {
        setBusy(false);
        setProgress(null);
        setError(
          `The database was reset, but clearing stored files failed: ${r.error}. ` +
            `Press again to clear the rest.`,
        );
        return;
      }
      purged += r.purgedStorageObjects;
    }

    setBusy(false);
    setProgress(null);
    setResult(
      `Database reset complete. Emptied ${truncatedTables ?? "?"} table(s), ` +
        `removed ${deletedAuthUsers ?? "?"} non-admin auth account(s) and ` +
        `purged ${purged} stored file(s).`,
    );
    // The DB wipe committed either way — the purge is the part that stopped.
    if (r.ok && r.storagePurgeError) {
      setWarning(
        `Storage purge stopped early (${r.storagePurgeError}) with ${r.remainingStorageObjects} file(s) left. ` +
          `The database is reset; press again to clear them.`,
      );
    }
    setConfirm("");
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
            Irreversible. Wipes operational data — admin configs stay.
          </p>
        </div>
      </div>

      <p className="text-muted-foreground text-sm leading-relaxed">
        Permanently empties every operational table — places, tickets,
        reservations, consumers, accounts, invites, verifications, enrichment —
        deletes every stored image and menu file, and removes every auth account
        that isn&apos;t an admin.{" "}
        <strong>Preserved:</strong> admin allowlist, every admin console
        config, reward payout rules, and the category / tag / class / plan
        vocabularies. This cannot be undone.
      </p>

      <label className="flex flex-col gap-1.5">
        <span className="text-foreground text-sm font-medium">
          Type{" "}
          <span className="rounded bg-red-100 px-1.5 py-0.5 font-mono text-red-700">
            {CONFIRM_PHRASE}
          </span>{" "}
          to confirm
        </span>
        <TextField
          value={confirm}
          onChange={setConfirm}
          placeholder={CONFIRM_PHRASE}
          autoComplete="off"
          spellCheck={false}
          className="font-mono focus:border-red-400 focus:ring-2 focus:ring-red-200"
        />
      </label>

      <Button
        tone="danger"
        pending={busy}
        disabled={!armed}
        onClick={onReset}
      >
        {busy ? "Resetting…" : "Reset database"}
      </Button>

      {progress && (
        <p className="text-muted-foreground bg-muted inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          {progress}
        </p>
      )}
      {result && (
        <p className="inline-flex items-center gap-1.5 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {result}
        </p>
      )}
      {warning && (
        <p className="inline-flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {warning}
        </p>
      )}
      {error && (
        <p className="rounded-xl bg-red-100 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
    </section>
  );
}
