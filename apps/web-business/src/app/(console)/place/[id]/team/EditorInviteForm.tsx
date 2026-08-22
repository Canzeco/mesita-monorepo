"use client";

import { useState } from "react";
import { Loader2, Mail, Send } from "lucide-react";

import type { BusinessRole } from "@/lib/api/team";
import { cn } from "@/lib/utils";
import { PILL_BUTTON_CLASS } from "@/lib/ui-classes";

import { INVITE_ROLE_CHOICES, ROLE_LABEL } from "./team-constants";

export function EditorInviteForm({
  busy,
  onSubmit,
  roleChoices = INVITE_ROLE_CHOICES,
  defaultRole = "editor",
  submitLabel = "Send invite",
}: {
  busy: boolean;
  onSubmit: (email: string, role: BusinessRole) => void | Promise<void>;
  roleChoices?: BusinessRole[];
  defaultRole?: BusinessRole;
  submitLabel?: string;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<BusinessRole>(defaultRole);

  return (
    <form
      className="bg-muted/30 border-border/50 flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center"
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = email.trim();
        if (!trimmed) return;
        onSubmit(trimmed, role);
      }}
    >
      <div className="relative flex-1">
        <Mail className="text-muted-foreground absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
        <input
          type="email"
          required
          autoFocus
          placeholder="name@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border-border bg-background focus:border-foreground/40 w-full rounded-full border py-2 pr-3 pl-8 text-[13px] outline-none"
        />
      </div>
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as BusinessRole)}
        className="border-border bg-background w-full rounded-full border px-3 py-2 text-[13px] outline-none sm:w-auto"
      >
        {roleChoices.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABEL[r]}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={busy || email.trim().length === 0}
        className={cn(PILL_BUTTON_CLASS, "px-4 py-2 disabled:opacity-50")}
      >
        {busy ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Send className="h-3 w-3" />
        )}
        {submitLabel}
      </button>
    </form>
  );
}
