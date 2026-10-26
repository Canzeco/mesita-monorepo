-- MESITA-2785: google_types never holds Google's Table B markers
-- (point_of_interest, establishment, food, the address parts): they name no
-- kind of place. The write door drops them from now on (_shared/google-table-b.ts);
-- this strips rows written before it. Same 36 values, from
-- https://developers.google.com/maps/documentation/places/web-service/place-types
update public.place_profiles p
   set google_types = coalesce((
     select jsonb_agg(t) from jsonb_array_elements(p.google_types) as t
      where not (jsonb_typeof(t) = 'string' and t #>> '{}' = any (array[
        'administrative_area_level_3','administrative_area_level_4','administrative_area_level_5',
        'administrative_area_level_6','administrative_area_level_7','archipelago','colloquial_area',
        'continent','establishment','finance','food','general_contractor','geocode','health',
        'intersection','landmark','natural_feature','neighborhood','place_of_worship','plus_code',
        'point_of_interest','political','postal_code_prefix','postal_code_suffix','postal_town',
        'premise','route','street_address','sublocality','sublocality_level_1','sublocality_level_2',
        'sublocality_level_3','sublocality_level_4','sublocality_level_5','subpremise','town_square'
      ]))), '[]'::jsonb)
 where jsonb_typeof(p.google_types) = 'array';
