import { MessageCircle, Phone as PhoneIcon } from "lucide-react";

import type { RemoveKind, TeamSnapshot } from "@/lib/api/team";
import { formatRelative } from "@/lib/utils";

import { StaffInviteForm, type StaffChannel } from "./StaffInviteForm";
import { TeamMemberRow } from "./TeamMemberRow";
import {
  Avatar,
  InviteButton,
  PendingRow,
  PingButton,
  RemoveButton,
  TeamEmpty,
  TeamList,
  TeamModule,
} from "./TeamUi";

export function StaffTeamSection({
  projectId,
  staffs,
  pendingStaffInvites,
  isOwner,
  busy,
  inviteOpen,
  onToggleInvite,
  onInviteStaff,
  onPing,
  onResendStaffInvite,
  onRemove,
}: {
  projectId: string;
  staffs: TeamSnapshot["staffs"];
  pendingStaffInvites: TeamSnapshot["pendingStaffInvites"];
  isOwner: boolean;
  busy: string | null;
  inviteOpen: boolean;
  onToggleInvite: () => void;
  onInviteStaff: (channel: StaffChannel, phone: string) => void | Promise<void>;
  onPing: (channel: StaffChannel, phone: string) => void | Promise<void>;
  onResendStaffInvite: (
    channel: StaffChannel,
    phone: string,
  ) => void | Promise<void>;
  onRemove: (id: string, kind: RemoveKind, confirmText: string) => void;
}) {
  const activeStaffCount = staffs.length;

  return (
    <TeamModule
      icon={<PhoneIcon className="h-4 w-4" />}
      title="Staffs"
      active={activeStaffCount}
      pending={pendingStaffInvites.length}
      action={
        <InviteButton label="Add" open={inviteOpen} onClick={onToggleInvite} />
      }
    >
      {inviteOpen && (
        <StaffInviteForm
          busy={busy === "invite-staff"}
          onSubmit={onInviteStaff}
          onPing={onPing}
        />
      )}

      {activeStaffCount === 0 && pendingStaffInvites.length === 0 ? (
        <TeamEmpty message="No staffs yet" />
      ) : (
        <TeamList>
          {staffs.map((w) => {
            const staffKey = `${w.userId}:${projectId}`;
            return (
              <TeamMemberRow key={staffKey}>
                <Avatar
                  initial={(w.phone ?? "?").slice(-2)}
                  tint="bg-whatsapp/15 text-whatsapp-deep"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-[13px] font-semibold">
                    {w.phone ?? "—"}
                  </p>
                  <p className="text-muted-foreground text-[11px]">
                    Joined {formatRelative(w.createdAt)}
                  </p>
                </div>
                {w.phone && (
                  <PingButton
                    busy={busy === `ping-${w.phone}`}
                    onClick={() => onPing("whatsapp", w.phone!)}
                  />
                )}
                {isOwner && (
                  <RemoveButton
                    busy={busy === `remove-${w.userId}`}
                    label="Remove staff"
                    onClick={() =>
                      onRemove(staffKey, "staff", "Remove this staff?")
                    }
                  />
                )}
              </TeamMemberRow>
            );
          })}
          {pendingStaffInvites.map((inv) => (
            <PendingRow
              key={inv.id}
              icon={
                inv.channel === "whatsapp" ? (
                  <MessageCircle className="text-whatsapp-deep h-3.5 w-3.5" />
                ) : (
                  <PhoneIcon className="text-muted-foreground h-3.5 w-3.5" />
                )
              }
              title={inv.phone ?? "—"}
              subtitle={`Pending · ${formatRelative(inv.expiresAt)}`}
            >
              {inv.phone && (
                <PingButton
                  busy={busy === `resend-staff-${inv.phone}`}
                  onClick={() => onResendStaffInvite(inv.channel, inv.phone!)}
                  label="Resend invite"
                />
              )}
              {isOwner && (
                <RemoveButton
                  busy={busy === `remove-${inv.id}`}
                  label="Revoke invite"
                  onClick={() =>
                    onRemove(inv.id, "staffInvite", "Revoke this staff invite?")
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
