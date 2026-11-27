-- MESITA-5032: Foursquare exponent 0 is a real setting. raw^0 is 1, so any
-- present score is 1 + factor (2× when the factor is 1). A missing score or
-- a measured 0 stays 1×. A null or negative exponent stays 1×. Factor 0
-- stays 1×. The argument list is unchanged.

create or replace function public.discovery_foursquare_boost(
  p_raw double precision,
  p_factor double precision,
  p_exponent double precision
) returns double precision
language sql
immutable
as $$
  select case
    when coalesce(p_factor, 0) <= 0 then 1::double precision
    when p_raw is null or p_raw <= 0 then 1::double precision
    when p_exponent is null or p_exponent < 0 then 1::double precision
    else 1 + p_factor * power(
      least(1::double precision, greatest(0::double precision, p_raw)),
      p_exponent
    )
  end
$$;

revoke all on function public.discovery_foursquare_boost(double precision, double precision, double precision) from public, anon, authenticated;
grant execute on function public.discovery_foursquare_boost(double precision, double precision, double precision) to service_role;

comment on function public.discovery_foursquare_boost(double precision, double precision, double precision) is
  'MESITA-5032: 1 + factor × raw^exponent. Exponent 0 is 2× at factor 1 for any present score. Missing, measured 0, a negative exponent, or factor 0 is exactly 1.';
