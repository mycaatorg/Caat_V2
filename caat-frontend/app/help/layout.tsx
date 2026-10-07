import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Help Centre",
  description: "Answers to common questions about using CAAT to plan for Australian universities and keep applications, essays, scholarships, and documents organised.",
};

export default function HelpLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
