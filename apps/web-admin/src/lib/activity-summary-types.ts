// The Logs page's Recent activity feed (admin-web-get-activity-summary).
// The counters it also carried left with Activity › Analytics (MESITA-3848).
export type ActivitySummary = {
  windowDays: number;
  recentFeed: Array<{ id: string; at: string; line: string }>;
};
