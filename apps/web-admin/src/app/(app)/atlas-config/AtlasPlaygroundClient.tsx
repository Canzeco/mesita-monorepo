"use client";

import { useState } from "react";
import { Check, Minus, ShieldCheck } from "lucide-react";
import { SectionCard } from "../enricher-config/atlas-ui";
import { PLACE_FIELD_PERMISSIONS } from "./place-field-permissions";
import type { FieldEditRole } from "./place-field-permissions";
import {
  PLACE_FIELD_EDIT_ROLE_LABELS,
  PLACE_FIELD_EDIT_ROLES,
  PLACE_FIELD_PERMISSION_GROUP_DESCRIPTIONS,
  PLACE_FIELD_PERMISSION_GROUPS,
} from "./place-field-permission-metadata";

// Atlas Playground — a read-only preview of the place-field edit matrix from one
// writer's point of view. Pick Native / Enricher / Admin / Business and see which
// place-profile fields it may set. Pure client compute over the shipped static
// PLACE_FIELD_PERMISSIONS — nothing here changes the ACL (edit the Place UIs / EF
// / Enricher, then mirror the matrix on the Config tab).

export function AtlasPlaygroundClient() {
  const [role, setRole] = useState<FieldEditRole>("admin");

  const total = PLACE_FIELD_PERMISSIONS.length;
  const editable = PLACE_FIELD_PERMISSIONS.filter((f) => f[role]).length;
  const roleLabel = PLACE_FIELD_EDIT_ROLE_LABELS[role];

  const groups = PLACE_FIELD_PERMISSION_GROUPS.map((group) => {
    const fields = PLACE_FIELD_PERMISSIONS.filter((f) => f.group === group);
    return { group, fields, yes: fields.filter((f) => f[role]).length };
  });

  return (
    <div className="space-y-6">
      <SectionCard
        icon={<ShieldCheck className="text-secondary h-4 w-4" />}
        title="Who can edit what"
        subtitle="Pick a writer and see exactly which place-profile fields it may set. This reads the shipped edit matrix — a preview of the ACL, not a control."
      >
        <div className="mt-4 flex w-full max-w-md gap-1">
          {PLACE_FIELD_EDIT_ROLES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              aria-pressed={role === r}
              className={
                "h-9 flex-1 rounded-lg border px-2 text-sm font-semibold transition " +
                (role === r
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card hover:border-foreground/40")
              }
            >
              {PLACE_FIELD_EDIT_ROLE_LABELS[r]}
            </button>
          ))}
        </div>
        <p className="text-muted-foreground mt-3 text-sm">
          <span className="text-foreground font-semibold">{roleLabel}</span> can
          write{" "}
          <span className="text-foreground font-semibold tabular-nums">
            {editable}
          </span>{" "}
          of <span className="tabular-nums">{total}</span> place fields.
        </p>
      </SectionCard>

      {groups.map(({ group, fields, yes }) => (
        <SectionCard
          key={group}
          icon={<ShieldCheck className="text-secondary h-4 w-4" />}
          title={group}
          subtitle={PLACE_FIELD_PERMISSION_GROUP_DESCRIPTIONS[group]}
          status={
            <span className="text-muted-foreground text-xs tabular-nums">
              {yes}/{fields.length} editable
            </span>
          }
        >
          <ul className="divide-border/60 border-border mt-4 divide-y overflow-hidden rounded-xl border">
            {fields.map((f) => {
              const can = f[role];
              return (
                <li key={f.key} className="flex items-start gap-3 px-3 py-2.5">
                  <span className="mt-0.5 shrink-0">
                    {can ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Minus className="text-muted-foreground/40 h-4 w-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={
                        "text-sm font-medium " + (can ? "" : "text-muted-foreground")
                      }
                    >
                      {f.label}
                    </p>
                    {f.note && (
                      <p className="text-muted-foreground/80 mt-0.5 text-[11px] leading-snug">
                        {f.note}
                      </p>
                    )}
                  </div>
                  {can && (
                    <span className="shrink-0 text-[11px] font-medium text-emerald-600">
                      editable
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </SectionCard>
      ))}
    </div>
  );
}
