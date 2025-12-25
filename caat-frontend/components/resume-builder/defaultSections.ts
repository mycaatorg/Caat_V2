import { ResumeSection } from "./types";

export function getDefaultSections(): ResumeSection[] {
  return [
    {
      id: "personal",
      type: "personal",
      label: "Personal Information",
      mode: "guided",
      contentHtml: "",
      structuredData: {
        fullName: "",
        email: "",
        phone: "",
        linkedin: "",
        location: "",
      },
    },
    {
      id: "education",
      type: "education",
      label: "Education",
      mode: "free",
      contentHtml: "",
    },
    {
      id: "experience",
      type: "experience",
      label: "Experience",
      mode: "free",
      contentHtml: "",
    },
    {
      id: "skills",
      type: "skills",
      label: "Skills & Interests",
      mode: "free",
      contentHtml: "",
    },
  ];
}
