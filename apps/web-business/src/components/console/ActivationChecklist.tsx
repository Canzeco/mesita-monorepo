// The activation funnel, made walkable (MESITA-1537, autoplan D2). A claimed
// place is step one of four; the rest — profile, staff PIN, Partnership —
// are each a row that links to the tab that completes them. Done rows read
// from data in hand; the two the Overview read can't see yet (PIN value is
// owner-only, plan lives on the Partnership payload) render as open steps,
// never a false checkmark.
import Link from "next/link";
import { Check } from "lucide-react";
import { Section } from "@/components/shared/Section";
import { placeTabHref } from "@/lib/place-view";
import { cn } from "@/lib/utils";

type Step = { label: string; done: boolean; href: string; hint: string };

export function ActivationChecklist({
  placeId,
  profileComplete,
}: {
  placeId: string;
  profileComplete: boolean;
}) {
  const steps: Step[] = [
    {
      label: "Claim this place",
      done: true,
      href: placeTabHref(placeId, "overview"),
      hint: "Held by your organization.",
    },
    {
      label: "Complete the profile",
      done: profileComplete,
      href: placeTabHref(placeId, "profile"),
      hint: "What guests see — photos, hours, the pitch.",
    },
    {
      label: "Set the staff PIN",
      done: false,
      href: placeTabHref(placeId, "settings"),
      hint: "Gate the check page your floor uses.",
    },
    {
      label: "Join Partnership",
      done: false,
      href: placeTabHref(placeId, "partnership"),
      hint: "Turn on rewards and the red pin.",
    },
  ];

  const remaining = steps.filter((s) => !s.done).length;
  if (remaining === 0) return null;

  return (
    <Section
      title="Get set up"
      description="A few steps to a live, earning place."
    >
      <ul className="flex flex-col">
        {steps.map((step) => (
          <li key={step.label}>
            <Link
              href={step.href}
              className="group hover:bg-muted/40 -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition"
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px]",
                  step.done
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-border text-muted-foreground",
                )}
              >
                {step.done && <Check className="h-3 w-3" />}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block text-sm font-medium",
                    step.done && "text-muted-foreground line-through",
                  )}
                >
                  {step.label}
                </span>
                {!step.done && (
                  <span className="text-muted-foreground block text-[12px]">
                    {step.hint}
                  </span>
                )}
              </span>
              {!step.done && (
                <span className="text-muted-foreground group-hover:text-foreground text-[13px]">
                  →
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}
