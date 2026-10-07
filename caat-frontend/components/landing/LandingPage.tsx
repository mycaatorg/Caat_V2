import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Play,
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
import { DemoPlayer } from "./DemoPlayer";

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
                For Years 10 to 12 in Australia
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
              Shortlist universities and courses, track scholarships and
              application deadlines, and keep essays and documents in one
              place. Plan around Year 12 and your ATAR instead of juggling
              spreadsheets.
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
              <a
                href="#demo"
                className="inline-flex items-center justify-center gap-2 bg-transparent text-black text-[11px] tracking-[0.18em] uppercase px-8 py-4 border-2 border-black hover:bg-black hover:text-white transition-colors duration-100 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-black focus-visible:outline-offset-[3px] font-code"
              >
                <Play size={12} strokeWidth={1.5} />
                Watch Demo
              </a>
            </div>

            {/* Early release note */}
            <p className="text-sm text-[#525252] font-serif pt-2">
              Be part of the{" "}
              <strong className="text-black font-bold">early release</strong>{" "}
              and get in before everyone else.
            </p>
          </div>

          {/* Right: Dashboard preview. Mirrors the real /dashboard layout with
              fictional example names, labelled as an example. */}
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
                  Example Dashboard
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
                {/* Greeting - matches DashboardShell */}
                <div>
                  <div className="font-display font-bold text-base text-black">
                    Good evening, Alex!
                  </div>
                  <div className="text-[11px] text-[#525252] mt-0.5 font-serif">
                    Here&apos;s where your university plan is up to.
                  </div>
                </div>

                {/* Application Readiness - matches ApplicationReadiness component */}
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
                      { label: "Universities", done: true },
                      { label: "Courses", done: true },
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

                {/* Upcoming Deadlines - matches UpcomingDeadlinesWidget */}
                <div className="border border-black p-3.5">
                  <div className="text-[11px] tracking-[0.12em] uppercase font-code font-bold mb-2.5">
                    Upcoming Deadlines
                  </div>
                  <div className="space-y-1.5">
                    {[
                      {
                        label: "Harbourside University",
                        type: "Application",
                        days: "3d",
                        dotClass: "",
                        dotStyle: { backgroundColor: "#9a1a27" },
                        countdownClass: "",
                        countdownStyle: { color: "#9a1a27" },
                      },
                      {
                        label: "Red Gum Regional Scholarship",
                        type: "Scholarship",
                        days: "12d",
                        dotClass: "bg-amber-500",
                        countdownClass: "text-amber-600",
                      },
                      {
                        label: "Wattle Valley University",
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

// ─── Demo Video ───────────────────────────────────────────────────────────────

function DemoVideo() {
  return (
    <section className="relative bg-white py-24 md:py-32 lg:py-40">
      <GridTexture />
      {/* #demo anchor sits on the content wrapper with scroll-mt clearing
          the navbar, so 'watch demo' lands the eyebrow at the top and the
          heading + full video player are all in view. */}
      <div id="demo" className="relative max-w-5xl mx-auto px-6 lg:px-12 scroll-mt-[65px]">
        {/* eyebrow + heading, matching the rest of the page */}
        <div className="text-center mb-12 md:mb-16">
          <span className="text-[11px] tracking-[0.22em] uppercase font-code text-[#9a1a27]">
            See it in action
          </span>
          <h2 className="font-display font-bold leading-[0.95] tracking-tight mt-4 text-5xl md:text-6xl lg:text-[4rem]">
            <span className="text-black">CAAT </span>
            <span className="italic" style={{ color: "#9a1a27" }}>
              Demo
            </span>
          </h2>
        </div>

        {/* video player - youtube first (CDN), supabase mp4 fallback if the embed fails */}
        <div className="relative border-2 border-black bg-black shadow-[12px_12px_0_0_rgba(154,26,39,1)]">
          <DemoPlayer />
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
        "Today opens on your next step, what needs attention and the deadlines coming up. Your dashboard adds a calendar, to-dos, saved universities and courses, and widgets you can drag and resize.",
      previewImage: "/feature-previews/dashboard.png",
    },
    {
      icon: <CheckCircle2 size={20} strokeWidth={1.5} />,
      title: "Application Tracker",
      description:
        "Track each university application with its status, deadline and notes, plus a readiness check for your essays and documents. Outcomes stay on the same list.",
      previewImage: "/feature-previews/application-tracker.png",
    },
    {
      icon: <GraduationCap size={20} strokeWidth={1.5} />,
      title: "University Search",
      description:
        "Search universities in Australia and around the world, filter by country, keep notes on each one, and save favourites to your shortlist. Compare courses side by side.",
      previewImage: "/feature-previews/school-search.png",
    },
    {
      icon: <Pencil size={20} strokeWidth={1.5} />,
      title: "Essay Workshop",
      description:
        "Write against each prompt with tips alongside, or add your own for a scholarship or early entry application. Keep several drafts and switch between them.",
      previewImage: "/feature-previews/essay-workshop.png",
    },
    {
      icon: <Award size={20} strokeWidth={1.5} />,
      title: "Scholarship Finder",
      description:
        "Scholarships matched to your profile, field of study and background surface first. Save them, track their deadlines, and apply through each provider.",
      previewImage: "/feature-previews/scholarship-finder.png",
    },
    {
      icon: <FileText size={20} strokeWidth={1.5} />,
      title: "Resume Builder",
      description:
        "Guided sections walk you through education, experience, activities and skills. Print or save a clean A4 resume as a PDF for scholarship and early entry applications.",
      previewImage: "/feature-previews/resume-builder.png",
    },
    {
      icon: <FolderOpen size={20} strokeWidth={1.5} />,
      title: "Document Vault",
      description:
        "Keep school reports, ID, English test results and references in one place, and link each file to the applications that need it.",
      previewImage: "/feature-previews/document-vault.png",
    },
    {
      icon: <Lock size={20} strokeWidth={1.5} />,
      title: "Private by Default",
      description:
        "Your applications, essays and documents are private to your account and travel over HTTPS. Export or delete your data at any time.",
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
            Everything you need to plan for university, from a first
            shortlist in Year 10 to applications in Year 12, in one place.
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
            Powerful tools built around how you actually think: organised,
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
                    Harbourside University
                  </div>
                  <div className="text-[11px] text-[#525252] mt-0.5 font-code">
                    Example · Due in 12 days
                  </div>
                </div>
                <div
                  className="text-[10px] tracking-wide px-2.5 py-1 flex-shrink-0 font-code"
                  style={{
                    border: "1px solid #16a34a",
                    color: "#16a34a",
                  }}
                >
                  Applying
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-[#525252]">
                  <span className="font-serif">Readiness</span>
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
                { label: "Deadline set", done: true },
                { label: "Essay drafted", done: true },
                { label: "School report uploaded", done: true },
                { label: "Submitted through UAC", done: false },
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

            {/* Divider - full-bleed hairline rule between sub-features */}
            <div className="-mx-8 lg:-mx-10 h-px bg-black my-10" aria-hidden />

            {/* University Search - mirrors /schools page, fictional examples */}
            <p className="text-[10px] tracking-[0.18em] uppercase text-[#525252] mb-5 font-code">
              University Search
            </p>

            {/* Search input + country filter row */}
            <div className="flex gap-2 mb-4">
              <div className="flex-1 border border-black flex items-center gap-2 px-3 py-2.5">
                <Search
                  size={13}
                  strokeWidth={1.5}
                  className="text-[#525252] flex-shrink-0"
                />
                <span className="text-xs font-serif">Harbourside</span>
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
                  Australia
                </span>
                <ChevronDown size={11} strokeWidth={1.5} />
              </div>
            </div>

            {/* Results count */}
            <div className="text-[11px] text-[#525252] font-serif mb-3">
              Showing{" "}
              <span className="font-bold text-black">3 example results</span>{" "}
              in <span className="font-bold text-black">Australia</span>
            </div>

            {/* Result rows */}
            <div className="border border-black divide-y divide-black">
              {[
                {
                  name: "Harbourside University",
                  country: "Australia",
                  bookmarked: true,
                },
                {
                  name: "Harbourside Institute of Technology",
                  country: "Australia",
                  bookmarked: false,
                },
                {
                  name: "Harbourside College of the Arts",
                  country: "Australia",
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

          {/* Resume Builder - matches the white card theme of the rest of the section */}
          <div className="p-8 lg:p-10 bg-white text-black">
            <p className="text-[10px] tracking-[0.18em] uppercase text-[#525252] mb-7 font-code">
              Resume Builder
            </p>

            <p className="text-lg mb-8 leading-relaxed font-serif text-[#525252]">
              Guided sections walk you through every detail. The live A4 preview
              updates as you type, ready to print or save as a PDF for
              scholarship and early entry applications.
            </p>

            {/* Section nav - mirrors DocumentStructurePanel */}
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

            {/* Mini A4 preview - sits as white "paper" with a soft offset shadow */}
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
                {/* Personal header - centered, matches ResumePage */}
                <div className="text-center">
                  <div
                    className="font-bold font-display"
                    style={{
                      fontSize: "18px",
                      letterSpacing: "0.05em",
                      lineHeight: 1.2,
                    }}
                  >
                    ALEX CHEN
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
                    alex@example.com · Parramatta, NSW · Example resume
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
                    <div className="font-bold">Harbourside High School</div>
                    <div style={{ color: "#666" }}>
                      Year 12 · HSC, finishing 2027
                    </div>
                    <div style={{ color: "#666", marginTop: 2 }}>
                      Mathematics Extension 1 · House captain
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
                        Volunteer Tutor, Homework Club
                      </span>
                      <span style={{ color: "#666", fontSize: "7.5px" }}>
                        2026
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
                        Tutored Year 7 and 8 students in maths each week
                      </li>
                      <li>Ran a school holiday coding workshop</li>
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
                    Python, Excel, First Aid · Debating, Robotics, Netball
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
              Prompts with tips guide you from blank page to a real draft. Add
              your own prompt for a scholarship or early entry application,
              keep several drafts, and let autosave hold on to your best work.
              The words stay yours.
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
              Scholarships matched to your profile, field of study and
              background surface first. Save them, track their deadlines, then
              apply through each provider&apos;s official page.
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
                    Red Gum Scholarship
                  </div>
                  <div className="font-code text-[10px] text-[#BFBFBF]">
                    A$5k
                  </div>
                </div>
                <div className="text-[#BFBFBF] font-code text-[10px] mt-1">
                  Closes in 30 days
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
                    Tasman Bay Scholarship
                  </div>
                  <div className="font-code text-[10px] font-bold tabular-nums">
                    A$10k/yr
                  </div>
                </div>
                <div className="text-[#525252] font-code text-[10px] mt-0.5">
                  Example · Undergraduate STEM
                </div>
                <div className="h-px bg-black my-2" />
                <div className="flex items-center justify-between">
                  <span className="font-serif text-[10px] text-[#525252]">
                    Matched to your profile
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
        "Sign up in a minute, no credit card needed. Then answer five quick questions about your year level and study plans so CAAT can tailor scholarships and universities to you.",
      tag: "Getting Started",
    },
    {
      number: "02",
      title: "Build Your Shortlist",
      description:
        "Search universities in Australia and overseas, compare courses side by side, and save scholarships. Everything you save lands in My shortlist, ready to turn into an application.",
      tag: "Research & Plan",
    },
    {
      number: "03",
      title: "Write & Prepare",
      description:
        "Draft essays, build your resume and upload documents, all tracked against your deadlines. Today shows what needs you next, so nothing sneaks up on you in Year 12.",
      tag: "Prepare",
    },
    {
      number: "04",
      title: "Apply Through Official Channels",
      description:
        "When your readiness check is complete, submit through the admissions centre or university, and through each scholarship provider. Then mark it submitted in CAAT and track the outcome.",
      tag: "Apply",
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
              CAAT walks you through planning for university, from your first
              shortlist to the applications you send in Year 12.
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

        {/* Honest scope note: CAAT plans and tracks, it does not submit. */}
        <div className="mt-16 md:mt-20 border border-black border-l-4 border-l-[#9a1a27] bg-white">
          <div className="border-b border-black px-6 py-4 md:px-8">
            <p className="text-[11px] tracking-[0.18em] uppercase font-code text-[#9a1a27]">
              What CAAT does and does not do
            </p>
          </div>
          <div className="grid md:grid-cols-2">
            <div className="px-6 py-6 md:px-8 border-b md:border-b-0 md:border-r border-black">
              <h3 className="text-lg font-bold font-display mb-2">
                CAAT{" "}
                <span className="italic" style={{ color: "#9a1a27" }}>
                  does
                </span>
              </h3>
              <p className="text-[#525252] leading-relaxed font-serif text-sm">
                Keep your plan, deadlines and drafts organised in one place:
                the universities, courses and scholarships you are weighing up,
                your essays and documents, and what is due next.
              </p>
            </div>
            <div className="px-6 py-6 md:px-8">
              <h3 className="text-lg font-bold font-display mb-2">
                CAAT{" "}
                <span className="italic" style={{ color: "#9a1a27" }}>
                  does not
                </span>
              </h3>
              <p className="text-[#525252] leading-relaxed font-serif text-sm">
                Submit anything for you. You still apply through UAC (NSW and
                ACT), VTAC (Victoria), QTAC (Queensland), SATAC (SA and NT),
                TISC (WA) or directly to the university, and through each
                scholarship provider. Always check dates and rules on their
                official sites.
              </p>
            </div>
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
              Privacy
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
              Your essays, documents and applications are private to your
              account, and the site only loads over HTTPS. We don&apos;t sell
              your data, share it with advertisers, or use it to train AI. You
              can export all your data, or delete your account and the work
              saved in it, from your account settings.
            </p>

            <div className="flex flex-wrap gap-3">
              {[
                {
                  icon: <Lock size={13} strokeWidth={1.5} />,
                  label: "HTTPS Only",
                },
                {
                  icon: <Shield size={13} strokeWidth={1.5} />,
                  label: "Export or Delete Any Time",
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
          Deadlines wait for no one. Get your plan together before Year 12
          gets busy.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-2 bg-white text-black text-[11px] tracking-[0.18em] uppercase px-8 py-4 border border-white hover:bg-transparent hover:text-white transition-colors duration-100 font-code focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-white focus-visible:outline-offset-[3px]"
          >
            Get Started for Free
            <ArrowRight size={14} strokeWidth={1.5} />
          </Link>
          {/* Talk to an Advisor - coming soon. We'll connect students to
             signed-up advisors once that programme launches. */}
          <span
            aria-disabled="true"
            title="Coming soon. Advisor matching is not available yet."
            className="inline-flex items-center justify-center gap-2 bg-transparent text-white/60 text-[11px] tracking-[0.18em] uppercase px-8 py-4 border border-white/40 cursor-not-allowed select-none font-code"
          >
            <Clock size={13} strokeWidth={1.5} />
            Talk to an Advisor · Coming Soon
          </span>
        </div>

        <p className="text-[11px] text-[#555] tracking-[0.12em] font-code">
          No credit card required&nbsp;&nbsp;•&nbsp;&nbsp;Private to your
          account&nbsp;&nbsp;•&nbsp;&nbsp;Help from a real person
        </p>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  const links = [
    { label: "Browse Scholarships", href: "/scholarship" },
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Contact Us", href: "/contact" },
    { label: "Help Center", href: "/help" },
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
              University planning for Australian students. Your path to
              university, organised.
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
            Built for students in Years 10 to 12.
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
        <DemoVideo />
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
