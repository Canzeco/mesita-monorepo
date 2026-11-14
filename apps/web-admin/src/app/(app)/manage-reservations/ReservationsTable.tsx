import {
  Chip,
  type ChipTone,
  EmptyState,
  Notice,
  SectionCard,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from "@/components/admin-ui";
import { businessPlaceHref } from "@/lib/business-url";
import type { AdminReservation } from "./actions";

// Manage › Reservations (MESITA-3960): one read-only table of every
// reservation ticket, newest first. The time is the place's wall clock (every
// slot is booked in the place's own zone, Docs › Reservations § B). A place
// opens in the Business app (MESITA-3104); nothing here changes a ticket.

/** The operator's word for each stored state. "Passed" is derived server-side
 *  (confirmed, time 4 h behind us), never stored. */
function statusChip(r: AdminReservation): { label: string; tone: ChipTone; dot?: boolean } {
  switch (r.state) {
    case "pending":
      return { label: "Booking", tone: "warning", dot: true };
    case "confirmed":
      return r.passed ? { label: "Passed", tone: "neutral" } : { label: "Confirmed", tone: "success" };
    case "declined":
      return { label: "Declined", tone: "danger" };
    case "cancelled":
      return { label: "Cancelled", tone: "neutral" };
    case "unreachable":
      return { label: "Unreachable", tone: "danger" };
    case "unresolved":
      return { label: "Unresolved", tone: "danger" };
    default:
      return { label: r.state, tone: "neutral" };
  }
}

function placeTime(iso: string, timeZone: string | undefined): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function guestName(r: AdminReservation): string {
  const typed = [r.guest_first_name, r.guest_last_name].map((s) => s?.trim()).filter(Boolean).join(" ");
  return typed || r.consumer_first_name || "—";
}

export function ReservationsTable({
  reservations,
  capped,
  loadError,
}: {
  reservations: AdminReservation[];
  capped: boolean;
  loadError: string | null;
}) {
  return (
    <SectionCard title="All reservations">
      {loadError ? (
        <Notice className="mt-4">Couldn&apos;t load reservations: {loadError}</Notice>
      ) : null}
      {reservations.length === 0 ? (
        loadError === null ? <EmptyState>No reservations yet.</EmptyState> : null
      ) : (
        <Table className="mt-4">
          <THead>
            <Tr>
              <Th>When (place time)</Th>
              <Th>Place</Th>
              <Th>Under the name</Th>
              <Th numeric>Party</Th>
              <Th>Status</Th>
              <Th>Ref</Th>
              <Th>Asked</Th>
            </Tr>
          </THead>
          <TBody>
            {reservations.map((r) => {
              const status = statusChip(r);
              const href = r.place ? businessPlaceHref(r.place.id, "profile") : null;
              return (
                <Tr key={r.id}>
                  <Td className="whitespace-nowrap">{placeTime(r.reserved_at, r.place?.timezone)}</Td>
                  <Td>
                    {r.place && href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline-offset-4 hover:underline"
                      >
                        {r.place.name ?? "Unnamed place"}
                      </a>
                    ) : (
                      (r.place?.name ?? "—")
                    )}
                  </Td>
                  <Td>
                    <div>{guestName(r)}</div>
                    <div className="text-muted-foreground type-meta">
                      {r.member_number ? `Member ${r.member_number}` : "No member"}
                      {r.notes ? ` · ${r.notes}` : ""}
                    </div>
                  </Td>
                  <Td numeric>{r.party_size}</Td>
                  <Td>
                    <span className="inline-flex flex-wrap items-center gap-1.5">
                      <Chip tone={status.tone} dot={status.dot}>
                        {status.label}
                      </Chip>
                      {r.is_test ? <Chip>Test</Chip> : null}
                    </span>
                  </Td>
                  <Td className="font-mono type-meta">{r.reference_code ?? "—"}</Td>
                  <Td className="text-muted-foreground whitespace-nowrap type-meta">
                    {placeTime(r.created_at, r.place?.timezone)}
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      )}
      {capped ? <p className="text-muted-foreground mt-3 type-meta">Showing the latest 500.</p> : null}
    </SectionCard>
  );
}
