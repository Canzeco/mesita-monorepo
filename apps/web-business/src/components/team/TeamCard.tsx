"use client";

// Team (MESITA-3120; Settings' one box for it since
// MESITA-3157, Pato: "who runs this place is in settings… with a more
// friendly UI. One place can only have one owner, and multiple editors").
// One owner and its editors, per place (no organization layer). Everyone on
// the team sees it; the owner (and Mesita staff) invite editors by Google
// email, remove them, cancel invites and hand the place to an editor. Staff
// alone can revoke the owner (business-web-decide-verification), the door
// Admin's owner list had. The server enforces every rule; this only draws.

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/shell/Page";
import { INPUT_BASE } from "@/components/ui/manage";
import { decideVerification, getTeam, inviteEditor, removeMember, transferOwner, type Team, type TeamMember } from "@/lib/business-api";

const ERRORS: Record<string, string> = {
  already_invited: "That email is already invited.",
  bad_email: "Enter a valid email.",
  self: "You are already on this place's team.",
  owner_only: "Only the owner can manage the team.",
  cannot_remove_owner: "Make an editor the owner first.",
  not_an_editor: "Only a current editor can become the owner.",
};

const ROW = "flex min-h-14 items-center gap-3 px-5 py-3 text-sm sm:px-6";
const QUIET = "border-border hover:bg-muted h-9 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors disabled:opacity-50";

function day(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const ROLE: Record<TeamMember["role"], string> = { owner: "Owner", editor: "Editor" };

function Person({ m, children }: { m: TeamMember; children?: React.ReactNode }) {
  const label = m.name ?? m.email ?? "Unnamed";
  return (
    <li className={ROW}>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{label}</p>
        <p className="text-muted-foreground truncate">
          {[ROLE[m.role], m.me ? "you" : null, m.email && m.email !== label ? m.email : null, m.live ? null : "verification ended"]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      {children}
    </li>
  );
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

  /** Two taps for anything that takes access away or hands the place over. */
  const twoTap = (key: string, fn: () => Promise<{ ok: boolean; error?: string; code?: string | null }>) =>
    confirm === key ? void run(key, fn) : setConfirm(key);

  const manage = team?.role === "owner" || team?.role === "superadmin";
  const staff = team?.role === "superadmin";
  const owner = team?.members.find((m) => m.role === "owner") ?? null;
  const editors = team?.members.filter((m) => m.role === "editor") ?? [];

  return (
    <Card className="flex flex-col p-0 sm:p-0">
      <h2 className="px-5 pt-4 pb-2 font-semibold sm:px-6">Team</h2>
      <ul className="divide-border divide-y">
        {team === null && !error ? <li className={`${ROW} text-muted-foreground`}>Loading…</li> : null}
        {team && !owner ? <li className={`${ROW} text-muted-foreground`}>Nobody owns this place on Mesita yet.</li> : null}
        {owner ? (
          <Person m={owner}>
            {staff ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => twoTap(`revoke:${owner.id}`, () => decideVerification({ managerId: owner.id, decision: "revoke" }))}
                className={QUIET}
              >
                {confirm === `revoke:${owner.id}` ? "Tap to confirm" : "Revoke"}
              </button>
            ) : null}
          </Person>
        ) : null}
        {editors.map((m) => (
          <Person key={m.id} m={m}>
            {manage ? (
              <>
                <button
                  type="button"
                  disabled={busy !== null || !m.live}
                  onClick={() => twoTap(`own:${m.id}`, () => transferOwner(placeId, m.id))}
                  className={QUIET}
                >
                  {confirm === `own:${m.id}` ? "Tap to confirm" : "Make owner"}
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${m.name ?? m.email ?? "editor"}`}
                  disabled={busy !== null}
                  onClick={() => twoTap(`rm:${m.id}`, () => removeMember(placeId, { managerId: m.id }))}
                  className={QUIET}
                >
                  {confirm === `rm:${m.id}` ? "Tap to confirm" : "Remove"}
                </button>
              </>
            ) : null}
          </Person>
        ))}
        {team?.invites.map((i) => (
          <li key={i.id} className={ROW}>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{i.email}</p>
              <p className="text-muted-foreground truncate">Invited {day(i.created_at)} · joins when they sign in with Google</p>
            </div>
            {manage ? (
              <button
                type="button"
                aria-label={`Cancel the invite for ${i.email}`}
                disabled={busy !== null}
                onClick={() => run(`inv:${i.id}`, () => removeMember(placeId, { inviteId: i.id }))}
                className={QUIET}
              >
                Cancel
              </button>
            ) : null}
          </li>
        ))}
        {team && !manage && editors.length === 0 && team.invites.length === 0 ? (
          <li className={`${ROW} text-muted-foreground`}>No editors yet.</li>
        ) : null}
        {manage ? (
          <li className="flex flex-col gap-2 px-5 py-3 text-sm sm:px-6">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!email.trim()) return;
                if (await run("invite", () => inviteEditor(placeId, email.trim()))) setEmail("");
              }}
              className="flex items-center gap-3"
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Editor's Google email"
                aria-label="Editor's Google email"
                className={`${INPUT_BASE} bg-card h-9 rounded-full px-4`}
              />
              <button type="submit" disabled={busy !== null || !email.trim()} className={QUIET}>
                {busy === "invite" ? "Inviting…" : "Invite"}
              </button>
            </form>
            <p className="text-muted-foreground">Editors change the profile. The owner also runs Premier and the team.</p>
          </li>
        ) : null}
        {error ? <li className={`${ROW} text-destructive`}>{error}</li> : null}
      </ul>
    </Card>
  );
}
