-- PROD-244: reviewed link repairs only; never refresh award facts or verification dates.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $repair$
DECLARE
  targets constant jsonb := $targets$[
  {
    "id": "3835db76-b053-4eb6-b744-ea76423c8ed4",
    "source_id": "c2d4e6f8-1a3b-5c7d-9e0f-2b4c6d8e0f1a",
    "external_id": "UGTR1024",
    "title": "Douglas N Daft Exchange Award",
    "old_url": "https://www.scholarships.unsw.edu.au/scholarships/id/1899/7088#UGTR1024",
    "new_url": "https://www.scholarships.unsw.edu.au/scholarships/id/2001"
  },
  {
    "id": "3ad2ac6d-d122-46ca-9707-145d12c8a212",
    "source_id": "c2d4e6f8-1a3b-5c7d-9e0f-2b4c6d8e0f1a",
    "external_id": "PUCA1025",
    "title": "International Scientia Coursework Scholarship (PUCA1025)",
    "old_url": "https://www.scholarships.unsw.edu.au/scholarships/id/1957/7176#PUCA1025",
    "new_url": "https://www.scholarships.unsw.edu.au/scholarships/id/1988"
  },
  {
    "id": "4d16a3a3-09cb-44a6-8201-3b5790866563",
    "source_id": "c2d4e6f8-1a3b-5c7d-9e0f-2b4c6d8e0f1a",
    "external_id": "UGCE1411",
    "title": "Sanctuary Scholarship for People Seeking Asylum and Refugees with Temporary Protection",
    "old_url": "https://www.scholarships.unsw.edu.au/scholarships/id/1949/7160#UGCE1411",
    "new_url": "https://www.scholarships.unsw.edu.au/scholarships/id/1998"
  },
  {
    "id": "659dc264-f173-4c63-b617-c3537f7529d4",
    "source_id": "c2d4e6f8-1a3b-5c7d-9e0f-2b4c6d8e0f1a",
    "external_id": "UGTR1015",
    "title": "Alumni Exchange Award",
    "old_url": "https://www.scholarships.unsw.edu.au/scholarships/id/1899/7088#UGTR1015",
    "new_url": "https://www.scholarships.unsw.edu.au/scholarships/id/2001"
  },
  {
    "id": "6744034b-e373-4470-9695-685af96d81ad",
    "source_id": "c2d4e6f8-1a3b-5c7d-9e0f-2b4c6d8e0f1a",
    "external_id": "UGCE1534",
    "title": "HMJ Sassafras Scholarship",
    "old_url": "https://www.scholarships.unsw.edu.au/scholarships/id/1949/7160#UGCE1534",
    "new_url": "https://www.scholarships.unsw.edu.au/scholarships/id/1998"
  },
  {
    "id": "6bda616b-3573-4398-849c-62b9626f946f",
    "source_id": "c2d4e6f8-1a3b-5c7d-9e0f-2b4c6d8e0f1a",
    "external_id": "PUCA1023",
    "title": "UNSW Business School International Pathways Award (PUCA1023)",
    "old_url": "https://www.scholarships.unsw.edu.au/scholarships/id/1957/7176#PUCA1023",
    "new_url": "https://www.scholarships.unsw.edu.au/scholarships/id/1988"
  },
  {
    "id": "ae65cf7e-35d6-4f24-b668-05c0a742f1a1",
    "source_id": "c2d4e6f8-1a3b-5c7d-9e0f-2b4c6d8e0f1a",
    "external_id": "UGTR1049",
    "title": "UNSW Student Exchange Engineering Award",
    "old_url": "https://www.scholarships.unsw.edu.au/scholarships/id/1899/7088#UGTR1049",
    "new_url": "https://www.scholarships.unsw.edu.au/scholarships/id/2001"
  },
  {
    "id": "b0ff4b5f-2507-474b-a055-583aee2e4e34",
    "source_id": "c2d4e6f8-1a3b-5c7d-9e0f-2b4c6d8e0f1a",
    "external_id": "7186",
    "title": "Kevin Rice Memorial Endowed Travel Award",
    "old_url": "https://www.scholarships.unsw.edu.au/scholarships/id/1932/7186",
    "new_url": "https://www.scholarships.unsw.edu.au/scholarships/id/1932"
  },
  {
    "id": "bbca550f-9c59-4284-96ef-54f17edb5dd1",
    "source_id": "c2d4e6f8-1a3b-5c7d-9e0f-2b4c6d8e0f1a",
    "external_id": "UGTR1044",
    "title": "RC Sutton/ Jardine Matheson Scholarship",
    "old_url": "https://www.scholarships.unsw.edu.au/scholarships/id/1899/7088#UGTR1044",
    "new_url": "https://www.scholarships.unsw.edu.au/scholarships/id/2001"
  },
  {
    "id": "cac9c569-26db-407a-a4fe-e77a29f5a4a4",
    "source_id": "c2d4e6f8-1a3b-5c7d-9e0f-2b4c6d8e0f1a",
    "external_id": "7191",
    "title": "UNSW Co-op Program",
    "old_url": "https://www.scholarships.unsw.edu.au/scholarships/id/126/7191",
    "new_url": "https://www.scholarships.unsw.edu.au/scholarships/id/126"
  },
  {
    "id": "dad0a60b-49d8-4a26-9e96-3872dd513f2a",
    "source_id": "c2d4e6f8-1a3b-5c7d-9e0f-2b4c6d8e0f1a",
    "external_id": "UGTR1011",
    "title": "Vincent Lo Award",
    "old_url": "https://www.scholarships.unsw.edu.au/scholarships/id/1899/7088#UGTR1011",
    "new_url": "https://www.scholarships.unsw.edu.au/scholarships/id/2001"
  },
  {
    "id": "db4e457c-e0b1-4d1b-9264-2fcb5818ddb0",
    "source_id": "c2d4e6f8-1a3b-5c7d-9e0f-2b4c6d8e0f1a",
    "external_id": "UGTR1012",
    "title": "Harry Manson Award",
    "old_url": "https://www.scholarships.unsw.edu.au/scholarships/id/1899/7088#UGTR1012",
    "new_url": "https://www.scholarships.unsw.edu.au/scholarships/id/2001"
  },
  {
    "id": "ec0d9d58-0d9e-465f-9475-d754714bb149",
    "source_id": "c2d4e6f8-1a3b-5c7d-9e0f-2b4c6d8e0f1a",
    "external_id": "PUCA1024",
    "title": "UNSW Business School International Scholarship (PUCA1024)",
    "old_url": "https://www.scholarships.unsw.edu.au/scholarships/id/1957/7176#PUCA1024",
    "new_url": "https://www.scholarships.unsw.edu.au/scholarships/id/1988"
  },
  {
    "id": "ecc070ac-154f-45bc-9e25-03dee13a0770",
    "source_id": "c2d4e6f8-1a3b-5c7d-9e0f-2b4c6d8e0f1a",
    "external_id": "PUCA1028",
    "title": "UNSW Law & Justice International Award (PUCA1028)",
    "old_url": "https://www.scholarships.unsw.edu.au/scholarships/id/1957/7176#PUCA1028",
    "new_url": "https://www.scholarships.unsw.edu.au/scholarships/id/1988"
  },
  {
    "id": "f52ae18d-1773-4638-b46c-38f4387cc142",
    "source_id": "c2d4e6f8-1a3b-5c7d-9e0f-2b4c6d8e0f1a",
    "external_id": "UGTR1052",
    "title": "UNSW Business School BCom (International) Exchange Travel Award",
    "old_url": "https://www.scholarships.unsw.edu.au/scholarships/id/1899/7088#UGTR1052",
    "new_url": "https://www.scholarships.unsw.edu.au/scholarships/id/2001"
  },
  {
    "id": "fafbd473-fd18-4979-88d8-130e87f33b7b",
    "source_id": "c2d4e6f8-1a3b-5c7d-9e0f-2b4c6d8e0f1a",
    "external_id": "7185",
    "title": "Ronald Lu Travel Award in Architecture",
    "old_url": "https://www.scholarships.unsw.edu.au/scholarships/id/1081/7185",
    "new_url": "https://www.scholarships.unsw.edu.au/scholarships/id/1081"
  },
  {
    "id": "fc85b19c-a5ca-4f45-bfb5-873a28a37bc0",
    "source_id": "c2d4e6f8-1a3b-5c7d-9e0f-2b4c6d8e0f1a",
    "external_id": "7115",
    "title": "The Harvard Travel Award",
    "old_url": "https://www.scholarships.unsw.edu.au/scholarships/id/632/7115",
    "new_url": "https://www.scholarships.unsw.edu.au/scholarships/id/632"
  }
]$targets$::jsonb;
  item jsonb;
  current_row public.scholarships%ROWTYPE;
  duplicate_row public.scholarships%ROWTYPE;
  canonical_row public.scholarships%ROWTYPE;
  has_duplicate boolean;
BEGIN
  -- Lock and validate the complete target set before changing any row.
  FOR item IN SELECT value FROM jsonb_array_elements(targets) ORDER BY value->>'id' LOOP
    SELECT * INTO current_row FROM public.scholarships WHERE id=(item->>'id')::uuid FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF; -- Fresh isolated databases have no production records.
    IF current_row.source_id IS DISTINCT FROM (item->>'source_id')::uuid
       OR current_row.external_id IS DISTINCT FROM item->>'external_id'
       OR current_row.title IS DISTINCT FROM item->>'title'
       OR current_row.is_active IS DISTINCT FROM true
       OR current_row.external_url IS NULL
       OR current_row.external_url NOT IN (item->>'old_url',item->>'new_url')
       OR (current_row.raw_payload IS NOT NULL AND jsonb_typeof(current_row.raw_payload)<>'object') THEN
      RAISE EXCEPTION 'PROD-244 source identity drift for %',item->>'id';
    END IF;
  END LOOP;

  SELECT * INTO duplicate_row FROM public.scholarships WHERE id='a240b417-79d7-4241-9e08-d63bf1eba668'::uuid FOR UPDATE;
  has_duplicate := FOUND;
  IF has_duplicate THEN
    SELECT * INTO canonical_row FROM public.scholarships WHERE id='d95e6c88-ef41-4ea1-913c-2306fc405200'::uuid FOR UPDATE;
    IF NOT FOUND OR canonical_row.source_id IS DISTINCT FROM 'c2d4e6f8-1a3b-5c7d-9e0f-2b4c6d8e0f1a'::uuid
       OR canonical_row.external_id IS DISTINCT FROM '744'
       OR canonical_row.title IS DISTINCT FROM 'John Monash Scholarship'
       OR canonical_row.external_url IS DISTINCT FROM 'https://www.scholarships.unsw.edu.au/scholarships/id/744'
       OR canonical_row.is_active IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'PROD-244 active canonical John Monash record is missing or changed';
    END IF;
    IF duplicate_row.source_id IS DISTINCT FROM 'c2d4e6f8-1a3b-5c7d-9e0f-2b4c6d8e0f1a'::uuid
       OR duplicate_row.external_id IS DISTINCT FROM '1969'
       OR md5(duplicate_row.description) IS DISTINCT FROM '0ed8bd6ea6609f05e52fbdc37aa68396'
       OR duplicate_row.amount_value IS DISTINCT FROM 100000::numeric
       OR (duplicate_row.raw_payload IS NOT NULL AND jsonb_typeof(duplicate_row.raw_payload)<>'object')
       OR (
         (duplicate_row.title='TEST11' AND duplicate_row.external_url='https://www.scholarships.unsw.edu.au/scholarships/id/1969' AND duplicate_row.is_active)
         OR (duplicate_row.title='John Monash Scholarship' AND duplicate_row.external_url='https://www.scholarships.unsw.edu.au/scholarships/id/744'
             AND NOT duplicate_row.is_active AND duplicate_row.raw_payload->'catalogue_repair'->>'issue'='PROD-244'
             AND duplicate_row.raw_payload->'catalogue_repair'->>'canonical_id'='d95e6c88-ef41-4ea1-913c-2306fc405200')
       ) IS NOT TRUE THEN
      RAISE EXCEPTION 'PROD-244 duplicate identity drift';
    END IF;
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(targets) LOOP
    UPDATE public.scholarships
       SET external_url=item->>'new_url',
           raw_payload=coalesce(raw_payload,'{}'::jsonb) || jsonb_build_object('source_url_repair',jsonb_build_object(
             'issue','PROD-244','previous_url',item->>'old_url','replacement_url',item->>'new_url',
             'reason','Exact award identity confirmed on official replacement source; award fields not re-verified'))
     WHERE id=(item->>'id')::uuid AND external_url=item->>'old_url';
  END LOOP;
  IF has_duplicate THEN
    UPDATE public.scholarships
       SET title='John Monash Scholarship',external_url='https://www.scholarships.unsw.edu.au/scholarships/id/744',is_active=false,
           raw_payload=coalesce(raw_payload,'{}'::jsonb) || jsonb_build_object('catalogue_repair',jsonb_build_object(
             'issue','PROD-244','canonical_id','d95e6c88-ef41-4ea1-913c-2306fc405200',
             'previous_title','TEST11','previous_url','https://www.scholarships.unsw.edu.au/scholarships/id/1969',
             'reason','Duplicate imported record of the existing John Monash award; retained for saved records'))
     WHERE id='a240b417-79d7-4241-9e08-d63bf1eba668'::uuid AND title='TEST11' AND is_active;
  END IF;
END;
$repair$;
COMMIT;
