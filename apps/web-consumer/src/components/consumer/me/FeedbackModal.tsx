"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MeScreen } from "@/components/consumer/me/MeScreen";
import { MeLead } from "@/components/consumer/me/settings-rows";
import { EFError } from "@/lib/api/_invoke";
import { APP_FEEDBACK_NOTE_MAX, apiSendFeedback } from "@/lib/api/feedback";
import { goBack } from "@/lib/navigate";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import { PRIMARY_BUTTON_CLASS } from "@/lib/ui-classes";
import { cn, errMsg } from "@/lib/utils";

// SEND FEEDBACK (MESITA-3029): words about the app itself, not a place. One
// box and Send; it is stored (consumer-web-send-feedback) and lands on admin's
// Activity › Feedback beside the place reports. A place's problems go through
// its three dots (ReportSheet). A refused send (4xx) says why here and keeps
// the words; network, session and server failures are said once, by the
// app's error notifier (MESITA-3021).
//
// THE FRAME IS FeedbackFrame, AND THE FALLBACK WEARS IT (MESITA-2701).

const LEAD = "Something you like, something broken, something missing. We read every one.";

export function FeedbackFrame({ children }: { children: ReactNode }) {
  return (
    <MeScreen title="Send feedback">
      <MeLead>{LEAD}</MeLead>
      {children}
    </MeScreen>
  );
}

export function FeedbackModal() {
  const router = useRouter();
  const getSupabase = useLazyBrowserSupabase();
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const ready = note.trim() !== "";

  async function send() {
    if (!ready || sending) return;
    setSending(true);
    try {
      await apiSendFeedback(getSupabase(), note);
      toast.success("Thanks for your feedback");
      // Sent: slide away to Settings, where it was opened (MESITA-3644).
      goBack(router);
    } catch (err) {
      const status = err instanceof EFError ? err.status : null;
      if (status === 429) {
        toast.error("You've sent a lot of feedback. Try again later.");
      } else if (status != null && status >= 400 && status < 500 && status !== 401) {
        toast.error(errMsg(err, "Couldn't send your feedback. Try again."));
      }
      setSending(false);
    }
  }

  return (
    <FeedbackFrame>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={APP_FEEDBACK_NOTE_MAX}
        placeholder="Tell us about the app"
        aria-label="Your feedback"
        className="border-border bg-card focus:border-foreground/40 h-[144px] w-full resize-none rounded-2xl border px-4 py-3 text-sm outline-none"
      />
      <button
        type="button"
        onClick={() => void send()}
        disabled={!ready || sending}
        className={cn(PRIMARY_BUTTON_CLASS, "mt-5")}
      >
        {sending ? "Sending…" : "Send"}
      </button>
    </FeedbackFrame>
  );
}
