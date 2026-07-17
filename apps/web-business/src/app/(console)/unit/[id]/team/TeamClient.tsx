"use client";

import { useCallback, useState } from "react";

import {
  apiInviteEditor,
  apiInviteStaff,
  apiListTeam,
  apiRemoveMember,
  apiTestStaffChannel,
  apiUpdateMemberRole,
  type BusinessRole,
  type RemoveKind,
  type TeamSnapshot,
} from "@/lib/api/team";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { ERROR_BOX_CLASS, INFO_BOX_CLASS } from "@/lib/ui-classes";
import { errMsg } from "@/lib/utils";

import { ConfirmDialog, type ConfirmState } from "./ConfirmDialog";
import { ManagersTeamSection } from "./ManagersTeamSection";
import { StaffTeamSection } from "./StaffTeamSection";
import { ROLE_LABEL, type InviteOpen } from "./team-constants";

function staffInvitePhoneKey(phone: string | null | undefined): string {
  if (!phone) return "";
  return phone.replace(/\D/g, "");
}

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
  const [notice, setNotice] = useState<string | null>(null);

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

  const isOwner =
    snapshot.myRole === "owner" || snapshot.myRole === "super_admin";
  const managers = snapshot.businesses.filter((m) => m.role !== "viewer");
  const pendingManagerInvites = snapshot.pendingBusinessInvites.filter(
    (inv) => inv.role !== "viewer",
  );
  const pendingStaffInvites = snapshot.pendingStaffInvites ?? [];

  // Wrap any mutating action in the shared busy/error/refresh frame.
  async function runAction(
    key: string,
    fn: () => Promise<unknown>,
    failureMessage: string,
  ) {
    setBusy(key);
    setError(null);
    setNotice(null);
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

  const applyStaffInviteResult = (
    res: Awaited<ReturnType<typeof apiInviteStaff>>,
    channel: "whatsapp" | "sms",
  ) => {
    const phoneKey = staffInvitePhoneKey(res.phone);
    setSnapshot((prev) => ({
      ...prev,
      pendingStaffInvites: [
        {
          id: res.inviteId,
          phone: res.phone,
          channel: res.channel,
          token: res.token,
          createdAt: new Date().toISOString(),
          expiresAt: res.expiresAt,
        },
        ...(prev.pendingStaffInvites ?? []).filter(
          (p) =>
            p.id !== res.inviteId && staffInvitePhoneKey(p.phone) !== phoneKey,
        ),
      ],
    }));
    if (res.sent) {
      setNotice(
        res.resent
          ? `Invitación reenviada por WhatsApp a ${res.phone}.`
          : `Invitación enviada por WhatsApp a ${res.phone}. Queda pendiente hasta que respondan sí.`,
      );
    } else {
      setNotice(
        res.sendError
          ? res.resent
            ? `No se pudo reenviar por WhatsApp: ${res.sendError}`
            : `Invitación pendiente — no se envió por WhatsApp: ${res.sendError}`
          : channel === "whatsapp"
            ? "Invitación pendiente — agrega el teléfono y usa Reenviar en la fila."
            : "Invitación pendiente — usa WhatsApp; el mesero acepta respondiendo sí en Mesita Ops.",
      );
    }
  };

  const handleInviteStaff = (channel: "whatsapp" | "sms", phone: string) =>
    runAction(
      "invite-staff",
      async () => {
        const res = await apiInviteStaff(supabase, {
          projectId,
          channel,
          phone: phone || undefined,
        });
        applyStaffInviteResult(res, channel);
        setInviteOpen(null);
      },
      "Couldn't create that staff invite.",
    );

  const handleResendStaffInvite = (
    channel: "whatsapp" | "sms",
    phone: string,
  ) =>
    runAction(
      `resend-staff-${phone}`,
      async () => {
        const res = await apiInviteStaff(supabase, {
          projectId,
          channel,
          phone,
        });
        applyStaffInviteResult(res, channel);
      },
      "Couldn't resend that staff invite.",
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

  const handleTestPing = (channel: "whatsapp" | "sms", phone: string) => {
    const label = channel === "whatsapp" ? "WhatsApp" : "SMS";
    setConfirmState({
      title: "Send test message",
      body: `Send a test ${label} message to ${phone}?`,
      confirmLabel: "Send",
      tone: "default",
      onConfirm: () =>
        runAction(
          `ping-${phone}`,
          async () => {
            const res = await apiTestStaffChannel(supabase, {
              projectId,
              channel,
              phone,
            });
            setNotice(
              res.mock
                ? `Test ping queued — ${res.note}`
                : `Test ${res.channel} sent to ${res.to}.`,
            );
          },
          "Couldn't send a test ping.",
        ),
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {error && <div className={ERROR_BOX_CLASS}>{error}</div>}
      {notice && <div className={INFO_BOX_CLASS}>{notice}</div>}

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

      <StaffTeamSection
        projectId={projectId}
        staffs={snapshot.staffs}
        pendingStaffInvites={pendingStaffInvites}
        isOwner={isOwner}
        busy={busy}
        inviteOpen={inviteOpen === "staff"}
        onToggleInvite={() =>
          setInviteOpen(inviteOpen === "staff" ? null : "staff")
        }
        onInviteStaff={handleInviteStaff}
        onPing={handleTestPing}
        onResendStaffInvite={handleResendStaffInvite}
        onRemove={handleRemove}
      />
    </div>
  );
}
