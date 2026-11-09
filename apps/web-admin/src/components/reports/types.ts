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

// One guest's feedback about the app itself, not a place
// (admin-web-list-app-feedback, MESITA-3029).
export type AdminAppFeedback = {
  id: string;
  consumer_id: string;
  first_name: string | null;
  member_number: string | null;
  note: string;
  created_at: string;
};
