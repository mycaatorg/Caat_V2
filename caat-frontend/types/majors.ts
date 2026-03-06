export type MajorCategory =
  | 'Engineering'
  | 'Business'
  | 'Health Sciences'
  | 'Arts & Humanities'
  | 'Social Sciences'
  | 'Natural Sciences'
  | 'Education';

export interface Major {
  id: string;
  name: string;
  category: MajorCategory;
  description: string | null;
  career_paths: string[];
  typical_coursework: string[];
  qs_ranking_url: string | null;
  created_at: string;
}

// Row from the school_majors junction table, with school data joined in
export interface SchoolMajor {
  school_id: number;
  major_id: string;
  schools: {
    id: number;
    name: string;
    country: string | null;
    website: string | null;
  };
}

// Row from user_bookmarked_majors
export interface BookmarkedMajor {
  user_id: string;
  major_id: string;
  created_at: string;
}

// Major with the list of schools that offer it — used on the detail page
export interface MajorWithSchools extends Major {
  school_majors: SchoolMajor[];
}

// Major card data — used on the browse page (school list not needed)
export interface MajorCard extends Major {
  isBookmarked: boolean;
}
