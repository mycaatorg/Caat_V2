export type SectionType = 'personal' | 'education' | 'experience' | 'projects' | 'skills' | 'custom';
export type EditMode = 'template' | 'free';

export interface Section {
  id: string;
  type: SectionType;
  label: string;
  mode: EditMode;
  content: string; // TipTap HTML (used in free mode)
  hidden: boolean;
  structuredData: Record<string, any>; // Used in template mode
}

export interface ResumeDoc {
  id: string;
  title: string;
  templateId: string;
  paperSize: 'A4' | 'LETTER';
  professionalMode: boolean;
  zoom: number;
  sections: Section[];
}
