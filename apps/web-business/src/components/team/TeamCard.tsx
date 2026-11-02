"use client";

// A place's team (MESITA-3120): one owner and its editors, per place (no
// organization layer). Everyone on the team sees it; the owner (and Mesita
// staff) invite editors by Google email, remove them, cancel invites and hand
// the place to an editor. The server enforces every rule; this only draws.

import { useCallback, useEffect, useState } from "react";
import { Crown, UserPlus, X } from "lucide-react";
import { Card } from "@/components/shell/Page";
import { INPUT_BASE } from "@/components/ui/manage";
import { getTeam, inviteEditor, removeMember, transferOwner, type Team } from "@/lib/business-api";

const ERRORS: Record<string, string> = {
  already_invited: "That email is already invited.",
  bad_email: "Enter a valid email.",
  self: "You are already on this place's team.",
  owner_only: "Only the owner can manage the team.",
  cannot_remove_owner: "Make an editor the owner first.",
  not_an_editor: "Only a current editor can become the owner.",
};

function day(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function TeamCard({ placeId }: { placeId: string }) {
  const [team, setTeam] = useState<Team | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await getTeam(placeId);
    if (r.ok) setTeam(r.data);
    else setError(r.error);
  }, [placeId]);

  useEffect(() => {
    let live = true;
    getTeam(placeId).then((r) => {
      if (!live) return;
      if (r.ok) setTeam(r.data);
      else setError(r.error);
    });
    return () => {
      live = false;
    };
  }, [placeId]);

  async function run(key: string, fn: () => Promise<{ ok: boolean; error?: string; code?: string | null }>) {
    setBusy(key);
    setError(null);
    const r = await fn();
    setBusy(null);
    setConfirm(null);
    if (!r.ok) {
      setError((r.code && ERRORS[r.code]) || r.error || "Something went wrong");
      return false;
    }
    await load();
    return true;
  }

  const manage = team?.role === "owner" || team?.role === "superadmin";

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <p className="font-semibold">Team</p>
        <p className="text-muted-foreground text-sm">
          One owner and any number of editors. Editors change the profile; the owner also runs Premier and the team.
        </p>
      </div>

      {team === null && !error ? <p className="text-muted-foreground text-sm">Loading…</p> : null}

      {team ? (
        <ul className="divide-border divide-y">
          {team.members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {m.name ?? m.email ?? "Unnamed"}
                  {m.me ? <span className="text-muted-foreground font-normal"> · you</span> : null}
                </p>
                <p className="text-muted-foreground truncate text-xs">
                  {m.email ? `${m.email} · ` : ""}
                  {m.live ? `until ${day(m.expires_at)}` : "verification ended"}
                </p>
              </div>
              <span
                className={
                  m.role === "owner"
                    ? "bg-foreground text-background inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
                    : "bg-muted text-muted-foreground shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold"
                }
              >
                {m.role === "owner" ? <Crown className="size-3" aria-hidden /> : null}
                {m.role === "owner" ? "Owner" : "Editor"}
              </span>
              {manage && m.role === "editor" ? (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    disabled={busy !== null || !m.live}
                    onClick={() =>
                      confirm === `own:${m.id}`
                        ? run(`own:${m.id}`, () => transferOwner(placeId, m.id))
                        : setConfirm(`own:${m.id}`)
                    }
                    className="border-border hover:bg-muted h-8 rounded-full border px-3 text-xs font-semibold disabled:opacity-50"
                  >
                    {confirm === `own:${m.id}` ? "Tap to confirm" : "Make owner"}
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${m.name ?? m.email ?? "editor"}`}
                    disabled={busy !== null}
                    onClick={() =>
                      confirm === `rm:${m.id}`
                        ? run(`rm:${m.id}`, () => removeMember(placeId, { managerId: m.id }))
                        : setConfirm(`rm:${m.id}`)
                    }
                    className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-8 items-center gap-1 rounded-full px-2 text-xs disabled:opacity-50"
                  >
                    {confirm === `rm:${m.id}` ? "Remove?" : <X className="size-4" aria-hidden />}
                  </button>
                </div>
              ) : null}
            </li>
          ))}
          {team.invites.map((i) => (
            <li key={i.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{i.email}</p>
                <p className="text-muted-foreground text-xs">Invited {day(i.created_at)} · joins when they sign in with Google</p>
              </div>
              <span className="border-border text-muted-foreground shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold">Invited</span>
              {manage ? (
                <button
                  type="button"
                  aria-label={`Cancel the invite for ${i.email}`}
                  disabled={busy !== null}
                  onClick={() => run(`inv:${i.id}`, () => removeMember(placeId, { inviteId: i.id }))}
                  className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-8 items-center justify-center rounded-full disabled:opacity-50"
                >
                  <X className="size-4" aria-hidden />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {manage ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!email.trim()) return;
            if (await run("invite", () => inviteEditor(placeId, email.trim()))) setEmail("");
          }}
          className="flex gap-2"
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Editor's Google email"
            aria-label="Editor's Google email"
            className={`${INPUT_BASE} h-10 px-3`}
          />
          <button
            type="submit"
            disabled={busy !== null || !email.trim()}
            className="bg-foreground text-background inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold disabled:opacity-60"
          >
            <UserPlus className="size-4" aria-hidden /> {busy === "invite" ? "Inviting…" : "Invite editor"}
          </button>
        </form>
      ) : null}

      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </Card>
  );
}
