"use client";

// "I run this place" requests, for Mesita staff (MESITA-3103), reports from
// the claim window included (MESITA-3155). Approve writes the owner row and
// closes the request in one call; Reject keeps a note the guest sees. The
// owner and editors (and Revoke) live in Settings' Who runs this place
// (MESITA-3157).

import { useRouter } from "next/navigation";
import { useState } from "react";
import { decideVerification, type PendingRequest } from "@/lib/business-api";
import { INPUT_BASE } from "@/components/ui/manage";

function day(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function Who({ name, phone, handle, member }: { name: string | null; phone: string | null; handle: string | null; member: string | null }) {
  return (
    <span className="text-muted-foreground text-sm">
      {[name, phone, handle ? `@${handle}` : null, member ? `Member ${member}` : null].filter(Boolean).join(" · ") || "Unknown guest"}
    </span>
  );
}

// One place's claim requests, on its Admin page (MESITA-3143:
// Admin is only a place's; there is no cross-place queue).
export function VerificationQueue({ pending }: { pending: PendingRequest[] }) {
  const router = useRouter();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(key: string, run: () => ReturnType<typeof decideVerification>) {
    setBusy(key);
    setError(null);
    const r = await run();
    setBusy(null);
    if (!r.ok) return setError(r.error);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        {pending.length === 0 ? <p className="text-muted-foreground text-sm">No requests waiting.</p> : null}
        {pending.map((r) => (
          <div key={r.id} className="border-border flex flex-col gap-3 rounded-xl border px-4 py-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="font-medium">
                {r.name}, {r.role} · asked {day(r.created_at)}
              </span>
              <Who name={null} phone={r.phone} handle={r.instagram_handle} member={r.member_number} />
              {r.contact ? (
                <a
                  href={`https://wa.me/${r.contact.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-fit text-sm font-semibold underline underline-offset-4"
                >
                  WhatsApp {r.contact}
                </a>
              ) : null}
              {r.note ? <p className="text-sm">&ldquo;{r.note}&rdquo;</p> : null}
            </div>
            <input
              value={notes[r.id] ?? ""}
              onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
              maxLength={500}
              placeholder="Note to the guest (shown if you reject)"
              className={`${INPUT_BASE} h-9 px-3`}
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void act(r.id, () => decideVerification({ requestId: r.id, decision: "approve", note: notes[r.id] }))}
                className="bg-foreground text-background h-9 rounded-full px-4 text-sm font-semibold disabled:opacity-60"
              >
                Approve
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void act(r.id, () => decideVerification({ requestId: r.id, decision: "reject", note: notes[r.id] }))}
                className="border-border hover:bg-muted h-9 rounded-full border px-4 text-sm font-semibold disabled:opacity-60"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}
