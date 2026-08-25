"use client";

// Google Places Text Search call count for the bulk-search UI. Spend math
// does not live here — Create and Enrich estimates are on Intake.

const PAGE_SIZE = 20;

type SearchCallEstimate = {
  pagesPerQuery: number;
  totalCalls: number;
};

// Each page of PAGE_SIZE results is one Google request.
export function estimateSearchCost(
  queryCount: number,
  maxResults: number,
): SearchCallEstimate {
  const pagesPerQuery = Math.ceil(maxResults / PAGE_SIZE);
  const totalCalls = queryCount * pagesPerQuery;
  return { pagesPerQuery, totalCalls };
}
