"use client";

// /me/integrations/calendar (MESITA-3954, Pato: "enable Google Calendar or
// other Calendar in order to update your calendar based on that
// reservations"). One private feed link; each row hands it to a calendar's
// own subscribe door, so new and cancelled tables follow on their own.
// Reservations' header calendar icon opens this page too.

import { useState } from "react";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { CalendarMark, type CalendarKind } from "@/components/shared/calendar-marks";
import { MeScreen } from "@/components/consumer/me/MeScreen";
import {
  MeLead,
  RowDivider,
  SettingsActionRow,
  SettingsGroup,
} from "@/components/consumer/me/settings-rows";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";
import { apiGetCalendarLink, calendarSubscribeLinks } from "@/lib/api/calendar";
import { writeCached } from "@/lib/screen-cache";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import {
  SHEET_BODY_CLASS,
  SHEET_CANCEL_BUTTON_CLASS,
  SHEET_TITLE_CLASS,
} from "@/lib/ui-classes";
import { useCachedQuery } from "@/lib/use-cached-query";
import { errMsg } from "@/lib/utils";

const KEY = "calendar-link";
const ROW_CLASS = "hover:bg-muted flex w-full items-center gap-3 px-4 py-3 text-left transition";

function CalendarRow({
  kind,
  href,
  label,
  sub,
}: {
  kind: CalendarKind;
  href: string | null;
  label: string;
  sub: string;
}) {
  const inner = (
    <>
      {/* Each calendar's own mark (MESITA-3979), in the chip's 36px box. */}
      <span className="flex h-9 w-9 shrink-0 items-center justify-center" aria-hidden>
        <CalendarMark kind={kind} size={32} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="text-muted-foreground type-label block truncate">{sub}</span>
      </span>
      <ArrowUpRight className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
    </>
  );
  if (!href) {
    return (
      <div className={`${ROW_CLASS} opacity-60`} aria-busy>
        {inner}
      </div>
    );
  }
  return (
    <a href={href} target="_blank" rel="noreferrer" className={ROW_CLASS}>
      {inner}
    </a>
  );
}

export function CalendarModal() {
  const getSupabase = useLazyBrowserSupabase();
  const link = useCachedQuery<string>(KEY, () => apiGetCalendarLink(getSupabase()), {
    ttl: 24 * 3600_000,
  });
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const url = link.data;
  const subs = url ? calendarSubscribeLinks(url) : null;

  const reset = async () => {
    setBusy(true);
    try {
      writeCached(KEY, await apiGetCalendarLink(getSupabase(), true));
      setConfirm(false);
      toast.success("New link made. Add your calendar again.");
    } catch (e) {
      toast.error(errMsg(e, "Couldn't make a new link."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <MeScreen title="Calendar">
      <MeLead>
        Your reservations show up in your calendar and stay up to date. Cancelled tables
        come off on their own.
      </MeLead>
      <div className="flex flex-col gap-6">
        <SettingsGroup title="Add to">
          <CalendarRow kind="google" href={subs?.google ?? null} label="Google Calendar" sub="Android or web" />
          <RowDivider />
          <CalendarRow kind="apple" href={subs?.apple ?? null} label="Apple Calendar" sub="iPhone or Mac" />
          <RowDivider />
          <CalendarRow kind="outlook" href={subs?.outlook ?? null} label="Outlook" sub="Microsoft" />
        </SettingsGroup>
        {/* Google, Apple and Outlook only (MESITA-3964, Pato: "No other
            calendar must be enabled"): no copy-the-link row for other apps. */}
        <SettingsGroup title="Link">
          <SettingsActionRow
            Icon={RefreshCw}
            label="Make a new link"
            sub="The old one stops working"
            disabled={!url}
            onClick={() => setConfirm(true)}
          />
        </SettingsGroup>
        {link.error && (
          <button type="button" onClick={link.reload} className="text-muted-foreground type-label underline">
            Couldn&apos;t load your link. Try again
          </button>
        )}
      </div>
      <LocalDialog open={confirm} onClose={() => setConfirm(false)} ariaLabel="Make a new link">
        <div className={SHEET_BODY_CLASS}>
          <h2 className={SHEET_TITLE_CLASS}>Make a new link?</h2>
          <p className="text-muted-foreground type-body mt-2 leading-snug">
            Calendars using the old link stop updating. Add your calendar again after.
          </p>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => setConfirm(false)} className={SHEET_CANCEL_BUTTON_CLASS}>
              Cancel
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={busy}
              className="bg-foreground text-paper flex flex-1 items-center justify-center rounded-lg py-3 text-sm font-semibold transition disabled:opacity-60"
            >
              {busy ? "Making…" : "Make new link"}
            </button>
          </div>
        </div>
      </LocalDialog>
    </MeScreen>
  );
}
