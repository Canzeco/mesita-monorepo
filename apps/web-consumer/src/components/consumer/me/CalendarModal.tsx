"use client";

// /me/integrations/calendar (MESITA-3954; connected state MESITA-4041, Pato:
// "actually put toggles or something … to understand that calendar is
// connected"). Each calendar has its own private feed link:
//   not connected  (it never read its link)  → Add: that calendar's own
//                  subscribe page; the row turns Connected once it reads it
//   connected      → a switch and when it last synced. Off = its link serves
//                  an empty calendar, so Mesita's tables leave it on its
//                  next sync; on again brings them back
// Reservations' header calendar icon opens this page too.

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { CalendarMark } from "@/components/shared/calendar-marks";
import { MeScreen } from "@/components/consumer/me/MeScreen";
import {
  ME_BUTTON_CLASS,
  RowDivider,
  SettingsActionRow,
  SettingsGroup,
  Switch,
} from "@/components/consumer/me/settings-rows";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";
import {
  apiGetCalendarFeeds,
  type CalendarFeed,
  type CalendarFeeds,
  type CalendarKind,
  subscribeUrl,
} from "@/lib/api/calendar";
import { writeCached } from "@/lib/screen-cache";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { timeAgo } from "@/lib/time-ago";
import { toast } from "@/lib/toast";
import {
  SHEET_BODY_CLASS,
  SHEET_CANCEL_BUTTON_CLASS,
  SHEET_TITLE_CLASS,
} from "@/lib/ui-classes";
import { useCachedQuery } from "@/lib/use-cached-query";
import { errMsg } from "@/lib/utils";

const KEY = "calendar-feeds";
const ROW_CLASS = "flex w-full items-center gap-3 px-4 py-3 text-left";

const CALENDARS: Array<{ kind: CalendarKind; label: string; app: string }> = [
  { kind: "google", label: "Google Calendar", app: "Google Calendar" },
  { kind: "apple", label: "Apple Calendar", app: "Apple Calendar" },
  { kind: "outlook", label: "Outlook", app: "Outlook" },
];

function synced(at: string): string {
  const ago = timeAgo(at);
  if (ago === "now") return "Synced just now";
  return /\d[mhd]$/.test(ago) ? `Synced ${ago} ago` : `Synced ${ago}`;
}

function Mark({ kind }: { kind: CalendarKind }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center" aria-hidden>
      <CalendarMark kind={kind} size={32} />
    </span>
  );
}

function Text({ label, sub }: { label: string; sub: string }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-semibold">{label}</span>
      <span className="text-muted-foreground type-label block truncate">{sub}</span>
    </span>
  );
}

function CalendarRow({
  kind,
  label,
  app,
  feed,
  pending,
  added,
  onAdd,
  onSwitch,
}: {
  kind: CalendarKind;
  label: string;
  app: string;
  feed: CalendarFeed | null;
  pending: boolean;
  added: boolean;
  onAdd: () => void;
  onSwitch: (on: boolean) => void;
}) {
  // Still loading: the row, dimmed, with nothing to press.
  if (!feed) {
    return (
      <div className={`${ROW_CLASS} opacity-60`} aria-busy>
        <Mark kind={kind} />
        <Text label={label} sub="Checking…" />
      </div>
    );
  }

  // Connected: it has read its link at least once. The whole row flips it.
  if (feed.last_read_at) {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={feed.on}
        disabled={pending}
        onClick={() => onSwitch(!feed.on)}
        className={`${ROW_CLASS} hover:bg-muted transition disabled:opacity-60`}
        data-calendar-switch={kind}
      >
        <Mark kind={kind} />
        <Text
          label={label}
          sub={feed.on ? synced(feed.last_read_at) : `Off · your tables leave ${app} on its next sync`}
        />
        <Switch on={feed.on} />
      </button>
    );
  }

  // Not connected yet: Add opens the calendar's own subscribe page. Once it
  // reads the link, the row turns into the switch above.
  return (
    <div className={ROW_CLASS} data-calendar-add={kind}>
      <Mark kind={kind} />
      <Text label={label} sub={added ? `Finish in ${app}; it shows here once connected` : "Not connected"} />
      <a
        href={subscribeUrl(kind, feed.url)}
        target="_blank"
        rel="noreferrer"
        onClick={onAdd}
        className={`${ME_BUTTON_CLASS} bg-foreground text-paper flex shrink-0 items-center px-4`}
      >
        Add
      </a>
    </div>
  );
}

export function CalendarModal() {
  const getSupabase = useLazyBrowserSupabase();
  const feeds = useCachedQuery<CalendarFeeds>(KEY, () => apiGetCalendarFeeds(getSupabase()), {
    ttl: 60_000,
  });
  const [added, setAdded] = useState<Partial<Record<CalendarKind, boolean>>>({});
  const [pending, setPending] = useState<CalendarKind | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const data = feeds.data;
  const { reload } = feeds;

  // Back from the calendar's tab: ask again, so a calendar that just read
  // its link shows Connected without a reload.
  useEffect(() => {
    const again = () => {
      if (document.visibilityState === "visible") reload();
    };
    document.addEventListener("visibilitychange", again);
    window.addEventListener("focus", again);
    return () => {
      document.removeEventListener("visibilitychange", again);
      window.removeEventListener("focus", again);
    };
  }, [reload]);

  const flip = async (kind: CalendarKind, app: string, on: boolean) => {
    if (!data) return;
    setPending(kind);
    writeCached(KEY, { ...data, [kind]: { ...data[kind], on } });
    try {
      writeCached(KEY, await apiGetCalendarFeeds(getSupabase(), { set: { calendar: kind, on } }));
      toast.success(on ? `${app} is on.` : `${app} is off. Your tables leave it on its next sync.`);
    } catch (e) {
      writeCached(KEY, data);
      toast.error(errMsg(e, "Couldn't change it."));
    } finally {
      setPending(null);
    }
  };

  const reset = async () => {
    setBusy(true);
    try {
      writeCached(KEY, await apiGetCalendarFeeds(getSupabase(), { reset: true }));
      setAdded({});
      setConfirm(false);
      toast.success("New links made. Add your calendars again.");
    } catch (e) {
      toast.error(errMsg(e, "Couldn't make new links."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <MeScreen title="Calendar">
      <div className="flex flex-col gap-6">
        {/* Google, Apple and Outlook only (MESITA-3964, Pato: "No other
            calendar must be enabled"): no copy-the-link row for other apps. */}
        <SettingsGroup title="Your calendars">
          {CALENDARS.map(({ kind, label, app }, i) => (
            <div key={kind}>
              {i > 0 && <RowDivider />}
              <CalendarRow
                kind={kind}
                label={label}
                app={app}
                feed={data?.[kind] ?? null}
                pending={pending === kind}
                added={!!added[kind]}
                onAdd={() => setAdded((a) => ({ ...a, [kind]: true }))}
                onSwitch={(on) => flip(kind, app, on)}
              />
            </div>
          ))}
        </SettingsGroup>
        <SettingsGroup title="Links">
          <SettingsActionRow
            Icon={RefreshCw}
            label="Make new links"
            sub="The old ones stop working"
            disabled={!data}
            onClick={() => setConfirm(true)}
          />
        </SettingsGroup>
        {feeds.error && (
          <button type="button" onClick={reload} className="text-muted-foreground type-label underline">
            Couldn&apos;t load your calendars. Try again
          </button>
        )}
      </div>
      <LocalDialog open={confirm} onClose={() => setConfirm(false)} ariaLabel="Make new links">
        <div className={SHEET_BODY_CLASS}>
          <h2 className={SHEET_TITLE_CLASS}>Make new links?</h2>
          <p className="text-muted-foreground type-body mt-2 leading-snug">
            Every calendar using the old links stops updating. Add your calendars again after.
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
              {busy ? "Making…" : "Make new links"}
            </button>
          </div>
        </div>
      </LocalDialog>
    </MeScreen>
  );
}
