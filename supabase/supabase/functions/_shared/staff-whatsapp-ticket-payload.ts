import type { StaffContext } from "./staff-whatsapp-types.ts";

export type StaffBillAmounts = {
  subtotal: number;
  tip: number;
  total: number;
  discountPercent: number;
  discountCents: number;
};

export function buildStaffBillTicketInsert(
  staff: StaffContext,
  consumerId: string,
  openedBy: string,
  amounts: StaffBillAmounts,
) {
  return {
    project_id: staff.projectId,
    consumer_id: consumerId,
    opened_by: openedBy,
    opened_by_staff_user_id: staff.staffUserId,
    // Staff WhatsApp Type-A flow is discount-only (no story, no reservation),
    // which persists as `coupon` under the collapsed ticket_kind enum.
    kind: "coupon",
    status: "awaiting_payment_confirm",
    story_status: "not_required",
    check_subtotal_cents: amounts.subtotal,
    tip_cents: amounts.tip,
    total_cents: amounts.total,
    redeem_cents: 0,
    discount_percent: amounts.discountPercent,
    discount_cents: amounts.discountCents,
  };
}
