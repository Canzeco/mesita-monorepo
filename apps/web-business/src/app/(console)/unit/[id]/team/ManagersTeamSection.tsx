import { Crown, Mail, Users } from "lucide-react";

import type { BusinessRole, RemoveKind, TeamSnapshot } from "@/lib/api/team";
import { formatRelative, initialLetter } from "@/lib/utils";

import { EditorInviteForm } from "./EditorInviteForm";
import { TeamMemberRow } from "./TeamMemberRow";
import {
  Avatar,
  CopyButton,
  InviteButton,
  PendingRow,
  RemoveButton,
  RoleSelect,
  TeamEmpty,
  TeamList,
  TeamModule,
} from "./TeamUi";
import {
  INVITE_ROLE_CHOICES,
  ROLE_CHOICES,
  ROLE_LABEL,
} from "./team-constants";

export function ManagersTeamSection({
  members,
  pendingInvites,
  isOwner,
  currentUserId,
  busy,
  inviteOpen,
  onToggleInvite,
  onInviteMember,
  onChangeRole,
  onRemoveMember,
  onRemove,
}: {
  members: TeamSnapshot["members"];
  pendingInvites: TeamSnapshot["pendingBusinessInvites"];
  isOwner: boolean;
  currentUserId: string;
  busy: string | null;
  inviteOpen: boolean;
  onToggleInvite: () => void;
  onInviteMember: (email: string, role: BusinessRole) => void | Promise<void>;
  onChangeRole: (
    memberId: string,
    role: BusinessRole,
    currentRole: BusinessRole,
    name: string,
  ) => void;
  onRemoveMember: (memberId: string, name: string, isSelf: boolean) => void;
  onRemove: (id: string, kind: RemoveKind, confirmText: string) => void;
}) {
  return (
    <TeamModule
      icon={<Users className="h-4 w-4" />}
      title="Members"
      active={members.length}
      pending={pendingInvites.length}
      action={
        isOwner ? (
          <InviteButton
            label="Invite"
            open={inviteOpen}
            onClick={onToggleInvite}
          />
        ) : null
      }
    >
      {inviteOpen && (
        <EditorInviteForm
          busy={busy === "invite-member"}
          onSubmit={onInviteMember}
          roleChoices={INVITE_ROLE_CHOICES}
          defaultRole="editor"
          submitLabel="Send invite"
        />
      )}

      {members.length === 0 && pendingInvites.length === 0 ? (
        <TeamEmpty message="No members yet" />
      ) : (
        <TeamList>
          {members.map((m) => (
            <TeamMemberRow key={m.memberId}>
              <Avatar
                initial={initialOf(m.fullName, m.email)}
                tint="bg-pink-gradient"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-[13px] font-semibold">
                    {m.fullName ?? m.email ?? "—"}
                  </p>
                  {m.role === "owner" && (
                    <Crown className="text-tier-gold h-3 w-3" />
                  )}
                </div>
                <p className="text-muted-foreground truncate text-[11px]">
                  {m.email ?? "—"}
                </p>
              </div>
              <RoleSelect
                role={m.role}
                choices={ROLE_CHOICES}
                disabled={
                  !isOwner ||
                  busy === `role-${m.memberId}` ||
                  m.userId === currentUserId
                }
                onChange={(r) =>
                  onChangeRole(
                    m.memberId,
                    r,
                    m.role,
                    m.fullName ?? m.email ?? "this member",
                  )
                }
              />
              <RemoveButton
                busy={busy === `remove-${m.memberId}`}
                hidden={!isOwner && m.userId !== currentUserId}
                label={
                  m.userId === currentUserId
                    ? "Leave place"
                    : `Remove ${m.fullName ?? m.email}`
                }
                onClick={() =>
                  onRemoveMember(
                    m.memberId,
                    m.fullName ?? m.email ?? "this member",
                    m.userId === currentUserId,
                  )
                }
              />
            </TeamMemberRow>
          ))}
          {pendingInvites.map((inv) => (
            <PendingRow
              key={inv.id}
              icon={<Mail className="text-muted-foreground h-3.5 w-3.5" />}
              title={inv.email}
              subtitle={`${ROLE_LABEL[inv.role]} · ${formatRelative(inv.expiresAt)}`}
            >
              <CopyButton
                text={buildAcceptUrl(inv.token)}
                label="Copy invite link"
              />
              {isOwner && (
                <RemoveButton
                  busy={busy === `remove-${inv.id}`}
                  label="Revoke invite"
                  onClick={() =>
                    onRemove(inv.id, "editorInvite", "Revoke this invite?")
                  }
                />
              )}
            </PendingRow>
          ))}
        </TeamList>
      )}
    </TeamModule>
  );
}

function initialOf(name: string | null, email: string | null): string {
  return initialLetter(name ?? email ?? "?", "");
}

function buildAcceptUrl(token: string): string {
  if (typeof window === "undefined") return "";
  const url = new URL("/accept-invite", window.location.origin);
  url.searchParams.set("token", token);
  return url.toString();
}
