"use client";

// Google Places Text Search cost estimate for the bulk-search tab — the
// pricing constants, the pure per-run math, and the headline calculator card.

const PAGE_SIZE = 20;

// Google Places Text Search pricing (SKU model effective 2025-03-01).
// The backend field mask includes places.location, rating and
// userRatingCount — all Text Search Pro SKU fields, so every request lands
// in Pro regardless. Pricing for the 0–100K monthly tier — beyond that the
// tier rate drops, so this is a worst-case estimate. The first 5,000 Pro
// requests each month are free, shared across the whole project; surfaced
// in the tooltip rather than discounted from the headline number, since
// the remaining free quota isn't visible from the browser.
const PRICE_PER_REQUEST_USD = 0.032;
const FREE_PRO_REQUESTS_PER_MONTH = 5000;

export type SearchCostEstimate = {
  pagesPerQuery: number;
  totalCalls: number;
  totalCostUsd: number;
};

// Each page of PAGE_SIZE results is one billable request.
export function estimateSearchCost(queryCount: number, maxResults: number): SearchCostEstimate {
  const pagesPerQuery = Math.ceil(maxResults / PAGE_SIZE);
  const totalCalls = queryCount * pagesPerQuery;
  return {
    pagesPerQuery,
    totalCalls,
    totalCostUsd: totalCalls * PRICE_PER_REQUEST_USD,
  };
}

function formatUsdEstimate(amount: number): string {
  if (amount <= 0) return "US$0.00";
  if (amount < 0.01) return "<US$0.01";
  if (amount < 100) return `US$${amount.toFixed(2)}`;
  return `US$${Math.round(amount).toLocaleString()}`;
}

export function CostCalculator({
  queries,
  pagesPerQuery,
  totalCalls,
  totalCostUsd,
}: {
  queries: number;
  pagesPerQuery: number;
  totalCalls: number;
  totalCostUsd: number;
}) {
  const pricePerCallLabel = `US$${PRICE_PER_REQUEST_USD.toFixed(3)}`;
  const freeTierLabel = FREE_PRO_REQUESTS_PER_MONTH.toLocaleString();
  return (
    <div className="border-border bg-card shadow-elev rounded-2xl border px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-[10px] font-medium tracking-[0.16em] uppercase">
            Estimated cost (USD)
          </p>
          <p className="text-muted-foreground/80 mt-1 text-xs">
            Text Search Pro SKU · 0–100K monthly tier
          </p>
        </div>
        <div className="flex items-baseline gap-1.5">
          <p className="font-display text-4xl font-semibold tracking-tight tabular-nums">
            {formatUsdEstimate(totalCostUsd)}
          </p>
          <span className="text-muted-foreground text-xs font-medium tracking-[0.16em] uppercase">
            USD
          </span>
        </div>
      </div>

      <div className="border-border mt-4 grid grid-cols-2 gap-3 border-t pt-4 text-xs sm:grid-cols-4">
        <CalcStep
          label="Queries"
          value={queries.toLocaleString()}
          op=""
        />
        <CalcStep
          label="Pages / query"
          value={pagesPerQuery.toLocaleString()}
          op="×"
        />
        <CalcStep
          label="Price / call"
          value={pricePerCallLabel}
          op="×"
        />
        <CalcStep
          label="Total calls"
          value={totalCalls.toLocaleString()}
          op="="
          emphasis
        />
      </div>

      <p className="text-muted-foreground/70 mt-3 text-[11px] leading-relaxed">
        Worst-case estimate. Quality filters don&apos;t change the cost — every
        page of 20 results is one billable request whether or not the places
        pass the filters. The first {freeTierLabel} Pro calls each month are
        free across the whole Google Cloud project, and per-call price drops in
        higher volume tiers.
      </p>
    </div>
  );
}

function CalcStep({
  label,
  value,
  op,
  emphasis = false,
}: {
  label: string;
  value: string;
  op: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      {op && (
        <span className="text-muted-foreground/60 font-mono text-base leading-none">
          {op}
        </span>
      )}
      <div className="min-w-0">
        <p className="text-muted-foreground text-[10px] font-medium tracking-[0.14em] uppercase">
          {label}
        </p>
        <p
          className={
            "font-display mt-0.5 truncate text-lg font-semibold tabular-nums " +
            (emphasis ? "text-foreground" : "text-foreground/85")
          }
        >
          {value}
        </p>
      </div>
    </div>
  );
}
