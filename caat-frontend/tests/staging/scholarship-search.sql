-- Behavioral regression checks for search_scholarships matching.
-- Run against a disposable local Supabase database with psql -v ON_ERROR_STOP=1.
-- All fixtures are rolled back, so the same script is safe on the clean CI schema.
begin;

insert into public.scholarships (
  id, title, provider_name, description, study_level, funding_type,
  is_active, is_featured, created_at, tags, field_of_study, school_name
) values
  ('e2100000-0000-0000-0000-000000000001', 'Harbor Access Award', 'Northstar Foundation', '', '{}', '{}', true, false, '2026-01-01 00:00:00+00', '{}', array['engineering'], null),
  ('e2100000-0000-0000-0000-000000000002', 'Enginering Access Award', 'Northstar Foundation', '', '{}', '{}', true, false, '2026-01-01 00:00:00+00', '{}', array['engineering'], null),
  ('e2100000-0000-0000-0000-000000000003', 'Engineering Access Award', 'Northstar Foundation', '', '{}', '{}', true, false, '2026-01-01 00:00:00+00', '{}', array['engineering'], null),
  ('e2100000-0000-0000-0000-000000000004', 'Engineering Design Grant', 'South Coast Institute', '', '{}', '{}', false, false, '2026-01-01 00:00:00+00', array['northstar'], '{}', null),
  ('e2100000-0000-0000-0000-000000000005', 'Percent % Research Grant', 'Literal Punctuation Foundation', '', '{}', '{}', true, false, '2026-01-01 00:00:00+00', '{}', '{}', null),
  ('e2100000-0000-0000-0000-000000000006', 'CAATPAGE Search Fellowship', 'Stable Order Foundation', '', '{}', '{}', true, false, '2026-01-01 00:00:00+00', '{}', '{}', null),
  ('e2100000-0000-0000-0000-000000000007', 'CAATPAGE Search Fellowship', 'Stable Order Foundation', '', '{}', '{}', true, false, '2026-01-01 00:00:00+00', '{}', '{}', null),
  ('e2100000-0000-0000-0000-000000000008', 'CAATPAGE Search Fellowship', 'Stable Order Foundation', '', '{}', '{}', true, false, '2026-01-01 00:00:00+00', '{}', '{}', null),
  ('e2100000-0000-0000-0000-000000000009', 'Literal _ Separator Grant', 'Literal Punctuation Foundation', '', '{}', '{}', true, false, '2026-01-01 00:00:00+00', '{}', '{}', null),
  ('e2100000-0000-0000-0000-000000000010', 'Enginering Access Award', 'Ranking Foundation', '', '{}', '{}', true, false, '2026-01-01 00:00:00+00', '{}', '{}', null),
  ('e2100000-0000-0000-0000-000000000011', 'Engineering Access Award', 'Ranking Foundation', '', '{}', '{}', true, false, '2026-01-01 00:00:00+00', '{}', '{}', null),
  ('e2100000-0000-0000-0000-000000000012', 'Law Access Award', 'Campus Foundation', '', '{}', '{}', true, false, '2026-01-01 00:00:00+00', '{}', '{}', 'Banksia University');

set local role anon;

do $$
declare
  v_data jsonb;
  v_count bigint;
  v_exact_id uuid;
  v_fuzzy_first uuid;
  v_fuzzy_second uuid;
  v_null_count bigint;
  v_empty_count bigint;
  v_whitespace_count bigint;
begin
  if not has_function_privilege(
    'authenticated',
    'public.search_scholarships(text,text,text[],text[],text[],text[],text[],boolean,uuid[],text[],text[],text,text[],integer,integer,integer)'::regprocedure,
    'EXECUTE'
  ) then
    raise exception 'authenticated role lost EXECUTE on search_scholarships';
  end if;

  -- All terms must match, in any order and across searchable fields.
  select data, total_count into v_data, v_count
  from public.search_scholarships(
    p_search => 'northstar engineering',
    p_restrict_ids => array[
      'e2100000-0000-0000-0000-000000000001'::uuid,
      'e2100000-0000-0000-0000-000000000002'::uuid,
      'e2100000-0000-0000-0000-000000000003'::uuid,
      'e2100000-0000-0000-0000-000000000004'::uuid
    ],
    p_limit => 100
  );
  if v_count <> 4 or not coalesce(v_data @> '[{"id":"e2100000-0000-0000-0000-000000000001"}]'::jsonb, false) then
    raise exception 'multiword terms did not match across provider and field_of_study; count %, data %', v_count, v_data;
  end if;

  select total_count into v_count
  from public.search_scholarships(
    p_search => 'engineering northstar',
    p_restrict_ids => array[
      'e2100000-0000-0000-0000-000000000001'::uuid,
      'e2100000-0000-0000-0000-000000000002'::uuid,
      'e2100000-0000-0000-0000-000000000003'::uuid,
      'e2100000-0000-0000-0000-000000000004'::uuid
    ],
    p_limit => 100
  );
  if v_count <> 4 then
    raise exception 'multiword matching changed when query word order changed; count %', v_count;
  end if;

  select total_count into v_count
  from public.search_scholarships(
    p_search => 'NORTHSTAR ENGINEERING',
    p_restrict_ids => array[
      'e2100000-0000-0000-0000-000000000001'::uuid,
      'e2100000-0000-0000-0000-000000000002'::uuid,
      'e2100000-0000-0000-0000-000000000003'::uuid,
      'e2100000-0000-0000-0000-000000000004'::uuid
    ],
    p_limit => 100
  );
  if v_count <> 4 then
    raise exception 'uppercase multiword matching failed; count %', v_count;
  end if;

  select total_count into v_count
  from public.search_scholarships(
    p_search => 'northstar, engineering',
    p_restrict_ids => array[
      'e2100000-0000-0000-0000-000000000001'::uuid,
      'e2100000-0000-0000-0000-000000000002'::uuid,
      'e2100000-0000-0000-0000-000000000003'::uuid,
      'e2100000-0000-0000-0000-000000000004'::uuid
    ],
    p_limit => 100
  );
  if v_count <> 4 then
    raise exception 'punctuation-separated multiword matching failed; count %', v_count;
  end if;

  select total_count into v_count
  from public.search_scholarships(
    p_search => 'northstar engineering',
    p_open_only => true,
    p_restrict_ids => array[
      'e2100000-0000-0000-0000-000000000001'::uuid,
      'e2100000-0000-0000-0000-000000000002'::uuid,
      'e2100000-0000-0000-0000-000000000003'::uuid,
      'e2100000-0000-0000-0000-000000000004'::uuid
    ],
    p_limit => 100
  );
  if v_count <> 3 then
    raise exception 'open-only filter included inactive matching fixture; count %', v_count;
  end if;

  -- Long-term typo tolerance returns the typo row alongside correctly spelled rows.
  select data, total_count into v_data, v_count
  from public.search_scholarships(
    p_search => 'enginering',
    p_restrict_ids => array[
      'e2100000-0000-0000-0000-000000000002'::uuid,
      'e2100000-0000-0000-0000-000000000003'::uuid
    ],
    p_limit => 100
  );
  if v_count <> 2 or not coalesce(v_data @> '[{"id":"e2100000-0000-0000-0000-000000000002"}]'::jsonb, false) then
    raise exception 'long-word typo matching failed; count %, data %', v_count, v_data;
  end if;

  -- Neither title contains the query phrase; one row can ONLY match via a
  -- typo (no exact field/tag fallback), and its ID would otherwise sort first.
  select data, total_count into v_data, v_count
  from public.search_scholarships(
    p_search => 'access engineering',
    p_restrict_ids => array[
      'e2100000-0000-0000-0000-000000000010'::uuid,
      'e2100000-0000-0000-0000-000000000011'::uuid
    ],
    p_limit => 100
  );
  if v_count <> 2 or (v_data->0->>'id')::uuid is distinct from 'e2100000-0000-0000-0000-000000000011'::uuid then
    raise exception 'exact word match did not rank ahead of fuzzy-only match; count %, data %', v_count, v_data;
  end if;

  select total_count into v_count
  from public.search_scholarships(
    p_search => 'banksia law',
    p_restrict_ids => array['e2100000-0000-0000-0000-000000000012'::uuid]
  );
  if v_count <> 1 then
    raise exception 'school_name and title did not match across fields; count %', v_count;
  end if;

  select total_count into v_count
  from public.search_scholarships(
    p_search => 'banksia lqw',
    p_restrict_ids => array['e2100000-0000-0000-0000-000000000012'::uuid]
  );
  if v_count <> 0 then
    raise exception 'short mistyped term unexpectedly matched; count %', v_count;
  end if;

  -- Existing filters and caller-supplied bookmark restrictions apply to fuzzy results.
  select data, total_count into v_data, v_count
  from public.search_scholarships(
    p_search => 'enginering',
    p_fields => array['engineering'],
    p_restrict_ids => array['e2100000-0000-0000-0000-000000000002'::uuid],
    p_limit => 100
  );
  if v_count <> 1 or (v_data->0->>'id')::uuid is distinct from 'e2100000-0000-0000-0000-000000000002'::uuid then
    raise exception 'field filter or restricted IDs were bypassed for fuzzy search; count %, data %', v_count, v_data;
  end if;

  select total_count into v_count
  from public.search_scholarships(
    p_search => 'enginering',
    p_fields => array['arts'],
    p_restrict_ids => array[
      'e2100000-0000-0000-0000-000000000002'::uuid,
      'e2100000-0000-0000-0000-000000000003'::uuid
    ],
    p_limit => 100
  );
  if v_count <> 0 then
    raise exception 'field filter was bypassed for fuzzy search; count %', v_count;
  end if;

  select total_count into v_count
  from public.search_scholarships(
    p_search => 'engineering access',
    p_fields => array['arts'],
    p_restrict_ids => array['e2100000-0000-0000-0000-000000000003'::uuid],
    p_limit => 100
  );
  if v_count <> 0 then
    raise exception 'field filter was bypassed for exact search; count %', v_count;
  end if;

  select total_count into v_count
  from public.search_scholarships(
    p_search => 'enginering',
    p_restrict_ids => array['e2100000-0000-0000-0000-000000000005'::uuid],
    p_limit => 100
  );
  if v_count <> 0 then
    raise exception 'fuzzy search returned a row outside p_restrict_ids; count %', v_count;
  end if;

  -- LIKE metacharacters are literal search input and cannot turn into match-all.
  select data, total_count into v_data, v_count
  from public.search_scholarships(
    p_search => '%',
    p_restrict_ids => array[
      'e2100000-0000-0000-0000-000000000001'::uuid,
      'e2100000-0000-0000-0000-000000000005'::uuid
    ],
    p_limit => 100
  );
  if v_count <> 1 or (v_data->0->>'id')::uuid is distinct from 'e2100000-0000-0000-0000-000000000005'::uuid then
    raise exception 'percent was treated as a wildcard; count %, data %', v_count, v_data;
  end if;

  select data, total_count into v_data, v_count
  from public.search_scholarships(
    p_search => '_',
    p_restrict_ids => array[
      'e2100000-0000-0000-0000-000000000001'::uuid,
      'e2100000-0000-0000-0000-000000000009'::uuid
    ],
    p_limit => 100
  );
  if v_count <> 1 or (v_data->0->>'id')::uuid is distinct from 'e2100000-0000-0000-0000-000000000009'::uuid then
    raise exception 'underscore was treated as a wildcard; count %, data %', v_count, v_data;
  end if;

  select total_count into v_count
  from public.search_scholarships(
    p_search => '!@#$^',
    p_restrict_ids => array[
      'e2100000-0000-0000-0000-000000000001'::uuid,
      'e2100000-0000-0000-0000-000000000002'::uuid,
      'e2100000-0000-0000-0000-000000000003'::uuid,
      'e2100000-0000-0000-0000-000000000004'::uuid,
      'e2100000-0000-0000-0000-000000000005'::uuid
    ],
    p_limit => 100
  );
  if v_count <> 0 then
    raise exception 'punctuation-only garbage unexpectedly matched rows; count %', v_count;
  end if;

  -- Search bounds reject rather than silently dropping trailing terms.
  select total_count into v_count
  from public.search_scholarships(
    p_search => 'harbor access award northstar foundation engineering access award missing',
    p_restrict_ids => array['e2100000-0000-0000-0000-000000000001'::uuid],
    p_limit => 100
  );
  if v_count <> 0 then
    raise exception 'query with more than eight terms was silently truncated; count %', v_count;
  end if;

  select total_count into v_count
  from public.search_scholarships(
    p_search => repeat('a', 201),
    p_restrict_ids => array['e2100000-0000-0000-0000-000000000001'::uuid],
    p_limit => 100
  );
  if v_count <> 0 then
    raise exception 'overlong query unexpectedly matched rows; count %', v_count;
  end if;

  -- Empty input retains browse behavior and a null restriction remains unrestricted.
  select total_count into v_null_count
  from public.search_scholarships(p_search => null, p_limit => 100);
  select total_count into v_empty_count
  from public.search_scholarships(p_search => '', p_limit => 100);
  if v_empty_count <> v_null_count then
    raise exception 'empty query changed browse count; null %, empty %', v_null_count, v_empty_count;
  end if;

  select total_count into v_whitespace_count
  from public.search_scholarships(p_search => E'\t \n', p_limit => 100);
  if v_whitespace_count <> v_null_count then
    raise exception 'whitespace-only query changed browse count; null %, whitespace %', v_null_count, v_whitespace_count;
  end if;

  select total_count into v_count
  from public.search_scholarships(p_search => null, p_restrict_ids => '{}'::uuid[], p_limit => 100);
  if v_count <> 0 then
    raise exception 'empty p_restrict_ids did not restrict browse results; count %', v_count;
  end if;

  -- Stable unique tie-breaker keeps adjacent pages disjoint and ordered.
  select (data->0->>'id')::uuid into v_fuzzy_first
  from public.search_scholarships(
    p_search => 'caatpage',
    p_restrict_ids => array[
      'e2100000-0000-0000-0000-000000000006'::uuid,
      'e2100000-0000-0000-0000-000000000007'::uuid,
      'e2100000-0000-0000-0000-000000000008'::uuid
    ],
    p_limit => 1, p_offset => 0
  );
  select (data->0->>'id')::uuid into v_fuzzy_second
  from public.search_scholarships(
    p_search => 'caatpage',
    p_restrict_ids => array[
      'e2100000-0000-0000-0000-000000000006'::uuid,
      'e2100000-0000-0000-0000-000000000007'::uuid,
      'e2100000-0000-0000-0000-000000000008'::uuid
    ],
    p_limit => 1, p_offset => 1
  );
  if v_fuzzy_first is distinct from 'e2100000-0000-0000-0000-000000000006'::uuid
     or v_fuzzy_second is distinct from 'e2100000-0000-0000-0000-000000000007'::uuid then
    raise exception 'page ordering is not stable by ID; page 1 %, page 2 %', v_fuzzy_first, v_fuzzy_second;
  end if;
end;
$$;

rollback;
