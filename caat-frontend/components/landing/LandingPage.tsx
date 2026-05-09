import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  LayoutGrid,
  Pencil,
  Lock,
  Shield,
  BookOpen,
  FileText,
  Check,
  CheckCircle2,
  Circle,
  GraduationCap,
  Award,
  FolderOpen,
  Search,
  Bookmark,
  ChevronDown,
  Clock,
} from "lucide-react";
import Navbar from "./Navbar";
import { FeaturePreviewCarousel } from "./FeaturePreviewCarousel";

// ─── Shared texture overlays ─────────────────────────────────────────────────

function LinesTexture() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage:
          "repeating-linear-gradient(0deg,transparent,transparent 1px,#000 1px,#000 2px)",
        backgroundSize: "100% 4px",
        opacity: 0.015,
      }}
    />
  );
}

function GridTexture() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage:
          "linear-gradient(#00000008 1px,transparent 1px),linear-gradient(90deg,#00000008 1px,transparent 1px)",
        backgroundSize: "40px 40px",
      }}
    />
  );
}

function DiagonalTexture() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage:
          "repeating-linear-gradient(45deg,transparent,transparent 40px,#00000008 40px,#00000008 42px)",
      }}
    />
  );
}

function WhiteVerticalTexture() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage:
          "repeating-linear-gradient(90deg,transparent,transparent 1px,#fff 1px,#fff 2px)",
        backgroundSize: "4px 100%",
        opacity: 0.03,
      }}
    />
  );
}

// ─── Section rule ─────────────────────────────────────────────────────────────

function ThickRule() {
  return <div className="h-[4px] bg-black" aria-hidden />;
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="pt-16 relative overflow-hidden bg-white">
      <LinesTexture />
      <div className="relative max-w-6xl mx-auto px-6 lg:px-12 py-24 md:py-32 lg:py-40">
        <div className="grid lg:grid-cols-[55%_45%] gap-12 lg:gap-8 items-center">
          {/* Left content */}
          <div className="space-y-8">
            {/* Badge */}
            <div className="inline-block border border-black px-4 py-2">
              <span className="text-[11px] tracking-[0.18em] uppercase font-code text-black">
                Your Future, Curated
              </span>
            </div>

            {/* Headline */}
            <h1 className="font-display font-bold leading-none tracking-tight">
              <span className="block text-4xl md:text-5xl lg:text-[3.75rem] text-black">
                Master Your Path to
              </span>
              <span
                className="block text-[4.5rem] md:text-[6rem] lg:text-[7.5rem] italic"
                style={{
                  color: "#9a1a27",
                  textDecoration: "underline",
                  textDecorationColor: "#9a1a27",
                  textDecorationThickness: "5px",
                  textUnderlineOffset: "10px",
                }}
              >
                University
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg text-[#525252] leading-relaxed max-w-lg font-serif">
              Organize deadlines, essays, and documents in one intelligent
              platform. Stop juggling spreadsheets and start focusing on what
              matters.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 bg-[#9a1a27] text-white text-[11px] tracking-[0.18em] uppercase px-8 py-4 border border-[#9a1a27] hover:bg-white hover:text-[#9a1a27] transition-colors duration-100 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#9a1a27] focus-visible:outline-offset-[3px] font-code"
              >
                Get Started for Free
                <ArrowRight size={14} strokeWidth={1.5} />
              </Link>
              {/* <button
                type="button"
                className="inline-flex items-center justify-center gap-2 bg-transparent text-black text-[11px] tracking-[0.18em] uppercase px-8 py-4 border-2 border-black hover:bg-black hover:text-white transition-colors duration-100 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-black focus-visible:outline-offset-[3px] font-code"
              >
                <Play size={12} strokeWidth={1.5} />
                Watch Demo
              </button> */}
            </div>

            {/* Early release note */}
            <p className="text-sm text-[#525252] font-serif pt-2">
              Be part of the{" "}
              <strong className="text-black font-bold">early release</strong>{" "}
              and get in before everyone else.
            </p>
          </div>

          {/* Right: Dashboard preview — mirrors real /dashboard layout */}
          <div className="hidden lg:flex items-center justify-center relative">
            {/* Shadow layer (offset duplicate) */}
            <div
              className="absolute border border-[#E5E5E5] bg-[#F5F5F5] w-full max-w-[400px]"
              style={{
                transform: "rotate(-1deg) translate(10px, 10px)",
                height: "460px",
              }}
              aria-hidden
            />
            {/* Main mockup */}
            <div
              className="relative w-full max-w-[400px] border-2 border-black bg-white"
              style={{ transform: "rotate(-2.5deg)" }}
            >
              {/* Mockup titlebar */}
              <div className="border-b-2 border-black bg-black text-white px-4 py-3 flex items-center justify-between">
                <span className="text-xs tracking-[0.15em] uppercase font-display font-bold">
                  CAAT Dashboard
                </span>
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-2.5 h-2.5 border border-white"
                      aria-hidden
                    />
                  ))}
                </div>
              </div>

              {/* Mockup body */}
              <div className="p-5 space-y-4">
                {/* Greeting — matches DashboardShell */}
                <div>
                  <div className="font-display font-bold text-base text-black">
                    Good evening, Alex!
                  </div>
                  <div className="text-[11px] text-[#525252] mt-0.5 font-serif">
                    Here&apos;s an overview of your admissions journey.
                  </div>
                </div>

                {/* Application Readiness — matches ApplicationReadiness component */}
                <div className="border border-black p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[11px] tracking-[0.12em] uppercase font-code font-bold">
                      Application Readiness
                    </div>
                    <div
                      className="text-[10px] font-code font-bold px-2 py-0.5 text-white"
                      style={{ backgroundColor: "#9a1a27" }}
                    >
                      40%
                    </div>
                  </div>
                  <div className="text-[10px] text-[#525252] font-serif mb-2.5">
                    4 of 10 steps completed
                  </div>
                  <div className="h-[3px] bg-[#E5E5E5] mb-3">
                    <div
                      className="h-full"
                      style={{ width: "40%", backgroundColor: "#9a1a27" }}
                    />
                  </div>

                  {/* Step pills (mirrors real 3-col grid, condensed to 2-col for the mockup) */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { label: "Profile", done: true },
                      { label: "Schools", done: true },
                      { label: "Majors", done: true },
                      { label: "Applications", done: true },
                      { label: "Resume", done: false },
                      { label: "Essays", done: false },
                    ].map((s) => (
                      <div
                        key={s.label}
                        className={`flex items-center gap-1.5 border px-2 py-1 ${
                          s.done
                            ? "border-transparent bg-[#F5F5F5]"
                            : "border-[#E5E5E5]"
                        }`}
                      >
                        {s.done ? (
                          <CheckCircle2
                            size={11}
                            strokeWidth={2}
                            className="flex-shrink-0"
                            style={{ color: "#16a34a" }}
                          />
                        ) : (
                          <Circle
                            size={11}
                            strokeWidth={1.5}
                            className="text-[#888] flex-shrink-0"
                          />
                        )}
                        <span
                          className={`text-[10px] font-serif font-medium truncate ${
                            s.done ? "text-[#888] line-through" : "text-black"
                          }`}
                        >
                          {s.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Upcoming Deadlines — matches UpcomingDeadlinesWidget */}
                <div className="border border-black p-3.5">
                  <div className="text-[11px] tracking-[0.12em] uppercase font-code font-bold mb-2.5">
                    Upcoming Deadlines
                  </div>
                  <div className="space-y-1.5">
                    {[
                      {
                        label: "Stanford University",
                        type: "Application",
                        days: "3d",
                        dotClass: "",
                        dotStyle: { backgroundColor: "#9a1a27" },
                        countdownClass: "",
                        countdownStyle: { color: "#9a1a27" },
                      },
                      {
                        label: "Gates Scholarship",
                        type: "Scholarship",
                        days: "12d",
                        dotClass: "bg-amber-500",
                        countdownClass: "text-amber-600",
                      },
                      {
                        label: "Yale University",
                        type: "Application",
                        days: "45d",
                        dotClass: "",
                        dotStyle: { backgroundColor: "#16a34a" },
                        countdownClass: "",
                        countdownStyle: { color: "#16a34a" },
                      },
                    ].map((d) => (
                      <div
                        key={d.label}
                        className="flex items-center gap-2.5 py-1"
                      >
                        <span
                          className={`h-2 w-2 flex-shrink-0 ${d.dotClass}`}
                          style={d.dotStyle}
                          aria-hidden
                        />
                        <span className="flex-1 min-w-0 truncate text-[11px] font-serif font-medium">
                          {d.label}
                        </span>
                        <span className="text-[9px] text-[#888] font-code flex-shrink-0">
                          {d.type}
                        </span>
                        <span
                          className={`text-[10px] font-code font-bold tabular-nums flex-shrink-0 ${d.countdownClass}`}
                          style={d.countdownStyle}
                        >
                          {d.days}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Features Grid ────────────────────────────────────────────────────────────

function FeaturesGrid() {
  const features = [
    {
      icon: <LayoutGrid size={20} strokeWidth={1.5} />,
      title: "Dashboard",
      description:
        "See your application progress, to-do list, bookmarked schools and majors, upcoming deadlines, and calendar at a glance. Drag and resize widgets to lay it out your way.",
      previewImage: "/feature-previews/dashboard.png",
    },
    {
      icon: <CheckCircle2 size={20} strokeWidth={1.5} />,
      title: "Application Tracker",
      description:
        "Manage every application, deadline, and requirement from a single unified dashboard. Status updates, progress bars, and task checklists in one view.",
      previewImage: "/feature-previews/application-tracker.png",
    },
    {
      icon: <GraduationCap size={20} strokeWidth={1.5} />,
      title: "School Search",
      description:
        "Browse 10,000+ universities worldwide. Compare acceptance rates, deadlines, tuition, and requirements side by side to build your perfect list.",
      previewImage: "/feature-previews/school-search.png",
    },
    {
      icon: <Pencil size={20} strokeWidth={1.5} />,
      title: "Essay Workshop",
      description:
        "Interactive prompts guide you from blank page to polished draft. Version history keeps every revision, and built-in feedback helps you refine.",
      previewImage: "/feature-previews/essay-workshop.png",
    },
    {
      icon: <Award size={20} strokeWidth={1.5} />,
      title: "Scholarship Finder",
      description:
        "AI-powered matching surfaces scholarships tailored to your profile, field of study, and background. Track applications and deadlines in one place.",
      previewImage: "/feature-previews/scholarship-finder.png",
    },
    {
      icon: <FileText size={20} strokeWidth={1.5} />,
      title: "Resume Builder",
      description:
        "Guided templates walk you through activities, awards, and achievements. Export a polished resume formatted the way admissions offices expect.",
      previewImage: "/feature-previews/resume-builder.png",
    },
    {
      icon: <FolderOpen size={20} strokeWidth={1.5} />,
      title: "Document Vault",
      description:
        "Upload transcripts, recommendation letters, and test scores to secure encrypted storage. Share access links directly with institutions.",
      previewImage: "/feature-previews/document-vault.png",
    },
    {
      icon: <Lock size={20} strokeWidth={1.5} />,
      title: "Secure by Default",
      description:
        "Every file and form is encrypted, and we run on SOC2-certified infrastructure. Only you can see what you put in.",
      disablePreview: true,
    },
  ];

  return (
    <section
      id="features"
      className="relative py-24 md:py-32 lg:py-40 bg-white"
    >
      <LinesTexture />
      <div className="relative max-w-6xl mx-auto px-6 lg:px-12">
        {/* Section header */}
        <div className="text-center mb-16 md:mb-20">
          <p className="text-[11px] tracking-[0.18em] uppercase text-[#525252] mb-5 font-code">
            Platform
          </p>
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-none mb-6 font-display">
            Built Around Your{" "}
            <span className="italic" style={{ color: "#9a1a27" }}>
              Application
            </span>
          </h2>
          <p className="text-lg text-[#525252] max-w-xl mx-auto font-serif">
            All the tools you need to actually get through the college
            application process, in one place.
          </p>
        </div>

        {/* Scrollable cards. Vertical wheel scroll is converted to horizontal
            scroll while the cursor is over the container. Click any card to
            open a preview popup of the feature. */}
        <FeaturePreviewCarousel features={features} />

        {/* Scroll hint */}
        <p className="text-[11px] tracking-[0.12em] uppercase font-code text-[#BFBFBF] mt-4 text-right">
          Scroll to explore →
        </p>
      </div>
    </section>
  );
}

// ─── Product Showcase ─────────────────────────────────────────────────────────

function ProductShowcase() {
  return (
    <section className="relative py-24 md:py-32 lg:py-40 bg-white">
      <GridTexture />
      <div className="relative max-w-6xl mx-auto px-6 lg:px-12">
        {/* Header */}
        <div className="mb-12 md:mb-16">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05] mb-5 font-display">
            Designed to{" "}
            <span className="italic" style={{ color: "#9a1a27" }}>
              simplify
            </span>
            <br />
            the complicated.
          </h2>
          <p className="text-lg text-[#525252] max-w-lg font-serif">
            Powerful tools built around how you actually think: organized,
            clear, and always one step ahead.
          </p>
        </div>

        {/* Two cards */}
        <div className="grid md:grid-cols-2 border border-black">
          {/* Application Tracker */}
          <div className="p-8 lg:p-10 border-b md:border-b-0 md:border-r border-black">
            <p className="text-[10px] tracking-[0.18em] uppercase text-[#525252] mb-7 font-code">
              Application Tracker
            </p>

            <div className="border border-black p-5 mb-5">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="font-bold font-display text-lg">
                    Stanford University
                  </div>
                  <div className="text-[11px] text-[#525252] mt-0.5 font-code">
                    Deadline: Jan 2, 2026
                  </div>
                </div>
                <div
                  className="text-[10px] tracking-wide px-2.5 py-1 flex-shrink-0 font-code"
                  style={{
                    border: "1px solid #16a34a",
                    color: "#16a34a",
                  }}
                >
                  In Progress
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-[#525252]">
                  <span className="font-serif">Overall Progress</span>
                  <span
                    className="font-code font-bold"
                    style={{ color: "#9a1a27" }}
                  >
                    75%
                  </span>
                </div>
                <div className="h-1.5 bg-[#E5E5E5]">
                  <div
                    className="h-full"
                    style={{ width: "75%", backgroundColor: "#9a1a27" }}
                  />
                </div>
              </div>
            </div>

            {/* Checklist */}
            <div className="space-y-3">
              {[
                { label: "Personal Statement", done: true },
                { label: "Supplemental Essays", done: true },
                { label: "Recommendations", done: false },
                { label: "Test Scores Submitted", done: false },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <div
                    className={`w-4 h-4 border flex items-center justify-center flex-shrink-0 ${
                      item.done ? "bg-black border-black" : "border-[#525252]"
                    }`}
                  >
                    {item.done && (
                      <Check size={9} strokeWidth={3} className="text-white" />
                    )}
                  </div>
                  <span
                    className={`text-sm font-serif ${
                      item.done ? "line-through text-[#525252]" : ""
                    }`}
                  >
                    {item.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Divider — full-bleed hairline rule between sub-features */}
            <div className="-mx-8 lg:-mx-10 h-px bg-black my-10" aria-hidden />

            {/* School Search — mirrors /schools page */}
            <p className="text-[10px] tracking-[0.18em] uppercase text-[#525252] mb-5 font-code">
              School Search
            </p>

            {/* Search input + country filter row */}
            <div className="flex gap-2 mb-4">
              <div className="flex-1 border border-black flex items-center gap-2 px-3 py-2.5">
                <Search
                  size={13}
                  strokeWidth={1.5}
                  className="text-[#525252] flex-shrink-0"
                />
                <span className="text-xs font-serif">Stanford</span>
                <span
                  className="ml-auto w-px h-3 bg-black inline-block"
                  aria-hidden
                  style={{
                    animation: "caret-blink 1s steps(2) infinite",
                  }}
                />
              </div>
              <div className="border border-black flex items-center gap-2 px-3 py-2.5">
                <span className="text-[10px] tracking-[0.1em] uppercase font-code">
                  USA
                </span>
                <ChevronDown size={11} strokeWidth={1.5} />
              </div>
            </div>

            {/* Results count */}
            <div className="text-[11px] text-[#525252] font-serif mb-3">
              Showing <span className="font-bold text-black">3 results</span> in{" "}
              <span className="font-bold text-black">United States</span>
            </div>

            {/* Result rows */}
            <div className="border border-black divide-y divide-black">
              {[
                {
                  name: "Stanford University",
                  country: "United States",
                  bookmarked: true,
                },
                {
                  name: "Stanford Online High School",
                  country: "United States",
                  bookmarked: false,
                },
                {
                  name: "Stanford Graduate School",
                  country: "United States",
                  bookmarked: false,
                },
              ].map((school) => (
                <div
                  key={school.name}
                  className="flex items-center gap-3 px-3 py-2.5"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-serif font-medium truncate">
                      {school.name}
                    </div>
                    <div className="text-[10px] text-[#525252] font-code mt-0.5">
                      {school.country}
                    </div>
                  </div>
                  <Bookmark
                    size={14}
                    strokeWidth={1.5}
                    className="flex-shrink-0"
                    fill={school.bookmarked ? "#9a1a27" : "none"}
                    stroke={school.bookmarked ? "#9a1a27" : "#525252"}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Resume Builder — matches the white card theme of the rest of the section */}
          <div className="p-8 lg:p-10 bg-white text-black">
            <p className="text-[10px] tracking-[0.18em] uppercase text-[#525252] mb-7 font-code">
              Resume Builder
            </p>

            <p className="text-lg mb-8 leading-relaxed font-serif text-[#525252]">
              Guided sections walk you through every detail. The live A4 preview
              updates as you type — print-ready, the way admissions offices
              expect.
            </p>

            {/* Section nav — mirrors DocumentStructurePanel */}
            <div className="flex flex-wrap gap-1.5 mb-7">
              {[
                { label: "Personal", active: false },
                { label: "Education", active: true },
                { label: "Experience", active: false },
                { label: "Skills & Interests", active: false },
              ].map((s) => (
                <span
                  key={s.label}
                  className={`text-[10px] tracking-[0.1em] uppercase font-code px-2.5 py-1 border ${
                    s.active
                      ? "text-white border-transparent"
                      : "border-[#E5E5E5] text-[#525252]"
                  }`}
                  style={s.active ? { backgroundColor: "#9a1a27" } : undefined}
                >
                  {s.label}
                </span>
              ))}
            </div>

            {/* Mini A4 preview — sits as white "paper" with a soft offset shadow */}
            <div className="relative mb-8">
              {/* Shadow paper */}
              <div
                aria-hidden
                className="absolute bg-[#F5F5F5] border border-[#E5E5E5]"
                style={{
                  width: "85%",
                  height: "100%",
                  right: 0,
                  top: 8,
                  transform: "rotate(2deg)",
                  zIndex: 0,
                }}
              />
              {/* Front A4 paper */}
              <div
                className="relative bg-white text-black mx-auto border border-black"
                style={{
                  width: "100%",
                  maxWidth: "320px",
                  aspectRatio: "210 / 297",
                  padding: "22px 24px",
                  transform: "rotate(-1deg)",
                  zIndex: 1,
                }}
              >
                {/* Personal header — centered, matches ResumePage */}
                <div className="text-center">
                  <div
                    className="font-bold font-display"
                    style={{
                      fontSize: "18px",
                      letterSpacing: "0.05em",
                      lineHeight: 1.2,
                    }}
                  >
                    ALEX JOHNSON
                  </div>
                  <div
                    className="font-serif"
                    style={{
                      marginTop: 4,
                      fontSize: "8px",
                      color: "#666",
                      lineHeight: 1.4,
                    }}
                  >
                    alex.johnson@email.com · Boston, MA · linkedin.com/in/alex
                  </div>
                </div>

                {/* Education */}
                <div style={{ marginTop: 18 }}>
                  <div
                    className="font-bold font-display"
                    style={{
                      fontSize: "9px",
                      letterSpacing: "0.12em",
                    }}
                  >
                    EDUCATION
                  </div>
                  <hr
                    style={{
                      marginTop: 3,
                      marginBottom: 6,
                      border: "none",
                      borderTop: "2px solid #000",
                    }}
                  />
                  <div
                    className="font-serif"
                    style={{ fontSize: "8.5px", lineHeight: 1.45 }}
                  >
                    <div className="font-bold">Boston Latin School</div>
                    <div style={{ color: "#666" }}>
                      GPA 3.98 / 4.00 · Class of 2026
                    </div>
                    <div style={{ color: "#666", marginTop: 2 }}>
                      AP Capstone · National Merit Finalist
                    </div>
                  </div>
                </div>

                {/* Experience */}
                <div style={{ marginTop: 14 }}>
                  <div
                    className="font-bold font-display"
                    style={{
                      fontSize: "9px",
                      letterSpacing: "0.12em",
                    }}
                  >
                    EXPERIENCE
                  </div>
                  <hr
                    style={{
                      marginTop: 3,
                      marginBottom: 6,
                      border: "none",
                      borderTop: "2px solid #000",
                    }}
                  />
                  <div
                    className="font-serif"
                    style={{ fontSize: "8.5px", lineHeight: 1.45 }}
                  >
                    <div className="flex justify-between items-baseline">
                      <span className="font-bold">
                        Research Intern, MIT Media Lab
                      </span>
                      <span style={{ color: "#666", fontSize: "7.5px" }}>
                        2025
                      </span>
                    </div>
                    <ul
                      style={{
                        margin: "2px 0 0 12px",
                        padding: 0,
                        color: "#666",
                      }}
                    >
                      <li style={{ marginBottom: 1 }}>
                        Built ML pipeline analyzing 50k+ student records
                      </li>
                      <li>Co-authored paper accepted at NeurIPS workshop</li>
                    </ul>
                  </div>
                </div>

                {/* Skills */}
                <div style={{ marginTop: 14 }}>
                  <div
                    className="font-bold font-display"
                    style={{
                      fontSize: "9px",
                      letterSpacing: "0.12em",
                    }}
                  >
                    SKILLS &amp; INTERESTS
                  </div>
                  <hr
                    style={{
                      marginTop: 3,
                      marginBottom: 6,
                      border: "none",
                      borderTop: "2px solid #000",
                    }}
                  />
                  <div
                    className="font-serif"
                    style={{
                      fontSize: "8.5px",
                      color: "#666",
                      lineHeight: 1.45,
                    }}
                  >
                    Python, TypeScript, React · Debate, Robotics, Piano
                  </div>
                </div>
              </div>
            </div>

            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-[#9a1a27] text-white text-[11px] tracking-[0.18em] uppercase px-6 py-3.5 border border-[#9a1a27] hover:bg-white hover:text-[#9a1a27] transition-colors duration-100 font-code focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#9a1a27] focus-visible:outline-offset-[3px]"
            >
              Build Your Resume
              <ArrowRight size={13} strokeWidth={1.5} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── More Features ────────────────────────────────────────────────────────────

function MoreFeatures() {
  return (
    <section className="relative py-24 md:py-32 lg:py-40 bg-white">
      <LinesTexture />
      <div className="relative max-w-6xl mx-auto px-6 lg:px-12">
        <div className="grid md:grid-cols-2 border border-black">
          {/* Essay Workshop */}
          <div className="p-8 lg:p-10 border-b md:border-b-0 md:border-r border-black">
            <div className="w-10 h-10 border border-black flex items-center justify-center mb-6">
              <BookOpen size={17} strokeWidth={1.5} />
            </div>
            <h3 className="text-2xl font-bold mb-4 font-display">
              Essay Workshop
            </h3>
            <p className="text-[#525252] leading-relaxed mb-8 font-serif">
              Interactive prompts guide your writing process from blank page to
              polished draft. Version tracking ensures you never lose your best
              work. Refine with AI feedback and expert suggestions.
            </p>

            {/* Decorative content lines */}
            <div className="space-y-2.5">
              {[92, 78, 86, 64, 80].map((w, i) => (
                <div
                  key={i}
                  className="h-[3px] bg-[#E5E5E5]"
                  style={{ width: `${w}%` }}
                />
              ))}
            </div>
          </div>

          {/* Scholarship Finder */}
          <div className="p-8 lg:p-10">
            <div className="w-10 h-10 border border-black flex items-center justify-center mb-6">
              <Award size={17} strokeWidth={1.5} />
            </div>
            <h3 className="text-2xl font-bold mb-4 font-display">
              Scholarship Finder
            </h3>
            <p className="text-[#525252] leading-relaxed mb-6 font-serif">
              AI-powered matching surfaces scholarships tailored to your
              profile, field of study, and background. Bookmark, track
              deadlines, and apply — all in one place.
            </p>
            <Link
              href="/signup"
              className="text-sm font-medium hover:underline tracking-wide inline-flex items-center gap-1.5 mb-10 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-black focus-visible:outline-offset-2"
            >
              Find Scholarships <ArrowRight size={13} strokeWidth={1.5} />
            </Link>

            {/* Scholarship match cards stack */}
            <div className="relative mt-2 h-28">
              {/* Back layer */}
              <div
                className="absolute border border-[#E5E5E5] bg-[#F5F5F5] p-3 text-xs"
                style={{
                  width: "82%",
                  right: 0,
                  top: 4,
                  transform: "rotate(3.5deg)",
                  zIndex: 0,
                }}
                aria-hidden
              >
                <div className="flex items-baseline justify-between">
                  <div className="font-bold font-display text-sm text-[#BFBFBF]">
                    Coca-Cola Scholars
                  </div>
                  <div className="font-code text-[10px] text-[#BFBFBF]">
                    $20k
                  </div>
                </div>
                <div className="text-[#BFBFBF] font-code text-[10px] mt-1">
                  Closes Oct 31
                </div>
              </div>
              {/* Front layer */}
              <div
                className="absolute border border-black bg-white p-3 text-xs"
                style={{
                  width: "88%",
                  left: 0,
                  top: 0,
                  transform: "rotate(-1deg)",
                  zIndex: 1,
                }}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <div className="font-bold font-display text-sm">
                    Gates Scholarship
                  </div>
                  <div className="font-code text-[10px] font-bold tabular-nums">
                    $50k
                  </div>
                </div>
                <div className="text-[#525252] font-code text-[10px] mt-0.5">
                  Full ride · STEM majors
                </div>
                <div className="h-px bg-black my-2" />
                <div className="flex items-center justify-between">
                  <span className="font-serif text-[10px] text-[#525252]">
                    98% match for your profile
                  </span>
                  <span
                    className="font-code text-[9px] tracking-wide px-1.5 py-0.5"
                    style={{ backgroundColor: "#9a1a27", color: "#fff" }}
                  >
                    12d
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────────

function ThreeSteps() {
  const steps = [
    {
      number: "01",
      title: "Create Your Free Account",
      description:
        "Sign up in under a minute, no credit card or setup fees needed. Your personalized dashboard is ready the moment you confirm your email.",
      tag: "Getting Started",
    },
    {
      number: "02",
      title: "Build Your School List",
      description:
        "Search 10,000+ universities, compare deadlines and requirements, and add schools to your tracker. Everything about each application lives in one place.",
      tag: "Research & Plan",
    },
    {
      number: "03",
      title: "Write, Prepare & Apply",
      description:
        "Draft essays in the Workshop, find matching scholarships, build your resume, and upload documents. All of it tracked against your live deadlines.",
      tag: "Execute",
    },
    {
      number: "04",
      title: "Submit with Confidence",
      description:
        "Your completion checklist turns item by item. When every box is checked, hit submit knowing nothing was missed and no deadline slipped by.",
      tag: "Submit",
    },
  ];

  return (
    <section
      id="how-it-works"
      className="relative py-24 md:py-32 lg:py-40 bg-white"
    >
      <DiagonalTexture />
      <div className="relative max-w-6xl mx-auto px-6 lg:px-12">
        <div className="grid lg:grid-cols-[40%_60%] gap-12 lg:gap-20 items-start">
          {/* Left sticky heading */}
          <div className="lg:sticky lg:top-28">
            <p className="text-[11px] tracking-[0.18em] uppercase text-[#525252] mb-5 font-code">
              How It Works
            </p>
            <h2 className="text-4xl md:text-5xl lg:text-[3.25rem] font-bold tracking-tight leading-[1.05] mb-6 font-display">
              Everything you need,{" "}
              <span className="italic" style={{ color: "#9a1a27" }}>
                step by step
              </span>
            </h2>
            <p className="text-lg text-[#525252] leading-relaxed font-serif mb-8">
              CAAT walks you through every stage of applying to college, from
              your first school search to hitting submit.
            </p>
            <div className="h-[4px] w-12 bg-black" aria-hidden />
          </div>

          {/* Right steps */}
          <div>
            {steps.map((step, i) => (
              <div
                key={step.number}
                className={`flex gap-6 ${
                  i < steps.length - 1
                    ? "pb-8 mb-8 border-b border-[#E5E5E5]"
                    : ""
                }`}
              >
                {/* Number + connector */}
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className="w-10 h-10 bg-black text-white flex items-center justify-center text-[11px] font-code tracking-[0.05em]">
                    {step.number}
                  </div>
                  {i < steps.length - 1 && (
                    <div
                      className="w-px bg-[#E5E5E5] mt-3"
                      style={{ minHeight: "32px", flex: 1 }}
                    />
                  )}
                </div>

                {/* Content */}
                <div className="pt-1 pb-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold font-display">
                      {step.title}
                    </h3>
                    <span className="text-[10px] tracking-[0.1em] uppercase font-code text-[#525252] border border-[#E5E5E5] px-2 py-0.5 hidden sm:inline-block">
                      {step.tag}
                    </span>
                  </div>
                  <p className="text-[#525252] leading-relaxed font-serif text-sm">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Security Banner ──────────────────────────────────────────────────────────

function SecurityBanner() {
  return (
    <section className="relative py-24 md:py-32 lg:py-40 bg-black text-white">
      <WhiteVerticalTexture />
      <div className="relative max-w-6xl mx-auto px-6 lg:px-12">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left: title */}
          <div>
            <p className="text-[11px] tracking-[0.18em] uppercase text-[#888] mb-5 font-code">
              Security
            </p>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05] font-display text-white">
              Your Data Stays{" "}
              <span className="italic" style={{ color: "#9a1a27" }}>
                Yours
              </span>
            </h2>
          </div>

          {/* Right: body */}
          <div>
            <p className="text-[#999] leading-relaxed mb-10 text-lg font-serif">
              Your essays, scores, and applications are encrypted and only
              visible to you. We don&apos;t sell your data, share it with
              advertisers, or use it to train AI. You can delete or export
              everything in one click.
            </p>

            <div className="flex flex-wrap gap-3">
              {[
                {
                  icon: <Shield size={13} strokeWidth={1.5} />,
                  label: "Runs on SOC2-Certified Infrastructure",
                },
                {
                  icon: <Lock size={13} strokeWidth={1.5} />,
                  label: "AES-256 Encryption",
                },
              ].map((badge) => (
                <div
                  key={badge.label}
                  className="flex items-center gap-2 border border-white px-4 py-2.5"
                >
                  {badge.icon}
                  <span className="text-[11px] tracking-[0.12em] font-code">
                    {badge.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Early User Review ────────────────────────────────────────────────────────

function EarlyUserReview() {
  return (
    <section className="relative py-24 md:py-32 lg:py-40 bg-white">
      <GridTexture />
      <div className="relative max-w-6xl mx-auto px-6 lg:px-12">
        {/* Section header */}
        <div className="mb-12 md:mb-16">
          <p className="text-[11px] tracking-[0.18em] uppercase text-[#525252] mb-5 font-code">
            From an Early User
          </p>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05] font-display max-w-3xl">
            What students are{" "}
            <span className="italic" style={{ color: "#9a1a27" }}>
              saying.
            </span>
          </h2>
        </div>

        {/* Quote card with offset shadow */}
        <div className="relative max-w-3xl mx-auto">
          {/* Shadow layer */}
          <div
            aria-hidden
            className="absolute border border-[#E5E5E5] bg-[#F5F5F5] inset-0"
            style={{ transform: "rotate(-1deg) translate(8px, 8px)" }}
          />
          {/* Front card */}
          <figure className="relative bg-white border border-black p-8 md:p-12 pt-16 md:pt-20">
            {/* Big opening quote mark */}
            <span
              aria-hidden
              className="absolute font-display font-bold leading-none select-none"
              style={{
                top: "28px",
                left: "28px",
                fontSize: "84px",
                color: "#9a1a27",
                lineHeight: 1,
              }}
            >
              &ldquo;
            </span>

            <blockquote className="font-display text-2xl md:text-3xl lg:text-[2.25rem] leading-tight tracking-tight text-black">
              Comprehensive features all in one site!
            </blockquote>

            <hr className="my-7 border-0 border-t border-black" />

            <figcaption className="flex items-center gap-4">
              {/* Monogram avatar */}
              <div
                aria-hidden
                className="size-12 border border-black bg-white flex items-center justify-center font-display font-bold text-base tracking-[0.05em]"
              >
                TN
              </div>
              <div className="flex flex-col">
                <span className="font-display font-bold text-base text-black">
                  Thet Naung
                </span>
                <span className="text-[11px] tracking-[0.12em] uppercase font-code text-[#525252] mt-0.5">
                  MIT, Class of 2027
                </span>
              </div>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}

// ─── Final CTA ────────────────────────────────────────────────────────────────

function FinalCTA() {
  return (
    <section className="relative py-24 md:py-32 lg:py-40 bg-black text-white">
      {/* Radial highlight at top */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at top center, #ffffff, transparent 65%)",
          opacity: 0.05,
        }}
      />

      <div className="relative max-w-6xl mx-auto px-6 lg:px-12 text-center">
        <p className="text-[11px] tracking-[0.18em] uppercase text-[#888] mb-6 font-code">
          Get Started
        </p>
        <h2 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.02] mb-6 text-white font-display">
          Ready to start
          <br />
          <span className="italic" style={{ color: "#9a1a27" }}>
            your journey?
          </span>
        </h2>
        <p className="text-lg text-[#888] mb-12 max-w-md mx-auto font-serif">
          Deadlines wait for no one. Get your plan together before the rush.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-2 bg-white text-black text-[11px] tracking-[0.18em] uppercase px-8 py-4 border border-white hover:bg-transparent hover:text-white transition-colors duration-100 font-code focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-white focus-visible:outline-offset-[3px]"
          >
            Get Started for Free
            <ArrowRight size={14} strokeWidth={1.5} />
          </Link>
          {/* Talk to an Advisor — coming soon. We'll connect students to
             signed-up advisors once that programme launches. */}
          <span
            aria-disabled="true"
            title="Coming soon. Advisor matching will go live shortly."
            className="inline-flex items-center justify-center gap-2 bg-transparent text-white/60 text-[11px] tracking-[0.18em] uppercase px-8 py-4 border border-white/40 cursor-not-allowed select-none font-code"
          >
            <Clock size={13} strokeWidth={1.5} />
            Talk to an Advisor · Coming Soon
          </span>
        </div>

        <p className="text-[11px] text-[#555] tracking-[0.12em] font-code">
          No credit card required&nbsp;&nbsp;•&nbsp;&nbsp;Secure data
          storage&nbsp;&nbsp;•&nbsp;&nbsp;Expert support
        </p>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  const links = [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Contact Us", href: "/contact" },
    { label: "Help Center", href: "#" },
  ];

  return (
    <footer className="py-12 md:py-16 bg-white border-t border-black">
      <div className="max-w-6xl mx-auto px-6 lg:px-12">
        <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-10">
          <div>
            <div className="mb-3 flex items-center gap-4">
              <Image
                src="/logo.png"
                alt="CAAT"
                width={72}
                height={28}
                className="object-contain"
              />
              <span className="text-base text-[#525252] font-serif lowercase">
                by
              </span>
              <a
                href="https://purpl.au"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Purpl Solutions"
                className="inline-flex items-center gap-2 opacity-80 transition-opacity duration-150 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-black focus-visible:outline-offset-2"
              >
                <Image
                  src="/brand/purpl-grain.png"
                  alt=""
                  aria-hidden="true"
                  width={28}
                  height={28}
                  className="h-7 w-7 shrink-0 object-contain"
                />
                <Image
                  src="/brand/purpl-mark.svg"
                  alt="purpl"
                  width={88}
                  height={32}
                  className="h-6 w-auto object-contain"
                />
              </a>
            </div>
            <p className="text-sm text-[#525252] max-w-xs font-serif">
              College Application Assistance Tool. Your path to university,
              organized.
            </p>
          </div>

          <div className="flex flex-wrap gap-6">
            {links.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-sm text-[#525252] hover:text-black hover:underline transition-colors duration-100 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-black focus-visible:outline-offset-2"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="pt-6 border-t border-[#E5E5E5] flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-[11px] text-[#525252] font-code">
            © {new Date().getFullYear()} CAAT. All rights reserved.
          </p>
          <p className="text-[11px] text-[#525252] font-code">
            Built for students. Trusted by early users.
          </p>
        </div>
      </div>
    </footer>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="bg-white text-black overflow-x-hidden font-serif">
      <Navbar />
      <main>
        <Hero />
        <ThickRule />
        <FeaturesGrid />
        <ThickRule />
        <ProductShowcase />
        <ThickRule />
        <MoreFeatures />
        <ThickRule />
        <ThreeSteps />
        <ThickRule />
        <SecurityBanner />
        <ThickRule />
        <EarlyUserReview />
        <ThickRule />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
