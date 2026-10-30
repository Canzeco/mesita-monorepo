import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/page";
import { List, Row } from "@/components/ui";
import { moreItems } from "@/lib/nav";

export const metadata: Metadata = { title: "More" };

/** The phone's fifth tab: every page that is not one of the four tabs. */
export default function More() {
  return (
    <PageBody>
      <PageHeader title="More" />
      <List>
        {moreItems.map((m) => {
          const Icon = m.icon;
          return (
            <Row
              key={m.href}
              href={m.href}
              leading={
                <span className="grid size-9 place-items-center rounded-full bg-muted">
                  <Icon className="size-[1.125rem]" aria-hidden />
                </span>
              }
              title={m.label}
              right={m.badge ? <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-white">{m.badge}</span> : undefined}
            />
          );
        })}
      </List>
    </PageBody>
  );
}
