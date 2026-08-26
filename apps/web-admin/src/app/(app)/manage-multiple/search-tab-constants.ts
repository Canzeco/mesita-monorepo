export const MAX_QUERIES = 200;
export const MAX_RESULTS = 50;
export const MIN_RESULTS = 1;

export const EXAMPLE_QUERIES = [
  "Mejores restaurantes en San Pedro",
  "Mezcalerías en Oaxaca",
  "Coffee shops in Mexico City",
];

// How many Google hits to fetch per query — operational, not a quality
// policy. Rating / review floors and types live on Discovery › Map
// for text hits AND named Place IDs.
export const RESULTS_OPTIONS: { label: string; value: number }[] = [
  { label: "10", value: 10 },
  { label: "20", value: 20 },
  { label: "50", value: 50 },
];
