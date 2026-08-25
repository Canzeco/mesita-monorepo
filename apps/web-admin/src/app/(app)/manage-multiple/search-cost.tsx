"use client";

// Google Places Text Search call count for the bulk-search UI. Spend math
// does not live here — Create and Enrich estimates are on Intake.

const PAGE_SIZE = 20;

type SearchCallEstimate = {
  pagesPerQuery: number;
  totalCalls: number;
};

// Text Search pages + one Place Details call per pasted Google Place ID.
export function estimateSearchCost(
  queryCount: number,
  maxResults: number,
  placeIdCount = 0,
): SearchCallEstimate {
  const pagesPerQuery = Math.ceil(maxResults / PAGE_SIZE);
  const totalCalls = queryCount * pagesPerQuery + placeIdCount;
  return { pagesPerQuery, totalCalls };
}
