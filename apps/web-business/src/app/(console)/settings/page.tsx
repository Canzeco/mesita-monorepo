import type { Metadata } from "next";
import { UserPlus } from "lucide-react";
import { PageBody, PageHeader } from "@/components/page";
import { Avatar, Card, Chip, Line, List, Note, Section, buttonClass } from "@/components/ui";
import { staff } from "@/lib/mock";

export const metadata: Metadata = { title: "Settings" };

export default function Settings() {
  const owner = staff.find((s) => s.role === "Owner")!;
  return (
    <PageBody>
      <PageHeader title="Settings" sub="Your team and your account" />

      <Section
        title="Team"
        aside={
          <button type="button" className={buttonClass("outline")}>
            <UserPlus className="size-4" aria-hidden />
            Invite
          </button>
        }
      >
        <List>
          {staff.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={m.name} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{m.name}</div>
                <div className="truncate text-sm text-muted-foreground">{m.email}</div>
              </div>
              <Chip tone={m.role === "Owner" ? "dark" : "neutral"}>{m.role}</Chip>
            </div>
          ))}
        </List>
        <Note>The Owner sees everything. Staff see only Visits: they approve QRs and see today, never money settings or payouts.</Note>
      </Section>

      <Section title="Account">
        <Card className="p-4">
          <Line label="Name" value={owner.name} />
          <Line label="Email" value={owner.email} />
          <Line label="Language" value="English" />
          <Line label="Sign-in" value="Phone code" muted />
        </Card>
      </Section>
    </PageBody>
  );
}
