import { ResumeSection } from "./types";

export function getDefaultSections(): ResumeSection[] {
  return [
    {
      id: crypto.randomUUID(),
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
      id: crypto.randomUUID(),
      type: "education",
      label: "Education",
      mode: "free",
      contentHtml: "",
    },
    {
      id: crypto.randomUUID(),
      type: "experience",
      label: "Experience",
      mode: "free",
      contentHtml: "",
    },
    {
      id: crypto.randomUUID(),
      type: "skills",
      label: "Skills & Interests",
      mode: "free",
      contentHtml: "",
    },
  ];
}
