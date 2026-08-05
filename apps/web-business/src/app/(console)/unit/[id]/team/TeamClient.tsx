"use client";

import { useCallback, useState } from "react";

import {
  apiInviteEditor,
  apiListTeam,
  apiRemoveMember,
  apiUpdateMemberRole,
  type BusinessRole,
  type RemoveKind,
  type TeamSnapshot,
} from "@/lib/api/team";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import { errMsg } from "@/lib/utils";

import { ConfirmDialog, type ConfirmState } from "./ConfirmDialog";
import { ManagersTeamSection } from "./ManagersTeamSection";
import { ROLE_LABEL, type InviteOpen } from "./team-constants";

// The Team page is the BUSINESS team — owners, managers, PRs. Waiters were
// retired (MESITA-833): staff work tickets on the public check page, where
// possession of the check_code is the authentication, so there is no staff
// account to invite, ping or revoke.

export function TeamClient({
  projectId,
  currentUserId,
  initialSnapshot,
}: {
  projectId: string;
  currentUserId: string;
  initialSnapshot: TeamSnapshot;
}) {
  const supabase = useBrowserSupabase();
  // Seeded from the server fetch in page.tsx — no client-side initial
  // load, no second loading indicator. refresh() still runs after every
  // mutating handler to keep the list in sync.
  const [snapshot, setSnapshot] = useState<TeamSnapshot>(initialSnapshot);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState<InviteOpen>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await apiListTeam(supabase, projectId);
      setSnapshot(next);
      setError(null);
      return next;
    } catch (err) {
      setError(errMsg(err, "Couldn't load the team."));
      return null;
    }
  }, [supabase, projectId]);

  const isOwner = snapshot.myRole === "owner";
  const managers = snapshot.businesses.filter((m) => m.role !== "viewer");
  const pendingManagerInvites = snapshot.pendingBusinessInvites.filter(
    (inv) => inv.role !== "viewer",
  );

  // Wrap any mutating action in the shared busy/error/refresh frame.
  async function runAction(
    key: string,
    fn: () => Promise<unknown>,
    failureMessage: string,
  ) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setError(errMsg(err, failureMessage));
    } finally {
      setBusy(null);
    }
  }

  const handleInviteManager = (email: string, role: BusinessRole) =>
    runAction(
      "invite-manager",
      async () => {
        await apiInviteEditor(supabase, {
          projectId,
          email,
          role,
          redirectBase: window.location.origin,
        });
        setInviteOpen(null);
      },
      "Couldn't send that manager invite.",
    );

  const handleChangeRole = (
    memberId: string,
    role: BusinessRole,
    currentRole: BusinessRole,
    name: string,
  ) => {
    if (role === currentRole) return;
    setConfirmState({
      title: "Change role",
      body: `Change ${name}'s role from ${ROLE_LABEL[currentRole]} to ${ROLE_LABEL[role]}?`,
      confirmLabel: "Change role",
      tone: "default",
      onConfirm: () =>
        runAction(
          `role-${memberId}`,
          () => apiUpdateMemberRole(supabase, { memberId, role }),
          "Couldn't change that role.",
        ),
    });
  };

  const handleRemoveEditor = (
    memberId: string,
    name: string,
    isSelf: boolean,
  ) => {
    setConfirmState({
      title: isSelf ? "Leave place" : "Remove member",
      body: isSelf
        ? "Leave this place? You'll lose dashboard access."
        : `Remove ${name} from this place? They'll lose dashboard access.`,
      confirmLabel: isSelf ? "Leave" : "Remove",
      tone: "destructive",
      onConfirm: () =>
        runAction(
          `remove-${memberId}`,
          () => apiRemoveMember(supabase, { id: memberId, kind: "editor" }),
          "Couldn't remove that member.",
        ),
    });
  };

  const handleRemove = (id: string, kind: RemoveKind, confirmText: string) => {
    const isRevoke = /^revoke/i.test(confirmText);
    setConfirmState({
      title: isRevoke ? "Revoke invite" : "Remove",
      body: confirmText,
      confirmLabel: isRevoke ? "Revoke" : "Remove",
      tone: "destructive",
      onConfirm: () =>
        runAction(
          `remove-${id}`,
          () => apiRemoveMember(supabase, { id, kind }),
          "Couldn't remove that entry.",
        ),
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {error && <div className={ERROR_BOX_CLASS}>{error}</div>}

      {confirmState && (
        <ConfirmDialog
          {...confirmState}
          onCancel={() => setConfirmState(null)}
          onConfirm={() => {
            const run = confirmState.onConfirm;
            setConfirmState(null);
            run();
          }}
        />
      )}

      <ManagersTeamSection
        managers={managers}
        pendingManagerInvites={pendingManagerInvites}
        isOwner={isOwner}
        currentUserId={currentUserId}
        busy={busy}
        inviteOpen={inviteOpen === "manager"}
        onToggleInvite={() =>
          setInviteOpen(inviteOpen === "manager" ? null : "manager")
        }
        onInviteManager={handleInviteManager}
        onChangeRole={handleChangeRole}
        onRemoveEditor={handleRemoveEditor}
        onRemove={handleRemove}
      />
    </div>
  );
}
