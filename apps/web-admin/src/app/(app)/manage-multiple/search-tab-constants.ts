export const MAX_QUERIES = 200;
export const MAX_RESULTS = 50;
export const MIN_RESULTS = 1;

export const EXAMPLE_QUERIES = [
  "Mejores restaurantes en San Pedro",
  "Mezcalerías en Oaxaca",
  "Coffee shops in Mexico City",
];

// Quality-filter presets. 0 = off ("Any"). Rating is a Google 1-5 score;
// reviews is a userRatingCount floor. A place must clear BOTH to survive.
export const RESULTS_OPTIONS: { label: string; value: number }[] = [
  { label: "10", value: 10 },
  { label: "20", value: 20 },
  { label: "50", value: 50 },
];

export const RATING_OPTIONS: { label: string; value: number }[] = [
  { label: "Any", value: 0 },
  { label: "3.5+", value: 3.5 },
  { label: "4.0+", value: 4 },
  { label: "4.5+", value: 4.5 },
];

export const REVIEW_OPTIONS: { label: string; value: number }[] = [
  { label: "Any", value: 0 },
  { label: "10+", value: 10 },
  { label: "50+", value: 50 },
  { label: "100+", value: 100 },
  { label: "500+", value: 500 },
];
