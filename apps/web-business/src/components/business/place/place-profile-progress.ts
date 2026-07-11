import { PLACE_HOUR_DAYS } from "./place-hours";
import type { PlaceFormState } from "./place-form-types";

export type ProfileProgressCheck = {
  label: string;
  done: boolean;
};

export function getProfileProgressChecks(
  v: PlaceFormState,
): ProfileProgressCheck[] {
  return [
    { label: "Category", done: v.category.trim() !== "" },
    { label: "About", done: v.description.trim() !== "" },
    { label: "Photos", done: v.photos.length > 0 },
    {
      label: "Hours",
      done: PLACE_HOUR_DAYS.some(({ key }) =>
        v.hours[key].ranges.some(
          (range) => range.open.trim() && range.close.trim(),
        ),
      ),
    },
    { label: "Menu", done: v.menu_links.some((m) => m.url.trim() !== "") },
    { label: "Tags", done: v.tags.length > 0 },
    { label: "Website", done: v.website_url.trim() !== "" },
    { label: "Phone", done: v.phone.trim() !== "" },
    { label: "Instagram", done: v.instagram_url.trim() !== "" },
  ];
}

export function getProfileProgress(v: PlaceFormState) {
  const checks = getProfileProgressChecks(v);
  const completed = checks.filter((check) => check.done).length;
  const total = checks.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { checks, completed, total, pct, isComplete: completed === total };
}
