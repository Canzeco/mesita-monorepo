"use client";

import { Fragment, useState } from "react";
import { Flag } from "lucide-react";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { RowDivider, SettingsGroup } from "@/components/consumer/me/settings-rows";
import { EFError } from "@/lib/api/_invoke";
import {
  apiReportPlace,
  NOTE_REQUIRED,
  PLACE_REPORT_NOTE_MAX,
  PLACE_REPORT_REASONS,
  type PlaceReportReason,
} from "@/lib/api/reports";
import type { PlaceDetail } from "@/lib/place-detail";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import {
  PRIMARY_BUTTON_CLASS,
  SHEET_BODY_CLASS,
  SHEET_TITLE_CLASS,
} from "@/lib/ui-classes";
import { cn, errMsg } from "@/lib/utils";

// REPORT, FROM THE THREE DOTS (Pato, MESITA-2684: "three dots is a button to
// report"), Instagram's way: why, one reason, then Send. It is the guest's
// feedback channel (MESITA-3024): once a reason is picked a note box asks the
// right question for it ("Which link?" for a wrong link), and Something else
// needs words. Send stores it (consumer-web-report-place); every send is its
// own row and lands on admin's Activity › Feedback. A refused send (4xx) says
// why here and keeps the sheet open with the choice intact; network, session
// and server failures are said once, by the app's error notifier
// (MESITA-3021).
// decision: an in-app report that is stored, not a mailto to support (a mail
// app leaves the screen and nothing reaches the catalog).

export function ReportSheet({
  place,
  open,
  onClose,
}: {
  place: PlaceDetail;
  open: boolean;
  onClose: () => void;
}) {
  return (
    // LocalSheet unmounts its children once closed, so every opening starts
    // with no reason picked.
    <LocalSheet open={open} onClose={onClose} ariaLabel={`Report ${place.name}`}>
      <ReportForm place={place} onDone={onClose} />
    </LocalSheet>
  );
}

function ReportForm({
  place,
  onDone,
}: {
  place: PlaceDetail;
  onDone: () => void;
}) {
  const getSupabase = useLazyBrowserSupabase();
  const [reason, setReason] = useState<PlaceReportReason | null>(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  const chosen = PLACE_REPORT_REASONS.find((r) => r.key === reason) ?? null;
  const ready =
    reason != null && !(NOTE_REQUIRED.has(reason) && note.trim() === "");

  async function send() {
    if (!reason || !ready || sending) return;
    setSending(true);
    try {
      await apiReportPlace(getSupabase(), { placeId: place.id, reason, note });
      toast.success("Thanks for letting us know");
      onDone();
    } catch (err) {
      // reportEFFailure already said a network, session or server failure;
      // a refusal (4xx) is this sheet's to explain.
      const status = err instanceof EFError ? err.status : null;
      if (status === 429) {
        toast.error("You've sent a lot of reports. Try again later.");
      } else if (status != null && status >= 400 && status < 500 && status !== 401) {
        toast.error(errMsg(err, "Couldn't send your report. Try again."));
      }
      setSending(false);
    }
  }

  return (
    <div className={SHEET_BODY_CLASS}>
      <div className="flex items-center gap-3">
        <span className="bg-muted text-muted-foreground flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
          <Flag className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className={SHEET_TITLE_CLASS}>Report</h2>
          <p className="text-muted-foreground truncate text-xs">{place.name}</p>
        </div>
      </div>

      <p className="mt-5 text-sm font-semibold">
        Why are you reporting this place?
      </p>
      <div className="mt-2" role="radiogroup" aria-label="Reason">
        <SettingsGroup>
          {PLACE_REPORT_REASONS.map((r, i) => {
            const picked = reason === r.key;
            return (
              <Fragment key={r.key}>
                {i > 0 && <RowDivider />}
                <button
                  type="button"
                  role="radio"
                  aria-checked={picked}
                  onClick={() => setReason(r.key)}
                  className="hover:bg-muted flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium transition"
                >
                  <span className="min-w-0 flex-1">{r.label}</span>
                  <span
                    aria-hidden
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                      picked ? "border-foreground" : "border-border",
                    )}
                  >
                    {picked ? (
                      <span className="bg-foreground h-2.5 w-2.5 rounded-full" />
                    ) : null}
                  </span>
                </button>
              </Fragment>
            );
          })}
        </SettingsGroup>
      </div>

      {chosen && (
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={PLACE_REPORT_NOTE_MAX}
          placeholder={chosen.prompt}
          aria-label={chosen.prompt}
          className="border-border bg-card focus:border-foreground/40 mt-3 w-full resize-none rounded-2xl border px-4 py-3 text-sm outline-none"
        />
      )}

      <button
        type="button"
        onClick={() => void send()}
        disabled={!ready || sending}
        className={cn(PRIMARY_BUTTON_CLASS, "mt-5")}
      >
        {sending ? "Sending…" : "Send report"}
      </button>
    </div>
  );
}
