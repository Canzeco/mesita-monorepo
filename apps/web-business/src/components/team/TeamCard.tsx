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
import { Crown, UserPlus, X } from "lucide-react";
import { Card } from "@/components/shell/Page";
import { INPUT_BASE } from "@/components/ui/manage";
import { decideVerification, getTeam, inviteEditor, removeMember, transferOwner, type Team, type TeamMember } from "@/lib/business-api";
import { cn } from "@/lib/utils";

const ERRORS: Record<string, string> = {
  already_invited: "That email is already invited.",
  bad_email: "Enter a valid email.",
  self: "You are already on this place's team.",
  owner_only: "Only the owner can manage the team.",
  cannot_remove_owner: "Make an editor the owner first.",
  not_an_editor: "Only a current editor can become the owner.",
};

const QUIET = "border-border hover:bg-muted h-8 shrink-0 rounded-full border px-3 text-xs font-semibold transition-colors disabled:opacity-50";

function day(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** A round initial, so each person reads at a glance. */
function Avatar({ label, owner = false }: { label: string; owner?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold uppercase",
        owner ? "bg-foreground text-background" : "bg-muted text-foreground",
      )}
    >
      {label.trim().charAt(0) || "?"}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-muted-foreground text-xs font-semibold">{title}</p>
      {children}
    </div>
  );
}

function Person({ m, children }: { m: TeamMember; children?: React.ReactNode }) {
  const label = m.name ?? m.email ?? "Unnamed";
  return (
    <li className="flex items-center gap-3 py-2.5">
      <Avatar label={label} owner={m.role === "owner"} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-medium">
          {label}
          {m.me ? <span className="text-muted-foreground font-normal">· you</span> : null}
          {m.role === "owner" ? <Crown className="text-muted-foreground size-3.5" aria-label="Owner" /> : null}
        </p>
        <p className="text-muted-foreground truncate text-xs">
          {m.email && m.email !== label ? `${m.email} · ` : ""}
          {m.live ? `until ${day(m.expires_at)}` : "verification ended"}
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
    <Card className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight">Team</h2>
        <p className="text-muted-foreground text-sm">
          One owner and any number of editors. Editors change the profile; the owner also runs Premier and the team.
        </p>
      </div>

      {team === null && !error ? <p className="text-muted-foreground text-sm">Loading…</p> : null}

      {team ? (
        <>
          <Section title="Owner">
            {owner ? (
              <ul>
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
              </ul>
            ) : (
              <p className="text-muted-foreground py-2.5 text-sm">Nobody owns this place on Mesita yet.</p>
            )}
          </Section>

          <Section title="Editors">
            {editors.length === 0 && team.invites.length === 0 ? (
              <p className="text-muted-foreground py-2.5 text-sm">
                No editors yet.{manage ? " Invite someone by their Google email below." : ""}
              </p>
            ) : (
              <ul className="divide-border divide-y">
                {editors.map((m) => (
                  <Person key={m.id} m={m}>
                    {manage ? (
                      <div className="flex shrink-0 items-center gap-1">
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
                          className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-8 items-center gap-1 rounded-full px-2 text-xs disabled:opacity-50"
                        >
                          {confirm === `rm:${m.id}` ? "Remove?" : <X className="size-4" aria-hidden />}
                        </button>
                      </div>
                    ) : null}
                  </Person>
                ))}
                {team.invites.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 py-2.5">
                    <span aria-hidden className="border-border text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-full border border-dashed">
                      <UserPlus className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{i.email}</p>
                      <p className="text-muted-foreground text-xs">Invited {day(i.created_at)} · joins when they sign in with Google</p>
                    </div>
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
            )}
          </Section>
        </>
      ) : null}

      {manage ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!email.trim()) return;
            if (await run("invite", () => inviteEditor(placeId, email.trim()))) setEmail("");
          }}
          className="bg-muted/50 flex flex-col gap-2 rounded-2xl p-3 sm:flex-row"
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Editor's Google email"
            aria-label="Editor's Google email"
            className={`${INPUT_BASE} bg-card h-10 px-3`}
          />
          <button
            type="submit"
            disabled={busy !== null || !email.trim()}
            className="bg-foreground text-background inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold disabled:opacity-60"
          >
            <UserPlus className="size-4" aria-hidden /> {busy === "invite" ? "Inviting…" : "Invite editor"}
          </button>
        </form>
      ) : null}

      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </Card>
  );
}
