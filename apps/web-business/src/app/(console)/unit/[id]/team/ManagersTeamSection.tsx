import { Crown, Mail } from "lucide-react";

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
  MANAGER_ROLE_CHOICES,
  ROLE_CHOICES,
  ROLE_LABEL,
} from "./team-constants";

export function ManagersTeamSection({
  managers,
  pendingManagerInvites,
  isOwner,
  currentUserId,
  busy,
  inviteOpen,
  onToggleInvite,
  onInviteManager,
  onChangeRole,
  onRemoveEditor,
  onRemove,
}: {
  managers: TeamSnapshot["businesses"];
  pendingManagerInvites: TeamSnapshot["pendingBusinessInvites"];
  isOwner: boolean;
  currentUserId: string;
  busy: string | null;
  inviteOpen: boolean;
  onToggleInvite: () => void;
  onInviteManager: (email: string, role: BusinessRole) => void | Promise<void>;
  onChangeRole: (
    memberId: string,
    role: BusinessRole,
    currentRole: BusinessRole,
    name: string,
  ) => void;
  onRemoveEditor: (memberId: string, name: string, isSelf: boolean) => void;
  onRemove: (id: string, kind: RemoveKind, confirmText: string) => void;
}) {
  return (
    <TeamModule
      icon={<Crown className="h-4 w-4" />}
      title="Managers"
      active={managers.length}
      pending={pendingManagerInvites.length}
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
          busy={busy === "invite-manager"}
          onSubmit={onInviteManager}
          roleChoices={MANAGER_ROLE_CHOICES}
          defaultRole="editor"
          submitLabel="Send invite"
        />
      )}

      {managers.length === 0 && pendingManagerInvites.length === 0 ? (
        <TeamEmpty message="No managers yet" />
      ) : (
        <TeamList>
          {managers.map((m) => (
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
                role={(m.role as BusinessRole) ?? "editor"}
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
                    (m.role as BusinessRole) ?? "editor",
                    m.fullName ?? m.email ?? "this editor",
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
                  onRemoveEditor(
                    m.memberId,
                    m.fullName ?? m.email ?? "this editor",
                    m.userId === currentUserId,
                  )
                }
              />
            </TeamMemberRow>
          ))}
          {pendingManagerInvites.map((inv) => (
            <PendingRow
              key={inv.id}
              icon={<Mail className="text-muted-foreground h-3.5 w-3.5" />}
              title={inv.email}
              subtitle={`${teamRoleLabel((inv.role as BusinessRole) ?? "editor")} · ${formatRelative(inv.expiresAt)}`}
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

function teamRoleLabel(role: BusinessRole): string {
  if (role === "viewer") return "PR";
  if (role === "editor") return "Manager";
  return ROLE_LABEL[role];
}
