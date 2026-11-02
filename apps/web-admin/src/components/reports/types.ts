// One guest report from the place screen's three dots (admin-web-list-place-reports).

export type AdminPlaceReport = {
  id: string;
  place_id: string;
  place_name: string;
  consumer_id: string;
  first_name: string | null;
  member_number: string | null;
  reason: string;
  note: string | null;
  created_at: string;
};
