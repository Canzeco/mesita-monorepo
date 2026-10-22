-- MESITA-2659 (Pato, 2026-10-21: "take care of the camel case"): stored
-- category labels were Title Case ("Taco Restaurant", "Bar And Grill")
-- because humanizeCategorySlug capitalised every word. Sentence case now:
-- first letter capital, the rest lower. Only labels that are exactly the
-- Title Case of their own words change; anything else is left alone.
update public.place_profiles
set category_label = upper(left(lower(category_label), 1))
  || substr(lower(category_label), 2)
where category_label is not null
  and category_label = initcap(category_label)
  and category_label <> upper(left(lower(category_label), 1))
    || substr(lower(category_label), 2);
