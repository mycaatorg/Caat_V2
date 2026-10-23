-- Search scholarship title/provider/school/field/tags by unordered terms,
-- with conservative typo matching for longer alphabetic terms.
-- The existing pg_trgm extension was installed by 20260704120500.
begin;
set local lock_timeout = '5s';
create extension if not exists pg_trgm with schema public;

create or replace function public.search_scholarships(
  p_search         text        default null,
  p_location       text        default null,
  p_funding        text[]      default '{}',
  p_levels         text[]      default '{}',
  p_citizenship    text[]      default '{}',
  p_fields         text[]      default '{}',
  p_universities   text[]      default '{}',
  p_open_only      boolean     default false,
  p_restrict_ids   uuid[]      default null,
  p_target_majors  text[]      default '{}',
  p_pref_countries text[]      default '{}',
  p_home_country   text        default null,
  p_domestic_codes text[]      default '{}',
  p_grad_year      integer     default null,
  p_limit          integer     default 6,
  p_offset         integer     default 0
)
returns table(data jsonb, total_count bigint)
language sql
stable
security definer
set search_path to 'public'
as $$
  with query as (
    select
      trim(regexp_replace(lower(coalesce(p_search, '')), '[[:space:]]+', ' ', 'g')) as phrase,
      case
        when nullif(trim(p_search), '') is null then '{}'::text[]
        else array(
          select token.value
          from regexp_split_to_table(lower(trim(p_search)), '[^[:alnum:]%_]+') as token(value)
          where token.value <> ''
        )
      end as terms
  ),
  base as (
    select
      s.*,
      case
        when (flags.f_major + flags.f_country + flags.f_citz) > 0
          then flags.f_major + flags.f_country + flags.f_citz + flags.f_level
        else 0
      end as _score,
      case
        when query.phrase = '' then 0
        when position(query.phrase in search_text.value) > 0 then 0
        when term_matches.exact_count = cardinality(query.terms) then 1
        else 2
      end as _search_rank,
      term_matches.exact_count as _exact_terms
    from scholarships s
    cross join query
    cross join lateral (
      select lower(concat_ws(' ',
        s.title,
        s.provider_name,
        s.school_name,
        array_to_string(s.field_of_study, ' '),
        array_to_string(s.tags, ' ')
      )) as value
    ) search_text
    cross join lateral (
      select
        count(*) filter (
          where position(lower(term.value) in search_text.value) > 0
        ) as exact_count,
        count(*) as term_count,
        bool_and(
          position(lower(term.value) in search_text.value) > 0
          or (
            char_length(term.value) >= 4
            and term.value ~ '^[[:alpha:]]+$'
            and public.word_similarity(lower(term.value), search_text.value) >= 0.68
          )
        ) as all_terms_match
      from unnest(query.terms) as term(value)
    ) term_matches
    cross join lateral (
      select
        -- matchedMajor: any target major is a substring of title+description+tags
        (case
          when cardinality(p_target_majors) > 0
           and exists (
             select 1 from unnest(p_target_majors) m
             where m <> ''
               and position(m in lower(
                 coalesce(s.title, '') || ' ' ||
                 coalesce(s.description, '') || ' ' ||
                 coalesce(array_to_string(s.tags, ' '), '')
               )) > 0
           )
          then 1 else 0
        end) as f_major,
        -- matchedCountry: normalised preferred country equals the row's country
        (case
          when cardinality(p_pref_countries) > 0
           and lower(trim(coalesce(s.country, ''))) = any(p_pref_countries)
          then 1 else 0
        end) as f_country,
        -- citizenshipEligible: isCitizenshipEligible(nationality, s) from profile-match.ts
        (case
          when jsonb_array_length(coalesce(s.citizenships, '[]'::jsonb)) = 0 then 0
          when (
                 p_home_country is not null
                 and lower(trim(coalesce(s.country, ''))) = lower(p_home_country)
                 and coalesce(s.citizenships, '[]'::jsonb) ?| coalesce(p_domestic_codes, '{}')
               )
               or coalesce(s.citizenships, '[]'::jsonb) @> '["INTERNATIONAL"]'::jsonb
          then 1 else 0
        end) as f_citz,
        -- levelMatches: high-schooler heuristic + undergraduate study level
        (case
          when p_grad_year is not null
           and p_grad_year between extract(year from now())::int and extract(year from now())::int + 5
           and s.study_level @> array['undergraduate']
          then 1 else 0
        end) as f_level
    ) flags
    where
      (p_restrict_ids is null or s.id = any(p_restrict_ids))
      and (not p_open_only or s.is_active)
      and (
        query.phrase = ''
        or (
          char_length(query.phrase) <= 200
          and cardinality(query.terms) between 1 and 8
          and not exists (
            select 1 from unnest(query.terms) bounded_term(value)
            where char_length(bounded_term.value) > 64
          )
          and coalesce(term_matches.all_terms_match, false)
        )
      )
      and (
        p_location is null
        or s.country ilike '%' || p_location || '%'
        or s.school_name ilike '%' || p_location || '%'
        or s.state_region ilike '%' || p_location || '%'
      )
      and (
        cardinality(p_funding) = 0
        or ('Merit-Based' = any(p_funding) and s.merit_based)
        or ('Need-Based'  = any(p_funding) and s.need_based)
        or ('Full Ride'   = any(p_funding) and s.funding_type @> array['full_ride'])
      )
      and (
        cardinality(p_levels) = 0
        or ('Undergraduate' = any(p_levels) and s.study_level @> array['undergraduate'])
        or ('Postgraduate'  = any(p_levels) and s.study_level @> array['postgraduate'])
      )
      and (
        cardinality(p_citizenship) = 0
        or (
          'Domestic' = any(p_citizenship) and (
            jsonb_array_length(coalesce(s.citizenships, '[]'::jsonb)) = 0
            or (case
                  when s.country = 'Australia'
                    then coalesce(s.citizenships, '[]'::jsonb) ?| array['AU', 'AU-PR']
                  else exists (
                    select 1 from jsonb_array_elements_text(coalesce(s.citizenships, '[]'::jsonb)) e
                    where e <> 'INTERNATIONAL'
                  )
                end)
          )
        )
        or (
          'International' = any(p_citizenship) and (
            jsonb_array_length(coalesce(s.citizenships, '[]'::jsonb)) = 0
            or coalesce(s.citizenships, '[]'::jsonb) @> '["INTERNATIONAL"]'::jsonb
          )
        )
      )
      and (cardinality(p_fields) = 0 or s.field_of_study && p_fields)
      and (
        cardinality(p_universities) = 0
        or coalesce(nullif(trim(s.school_name), ''), trim(s.provider_name)) = any(p_universities)
      )
  ),
  page as (
    select *
    from base
    order by _search_rank, _exact_terms desc, _score desc,
             is_active desc, is_featured desc, created_at desc, id asc
    limit greatest(p_limit, 0)
    offset greatest(p_offset, 0)
  )
  select
    coalesce(
      (
        select jsonb_agg(
          to_jsonb(page) - '_score' - '_search_rank' - '_exact_terms'
          order by page._search_rank, page._exact_terms desc, page._score desc,
                   page.is_active desc, page.is_featured desc, page.created_at desc, page.id asc
        )
        from page
      ),
      '[]'::jsonb
    ) as data,
    (select count(*) from base) as total_count;
$$;

grant execute on function public.search_scholarships(
  text, text, text[], text[], text[], text[], text[], boolean, uuid[],
  text[], text[], text, text[], integer, integer, integer
) to anon, authenticated;

commit;
