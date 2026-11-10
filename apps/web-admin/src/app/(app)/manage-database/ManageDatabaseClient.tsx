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
    <PageContainer className="flex flex-col gap-6 sm:gap-8">
      <PageHeader
        title="Database"
        description="Database-wide operator actions. Handle with care — these run against the live singleton backend. Super-admins only."
      />
      <ResetCard />
    </PageContainer>
  );
}

type PurgeOutcome = {
  purged: number;
  remaining: number;
  /** Why the drain stopped short, or null when every file is gone. */
  stoppedBecause: string | null;
};

// Drains storage only: `continueStoragePurge` never touches the database.
// MESITA-3590: a stalled purge is resumed through this, never by pressing
// Reset again — that would wipe everything created since the first reset.
async function drainStorage(
  confirmPhrase: string,
  onProgress: (purged: number, remaining: number) => void,
  start: { purged: number; remaining: number; done: boolean; error: string | null },
): Promise<PurgeOutcome> {
  let purged = start.purged;
  let remaining = start.remaining;
  if (start.error) return { purged, remaining, stoppedBecause: start.error };
  let done = start.done;
  let passes = 0;
  while (!done) {
    if (passes >= MAX_PURGE_PASSES) {
      return { purged, remaining, stoppedBecause: `stopped after ${passes} passes` };
    }
    onProgress(purged, remaining);
    const r = await continueStoragePurge(confirmPhrase);
    passes += 1;
    if (!r.ok) return { purged, remaining, stoppedBecause: r.error };
    purged += r.purgedStorageObjects;
    remaining = r.remainingStorageObjects;
    if (r.storagePurgeError) {
      return { purged, remaining, stoppedBecause: r.storagePurgeError };
    }
    done = r.storageDone;
  }
  return { purged, remaining, stoppedBecause: null };
}

function ResetCard() {
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stripeLeft, setStripeLeft] = useState<string[]>([]);
  // Set once a reset committed but files are still there: the card then
  // offers "Finish clearing files" instead of another full reset.
  const [filesPending, setFilesPending] = useState(false);

  const armed = confirm === CONFIRM_PHRASE;

  function showProgress(purged: number, remaining: number) {
    setProgress(
      `Database emptied. Clearing stored files — ${purged} done, ${remaining} to go…`,
    );
  }

  function reportPurge(outcome: PurgeOutcome) {
    setProgress(null);
    if (outcome.stoppedBecause) {
      setFilesPending(true);
      setWarning(
        `Clearing stored files stopped (${outcome.stoppedBecause}) with ` +
          `${outcome.remaining} file(s) left. The database is reset. ` +
          `Type ${CONFIRM_PHRASE} and press "Finish clearing files" to remove the rest. ` +
          `It does not reset the database again, but it deletes every stored file, ` +
          `including photos and menus of places added since the reset.`,
      );
    } else {
      setFilesPending(false);
      setWarning(null);
    }
  }

  async function onReset() {
    if (!armed || busy || filesPending) return;
    setBusy(true);
    setProgress(null);
    setResult(null);
    setWarning(null);
    setError(null);
    setStripeLeft([]);
    // Becomes true once the wipe committed, so a later throw says so.
    let committed = false;

    try {
      // The only call that wipes the database. Everything after drains files.
      const r = await resetDatabase(confirm);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      // The database IS reset from here on. Until the drain finishes, the
      // card offers only "Finish clearing files", so a purge that throws
      // (network drop, function timeout) never leads back to a second wipe.
      committed = true;
      setFilesPending(true);
      setWarning(
        `The database is reset. If clearing stored files stops, type ${CONFIRM_PHRASE} ` +
          `and press "Finish clearing files"; never reset again.`,
      );
      const phrase = confirm;
      setConfirm("");
      setStripeLeft([...r.stripeAccountsLeft, ...r.stripeCustomersLeft]);

      const outcome = await drainStorage(phrase, showProgress, {
        purged: r.purgedStorageObjects,
        remaining: r.remainingStorageObjects,
        done: r.storageDone,
        error: r.storagePurgeError,
      });
      setResult(
        `Database reset complete. Emptied ${r.truncatedTables ?? "?"} table(s), ` +
          `removed ${r.deletedAuthUsers ?? "?"} non-admin auth account(s) and ` +
          `purged ${outcome.purged} stored file(s).`,
      );
      reportPurge(outcome);
    } catch (err) {
      setProgress(null);
      const msg = err instanceof Error ? err.message : "Reset failed.";
      setError(
        committed
          ? `Clearing stored files failed (${msg}). The database is reset.`
          : msg,
      );
    } finally {
      setBusy(false);
    }
  }

  async function onFinishFiles() {
    if (!armed || busy) return;
    setBusy(true);
    setError(null);
    const phrase = confirm;
    setConfirm("");
    try {
      const outcome = await drainStorage(phrase, showProgress, {
        purged: 0,
        remaining: 0,
        done: false,
        error: null,
      });
      reportPurge(outcome);
      if (!outcome.stoppedBecause) {
        setResult(`Stored files cleared: purged ${outcome.purged} more file(s).`);
      }
    } catch (err) {
      setProgress(null);
      setError(err instanceof Error ? err.message : "Clearing files failed.");
    } finally {
      setBusy(false);
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
            Irreversible. Wipes operational data — admin configs stay.
          </p>
        </div>
      </div>

      <p className="text-muted-foreground text-sm leading-relaxed">
        Permanently empties every operational table — places, reservations,
        consumers, enrichment — deletes every stored image and menu file, and
        removes every auth account that isn&apos;t an admin.{" "}
        <strong>Preserved:</strong> admin allowlist, every admin console
        config, and the category / tag / family vocabularies. This cannot be
        undone.
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

      {filesPending ? (
        <Button
          tone="danger"
          pending={busy}
          disabled={!armed}
          onClick={onFinishFiles}
        >
          {busy ? "Clearing files…" : "Finish clearing files"}
        </Button>
      ) : (
        <Button
          tone="danger"
          pending={busy}
          disabled={!armed}
          onClick={onReset}
        >
          {busy ? "Resetting…" : "Reset database"}
        </Button>
      )}

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
      {stripeLeft.length > 0 && (
        <p className="text-muted-foreground bg-muted rounded-xl px-3 py-2 text-sm break-all">
          Left in Stripe (test mode), safe to delete there: {stripeLeft.join(", ")}
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
