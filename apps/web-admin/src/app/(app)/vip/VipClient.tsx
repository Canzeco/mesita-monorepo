"use client";

// Manage › VIP (MESITA-4766). Two cards: the invitation codes (issue one with
// a required label, revoke an unused one) and every VIP guest (why, since,
// whether a bill pays as VIP today; an invited guest's VIP can be removed,
// an Instagram guest's is automatic). A new code's twelve digits live only in
// this component's state until the operator presses Done: the server keeps
// only a hash and the last four.

import { useState, useTransition } from "react";
import { CrownIcon, TicketIcon } from "@phosphor-icons/react";
import {
  Button,
  Chip,
  ConfirmDialog,
  EmptyState,
  Notice,
  SectionCard,
  TBody,
  THead,
  Table,
  Td,
  TextField,
  Th,
  Tr,
} from "@/components/admin-ui";
import { formatShortDate } from "@/lib/format";
import { issueVipCode, listVip, removeGuestVip, revokeVipCode, type VipCode, type VipGuest } from "./actions";

const LABEL_MAX = 80;

/** "1234 5678 9012", whatever spacing the server sent. */
function groupCode(code: string): { shown: string; digits: string } {
  const digits = code.replace(/\D/g, "");
  return { shown: (digits.match(/.{1,4}/g) ?? []).join(" "), digits };
}

const date = (iso: string | null) => (iso ? formatShortDate(iso) : "—");
const count = (n: number) => n.toLocaleString("en-US");

function guestLabel(g: { name: string; code: string | null }): string {
  return g.code ? `${g.name} · #${g.code}` : g.name;
}

function codeStatus(c: VipCode) {
  if (c.status === "revoked") return <Chip tone="neutral">Revoked</Chip>;
  if (c.status === "used") {
    const who = c.usedByName ? guestLabel({ name: c.usedByName, code: c.usedByCode }) : "a guest";
    return <Chip tone="success">Used by {who}</Chip>;
  }
  return <Chip tone="warning">Unused</Chip>;
}

function why(g: VipGuest): string {
  if (g.vipReason === "code") return g.vipCodeLast4 ? `Invited …${g.vipCodeLast4}` : "Invited";
  if (g.vipReason === "instagram") {
    const real = g.followers === null ? "Instagram" : `Instagram ${count(g.followers)} followers`;
    return g.followersEmulated === null ? real : `${real} (emulated ${count(g.followersEmulated)})`;
  }
  return "—";
}

export function VipClient({
  initialCodes,
  initialGuests,
  loadError,
}: {
  initialCodes: VipCode[] | null;
  initialGuests: VipGuest[] | null;
  loadError: string | null;
}) {
  const [codes, setCodes] = useState<VipCode[] | null>(initialCodes);
  const [guests, setGuests] = useState<VipGuest[] | null>(initialGuests);

  // Issue
  const [label, setLabel] = useState("");
  const [issued, setIssued] = useState<{ code: string; label: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [issuing, startIssue] = useTransition();

  // Revoke / remove
  const [revoking, setRevoking] = useState<VipCode | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<VipGuest | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = async () => {
    const r = await listVip();
    if (!r.ok) return false;
    if (r.codes) setCodes(r.codes);
    setGuests(r.guests);
    return true;
  };

  const issue = () =>
    startIssue(async () => {
      const l = label.replace(/\s+/g, " ").trim();
      if (!l) return setIssueError("Couldn't issue a code: say who it is for first.");
      setIssueError(null);
      setNotice(null);
      const r = await issueVipCode(l);
      if (!r.ok) return setIssueError(`Couldn't issue a code: ${r.error}. Try again.`);
      setIssued({ code: r.issuedCode, label: l });
      setCopied(false);
      setLabel("");
      if (r.codes) setCodes(r.codes);
    });

  const copy = async () => {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(groupCode(issued.code).digits);
      setCopied(true);
    } catch {
      setIssueError("Couldn't copy the code. Select it and copy it by hand before pressing Done.");
    }
  };

  const revoke = async () => {
    if (!revoking) return;
    setRevokeError(null);
    const r = await revokeVipCode(revoking.id);
    if (r.ok) {
      if (r.codes) setCodes(r.codes);
      else await refresh();
      setRevoking(null);
      return;
    }
    if (r.code === "code_not_unused" || r.code === "code_not_found") {
      await refresh();
      setRevoking(null);
      setNotice(
        r.code === "code_not_unused"
          ? "Couldn't revoke the code: it was used or revoked meanwhile. The list is up to date now."
          : "Couldn't revoke the code: it no longer exists. The list is up to date now.",
      );
      return;
    }
    setRevokeError(`Couldn't revoke the code: ${r.error}. Try again.`);
  };

  const remove = async () => {
    if (!removing) return;
    setRemoveError(null);
    const r = await removeGuestVip(removing.id);
    if (r.ok) {
      setGuests((gs) => (gs ? gs.filter((g) => g.id !== removing.id) : gs));
      setRemoving(null);
      return;
    }
    if (r.code === "consumer_not_found" || r.code === "not_code_vip") {
      await refresh();
      setRemoving(null);
      setNotice(
        r.code === "not_code_vip"
          ? "Couldn't remove VIP: this guest is no longer VIP by a code. The list is up to date now."
          : "Couldn't remove VIP: the guest no longer exists. The list is up to date now.",
      );
      return;
    }
    setRemoveError(`Couldn't remove VIP: ${r.error}. Try again.`);
  };

  if (loadError) {
    return <Notice>Couldn&apos;t load VIP codes and guests: {loadError}. Reload the page to try again.</Notice>;
  }

  return (
    <>
      {notice ? <Notice tone="warning">{notice}</Notice> : null}

      <SectionCard
        icon={<TicketIcon aria-hidden />}
        title="Invitation codes"
        subtitle="Twelve digits a guest types once on Me to become VIP. Each code is shown once, when you issue it. Lists every unused code, and the newest 100 used or revoked."
      >
        <div className="mt-4 flex flex-col gap-4">
          {issued ? (
            <div className="flex flex-col gap-3 rounded-xl border p-4" data-admin-vip-issued>
              <p className="text-sm">
                The code for <span className="font-semibold">{issued.label}</span>. Copy it now: it is never shown again.
              </p>
              <p className="font-mono text-2xl font-semibold tracking-wider select-all">{groupCode(issued.code).shown}</p>
              <div className="flex flex-wrap gap-2">
                <Button tone="secondary" size="sm" onClick={copy}>
                  {copied ? "Copied" : "Copy"}
                </Button>
                <Button size="sm" onClick={() => setIssued(null)}>
                  Done, I&apos;ve copied it
                </Button>
              </div>
            </div>
          ) : (
            <form
              className="flex flex-col gap-2 sm:flex-row sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                issue();
              }}
            >
              <TextField
                label="For whom"
                className="min-w-0 flex-1"
                value={label}
                onChange={setLabel}
                maxLength={LABEL_MAX}
                required
                disabled={issuing}
                placeholder="Who the code is for"
              />
              <Button type="submit" pending={issuing} disabled={!label.trim()}>
                Issue code
              </Button>
            </form>
          )}
          {issueError ? <Notice>{issueError}</Notice> : null}

          {codes === null ? (
            <Notice tone="warning">Couldn&apos;t load the codes. Reload the page to see them.</Notice>
          ) : codes.length === 0 ? (
            <EmptyState>No codes yet — issue one to invite a VIP.</EmptyState>
          ) : (
            <Table className="min-w-[640px]" data-admin-vip-codes>
              <THead>
                <Tr>
                  <Th>For whom</Th>
                  <Th>Code</Th>
                  <Th>Status</Th>
                  <Th>Issued</Th>
                  <Th numeric>Action</Th>
                </Tr>
              </THead>
              <TBody>
                {codes.map((c) => (
                  <Tr key={c.id}>
                    <Td className="font-semibold">{c.label ?? "—"}</Td>
                    <Td className="font-mono whitespace-nowrap">…{c.last4}</Td>
                    <Td>{codeStatus(c)}</Td>
                    <Td className="whitespace-nowrap">{date(c.createdAt)}</Td>
                    <Td numeric>
                      {c.status === "unused" ? (
                        <Button
                          tone="danger-ghost"
                          size="sm"
                          onClick={() => {
                            setRevokeError(null);
                            setRevoking(c);
                          }}
                        >
                          Revoke
                        </Button>
                      ) : null}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </div>
      </SectionCard>

      <SectionCard
        icon={<CrownIcon aria-hidden />}
        title="VIP guests"
        subtitle="Invited guests stay VIP until you remove it."
      >
        <div className="mt-4">
          {guests === null || guests.length === 0 ? (
            <EmptyState>No VIP guests yet.</EmptyState>
          ) : (
            <Table className="min-w-[640px]" data-admin-vip-guests>
              <THead>
                <Tr>
                  <Th>Guest</Th>
                  <Th>Why</Th>
                  <Th>Since</Th>
                  <Th>Paid as VIP</Th>
                  <Th numeric>Action</Th>
                </Tr>
              </THead>
              <TBody>
                {guests.map((g) => (
                  <Tr key={g.id}>
                    <Td className="font-semibold">{guestLabel(g)}</Td>
                    <Td>{why(g)}</Td>
                    <Td className="whitespace-nowrap">{date(g.vipInvitedAt ?? g.guestClassSetAt)}</Td>
                    <Td>{g.paidAsVip ? <Chip tone="success">Yes</Chip> : <Chip tone="neutral">No</Chip>}</Td>
                    <Td numeric>
                      {g.vipReason === "code" ? (
                        <Button
                          tone="danger-ghost"
                          size="sm"
                          onClick={() => {
                            setRemoveError(null);
                            setRemoving(g);
                          }}
                        >
                          Remove VIP
                        </Button>
                      ) : g.vipReason === "instagram" ? (
                        <span className="text-muted-foreground text-sm">Automatic</span>
                      ) : null}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </div>
      </SectionCard>

      <ConfirmDialog
        open={revoking !== null}
        error={revokeError}
        title="Revoke this code?"
        body={
          revoking ? (
            <p className="text-sm">
              The code …{revoking.last4}
              {revoking.label ? ` for ${revoking.label}` : ""} stops working. Nobody can use it after this.
            </p>
          ) : null
        }
        confirmLabel="Revoke"
        danger
        onConfirm={revoke}
        onCancel={() => setRevoking(null)}
      />
      <ConfirmDialog
        open={removing !== null}
        error={removeError}
        title="Remove VIP?"
        body={
          removing ? (
            <p className="text-sm">
              {guestLabel(removing)} stops being VIP. Code stays used: it cannot invite anyone else.
            </p>
          ) : null
        }
        confirmLabel="Remove VIP"
        danger
        onConfirm={remove}
        onCancel={() => setRemoving(null)}
      />
    </>
  );
}
