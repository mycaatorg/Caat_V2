/** A specific university offering; UAC codes alone do not identify a degree. */
export type CourseOffering = {
  id: string;
  institution_key: string;
  institution_name: string;
  program_code: string;
  name: string;
  school_id: number | null;
  campus: string | null;
  duration: string | null;
  prerequisites: string | null;
  prerequisites_url: string | null;
  assumed_knowledge: string | null;
  fee_amount: number | null;
  fee_year: number | null;
  fee_category: string | null;
  fee_basis: string | null;
  application_route: string | null;
  application_url: string | null;
  uac_code: string | null;
  source_url: string;
  source_year: number | null;
  verified_at: string | null;
  active: boolean;
};
