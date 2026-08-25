"use client";

import { useState, useTransition } from "react";
import { ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { Button, SectionCard, TextField } from "@/components/admin-ui/config";
import { grantAdmin, revokeAdmin, type AdminRow } from "./actions";
import { PageContainer, PageHeader } from "@/components/PageContainer";

export function AdminConfigClient({
  initialAdmins,
  self,
  loadError,
}: {
  initialAdmins: AdminRow[];
  self: string | null;
  loadError: string | null;
}) {
  return (
    <PageContainer size="3xl" className="flex flex-col gap-6 sm:gap-8">
      <PageHeader
        eyebrow="Operations · Admins"
        title="Admins"
        description="Manage who has admin access. Super-admins only."
      />

      <AdminsCard initialAdmins={initialAdmins} self={self} loadError={loadError} />
    </PageContainer>
  );
}

// ─── Admins ──────────────────────────────────────────────────────────────

function AdminsCard({
  initialAdmins,
  self,
  loadError,
}: {
  initialAdmins: AdminRow[];
  self: string | null;
  loadError: string | null;
}) {
  const [admins, setAdmins] = useState<AdminRow[]>(initialAdmins);
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(loadError);
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [adding, startAdd] = useTransition();
  const [removing, startRemove] = useTransition();

  const add = () => {
    const e = email.trim().toLowerCase();
    if (!e || adding) return;
    setError(null);
    startAdd(async () => {
      const r = await grantAdmin(e, note.trim());
      if (!r.ok) {
        setError(r.error);
        return;
      }
      // Reconcile from the row the EF actually wrote (authoritative note,
      // created_at, added_by), then keep the list in created_at order to
      // match admin-list-admins.
      const row = r.admin;
      setAdmins((prev) =>
        [...prev.filter((a) => a.email !== row.email), row].sort((a, b) =>
          a.created_at.localeCompare(b.created_at),
        ),
      );
      setEmail("");
      setNote("");
    });
  };

  const remove = (target: string) => {
    if (removing) return;
    setError(null);
    setBusyEmail(target);
    startRemove(async () => {
      const r = await revokeAdmin(target);
      setBusyEmail(null);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setAdmins((prev) => prev.filter((a) => a.email !== target));
    });
  };

  const onlyOne = admins.length <= 1;

  return (
    <SectionCard
      icon={<ShieldCheck className="text-muted-foreground h-4 w-4" />}
      title="Admins"
      subtitle="Everyone on the super-admin allowlist. Add or remove by email — the account doesn't need to exist yet."
      status={
        <span className="text-muted-foreground text-xs tabular-nums">
          {admins.length}
        </span>
      }
    >
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <div className="min-w-0 flex-1">
          <TextField
            type="email"
            value={email}
            onChange={setEmail}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="name@example.com"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <div className="min-w-0 flex-1">
          <TextField
            value={note}
            onChange={setNote}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Note (optional)"
            maxLength={280}
          />
        </div>
        <Button
          pending={adding}
          disabled={email.trim().length === 0}
          icon={<UserPlus className="h-3.5 w-3.5" />}
          onClick={add}
        >
          Add
        </Button>
      </div>

      {error && <ErrorNote message={error} />}

      <ul className="border-border divide-border/60 mt-5 divide-y overflow-hidden rounded-xl border">
        {admins.length === 0 && (
          <li className="text-muted-foreground px-4 py-4 text-sm">
            No admins loaded.
          </li>
        )}
        {admins.map((a) => {
          const isSelf = !!self && a.email === self;
          const busy = busyEmail === a.email;
          return (
            <li
              key={a.email}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {a.email}
                  {isSelf && (
                    <span className="text-muted-foreground ml-1.5 text-xs font-normal">
                      · you
                    </span>
                  )}
                </p>
                {a.note && (
                  <p className="text-muted-foreground truncate text-xs">
                    {a.note}
                  </p>
                )}
              </div>
              <Button
                tone="danger"
                size="icon"
                pending={busy}
                disabled={isSelf || onlyOne || removing}
                title={
                  isSelf
                    ? "You can't remove yourself"
                    : onlyOne
                      ? "Can't remove the last admin"
                      : "Remove admin"
                }
                aria-label="Remove admin"
                onClick={() => remove(a.email)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}


