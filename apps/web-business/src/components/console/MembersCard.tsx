"use client";

// Members — who is in the organization, read first. Rows are people, not
// facts, so this is deliberately NOT DataRow (which would mute the name and
// bold the role — backwards emphasis): name leads in font-medium, email
// beneath in muted 12px, and when the name is null — every production row
// today — the email PROMOTES to the primary line.
//
// The owner's "Add member" is a disclosure (collapsed by default, label
// names the action). An unknown email now sends an invite instead of a
// dead-end "ask them to sign in" message (MESITA-1550); Owner is an addable
// role (organizations allow several — no transfer ceremony to protect
// against, unlike places), gated behind its own confirm copy since it is
// the one grant with no in-product undo short of the person removing
// themselves.

import { useActionState, useState } from "react";
import { Section } from "@/components/shared/Section";
import { Field } from "@/components/shared/Field";
import {
  addOrgMemberAction,
  removeOrgMemberAction,
  updateOrgMemberRoleAction,
  type AddMemberState,
  type MemberRowActionState,
} from "@/app/(shell)/actions/organizations";
import type { OrgMember, OrgRole, PendingOrgInvite } from "@/lib/api/organizations";
import {
  ERROR_BOX_CLASS,
  FORM_COLUMN_CLASS,
  GHOST_PILL_BUTTON_CLASS,
  ICON_BUTTON_CLASS,
  INPUT_CLASS,
  PILL_BUTTON_CLASS,
  TINY_LABEL_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

const ADD_INITIAL: AddMemberState = { error: null, email: "", added: false, mode: null };
const ROW_INITIAL: MemberRowActionState = { error: null };

function RoleChip({ role }: { role: string }) {
  return (
    <span className="border-border bg-card rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize">
      {role}
    </span>
  );
}

const ROLE_OPTIONS: { value: OrgRole; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "editor", label: "Editor" },
  { value: "viewer", label: "Viewer" },
];

/** One member row. Owns its own remove / role-change confirm state — each
 *  row is a separate component instance, so useActionState stays isolated
 *  per row instead of one shared state fighting over which row is "active". */
function MemberRow({
  orgId,
  member,
  isMe,
  isOwner,
}: {
  orgId: string;
  member: OrgMember;
  isMe: boolean;
  isOwner: boolean;
}) {
  // Two-step confirm, inline — no modal/window.confirm precedent exists
  // anywhere in this app, so this reuses the disclosure idiom the card
  // already uses for "Add member" rather than inventing a dialog system.
  const [confirming, setConfirming] = useState<"remove" | "role" | null>(null);
  const [pendingRole, setPendingRole] = useState<OrgRole>(member.role);
  const [removeState, removeAction, removing] = useActionState(
    removeOrgMemberAction,
    ROW_INITIAL,
  );
  const [roleState, roleAction, updatingRole] = useActionState(
    updateOrgMemberRoleAction,
    ROW_INITIAL,
  );

  const primary = member.name ?? member.email ?? "—";
  const secondary = member.name ? member.email : null;

  return (
    <li className="flex flex-col gap-2 py-2.5 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{primary}</p>
          {secondary && (
            <p className="text-muted-foreground truncate text-[12px]">{secondary}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isMe && <span className="text-muted-foreground text-[11px]">You</span>}
          <RoleChip role={member.role} />
          {isOwner && confirming === null && (
            <>
              <button
                type="button"
                onClick={() => {
                  setPendingRole(member.role);
                  setConfirming("role");
                }}
                className={GHOST_PILL_BUTTON_CLASS}
              >
                Change role
              </button>
              <button
                type="button"
                onClick={() => setConfirming("remove")}
                aria-label={`Remove ${primary}`}
                title="Remove"
                className={ICON_BUTTON_CLASS}
              >
                ×
              </button>
            </>
          )}
        </div>
      </div>

      {isOwner && confirming === "role" && (
        <form
          action={roleAction}
          className="bg-muted flex flex-wrap items-center gap-2 rounded-xl p-2"
        >
          <input type="hidden" name="orgId" value={orgId} />
          <input type="hidden" name="memberId" value={member.managerId} />
          <select
            name="role"
            value={pendingRole}
            onChange={(e) => setPendingRole(e.target.value as OrgRole)}
            className={cn(INPUT_CLASS, "h-8 max-w-[9rem] py-0 text-xs")}
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <span className="text-muted-foreground text-[11px]">
            {pendingRole === "owner"
              ? `Make ${primary} an owner? They'll have full control of the organization.`
              : "Save this role change?"}
          </span>
          <button
            type="submit"
            disabled={updatingRole || pendingRole === member.role}
            className={cn(PILL_BUTTON_CLASS, "ml-auto")}
          >
            {updatingRole ? "Saving…" : "Confirm"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(null)}
            className={GHOST_PILL_BUTTON_CLASS}
          >
            Cancel
          </button>
        </form>
      )}
      {roleState.error && confirming === "role" && (
        <p className={ERROR_BOX_CLASS}>{roleState.error}</p>
      )}

      {isOwner && confirming === "remove" && (
        <form
          action={removeAction}
          className="bg-muted flex flex-wrap items-center gap-2 rounded-xl p-2"
        >
          <input type="hidden" name="orgId" value={orgId} />
          <input type="hidden" name="id" value={member.managerId} />
          <input type="hidden" name="kind" value="member" />
          <span className="text-muted-foreground text-[11px]">
            Remove {primary} from this organization?
          </span>
          <button
            type="submit"
            disabled={removing}
            className={cn(PILL_BUTTON_CLASS, "bg-destructive ml-auto")}
          >
            {removing ? "Removing…" : "Remove"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(null)}
            className={GHOST_PILL_BUTTON_CLASS}
          >
            Cancel
          </button>
        </form>
      )}
      {removeState.error && confirming === "remove" && (
        <p className={ERROR_BOX_CLASS}>{removeState.error}</p>
      )}
    </li>
  );
}

function PendingInviteRow({
  orgId,
  invite,
  isOwner,
}: {
  orgId: string;
  invite: PendingOrgInvite;
  isOwner: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(removeOrgMemberAction, ROW_INITIAL);

  return (
    <li className="flex flex-col gap-2 py-2.5 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{invite.email}</p>
          <p className="text-muted-foreground truncate text-[12px]">Invited, pending</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <RoleChip role={invite.role} />
          {isOwner && !confirming && (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              aria-label={`Revoke invite to ${invite.email}`}
              title="Revoke"
              className={ICON_BUTTON_CLASS}
            >
              ×
            </button>
          )}
        </div>
      </div>
      {isOwner && confirming && (
        <form
          action={action}
          className="bg-muted flex flex-wrap items-center gap-2 rounded-xl p-2"
        >
          <input type="hidden" name="orgId" value={orgId} />
          <input type="hidden" name="id" value={invite.id} />
          <input type="hidden" name="kind" value="invite" />
          <span className="text-muted-foreground text-[11px]">
            Revoke the invite to {invite.email}?
          </span>
          <button
            type="submit"
            disabled={pending}
            className={cn(PILL_BUTTON_CLASS, "bg-destructive ml-auto")}
          >
            {pending ? "Revoking…" : "Revoke"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className={GHOST_PILL_BUTTON_CLASS}
          >
            Cancel
          </button>
        </form>
      )}
      {state.error && confirming && <p className={ERROR_BOX_CLASS}>{state.error}</p>}
    </li>
  );
}

export function MembersCard({
  orgId,
  members,
  pendingInvites,
  myManagerId,
  isOwner,
  loadError,
}: {
  orgId: string;
  members: OrgMember[];
  pendingInvites: PendingOrgInvite[];
  myManagerId: string;
  isOwner: boolean;
  loadError: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(addOrgMemberAction, ADD_INITIAL);
  const [pendingRole, setPendingRole] = useState<OrgRole>("editor");

  // A successful add is the end of the disclosure. Adjusted during render,
  // keyed on the state OBJECT (the `added` boolean stays true across a
  // second add) — the OrgIdentityCard grammar, on purpose.
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state.added) setOpen(false);
  }

  return (
    <Section
      title="Members"
      description="Org roles govern this screen; place teams are separate."
      right={
        isOwner && !loadError ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={GHOST_PILL_BUTTON_CLASS}
          >
            {open ? "Cancel" : "Add member"}
          </button>
        ) : undefined
      }
    >
      {loadError ? (
        // Never an empty list: zero members is impossible (the creator is
        // owner), so an empty render would be a lie. Say what happened.
        <p className="text-muted-foreground text-sm">{loadError}</p>
      ) : (
        <div className="flex flex-col gap-4">
          <ul className="divide-border divide-y">
            {members.map((m) => (
              <MemberRow
                key={m.managerId}
                orgId={orgId}
                member={m}
                isMe={m.managerId === myManagerId}
                isOwner={isOwner}
              />
            ))}
          </ul>

          {pendingInvites.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className={TINY_LABEL_CLASS}>Pending invites</span>
              <ul className="divide-border divide-y">
                {pendingInvites.map((inv) => (
                  <PendingInviteRow
                    key={inv.id}
                    orgId={orgId}
                    invite={inv}
                    isOwner={isOwner}
                  />
                ))}
              </ul>
            </div>
          )}

          {state.added && !open && (
            <p className="text-muted-foreground text-[12px]">
              {state.mode === "invited" ? "Invited." : "Added."}
            </p>
          )}

          {isOwner && open && (
            <form action={formAction} className={FORM_COLUMN_CLASS}>
              <input type="hidden" name="orgId" value={orgId} />
              <Field label="Email" required>
                <input
                  name="email"
                  type="email"
                  required
                  // An error never eats the typed address — the action echoes
                  // it back, and an unknown address now sends an invite
                  // instead of dead-ending, so retyping was the failure mode
                  // worth protecting against in the first place.
                  defaultValue={state.email}
                  key={state === ADD_INITIAL ? "fresh" : "echo"}
                  autoFocus
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="Role">
                <select
                  name="role"
                  value={pendingRole}
                  onChange={(e) => setPendingRole(e.target.value as OrgRole)}
                  className={cn(INPUT_CLASS, "max-w-[12rem]")}
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </Field>
              {pendingRole === "owner" && (
                <p className="text-muted-foreground text-[11px]">
                  Owners have full control of the organization, including adding
                  and removing other owners.
                </p>
              )}
              {state.error && <p className={ERROR_BOX_CLASS}>{state.error}</p>}
              <button
                type="submit"
                disabled={pending}
                className={cn(PILL_BUTTON_CLASS, "self-start")}
              >
                {pending ? "Saving…" : pendingRole === "owner" ? "Confirm owner" : "Add member"}
              </button>
            </form>
          )}
        </div>
      )}
    </Section>
  );
}
