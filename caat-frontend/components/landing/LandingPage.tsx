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
  GraduationCap,
  Award,
  FolderOpen,
  Calendar,
} from "lucide-react";
import Navbar from "./Navbar";

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
                className="block text-[4.5rem] md:text-[6rem] lg:text-[7.5rem] text-black italic"
                style={{
                  textDecoration: "underline",
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
                className="inline-flex items-center justify-center gap-2 bg-black text-white text-[11px] tracking-[0.18em] uppercase px-8 py-4 border border-black hover:bg-white hover:text-black transition-colors duration-100 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-black focus-visible:outline-offset-[3px] font-code"
              >
                Get Started for Free
                <ArrowRight size={14} strokeWidth={1.5} />
              </Link>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 bg-transparent text-black text-[11px] tracking-[0.18em] uppercase px-8 py-4 border-2 border-black hover:bg-black hover:text-white transition-colors duration-100 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-black focus-visible:outline-offset-[3px] font-code"
              >
                <Play size={12} strokeWidth={1.5} />
                Watch Demo
              </button>
            </div>

            {/* Early release note */}
            <p className="text-sm text-[#525252] font-serif pt-2">
              Be part of the{" "}
              <strong className="text-black font-bold">early release</strong>{" "}
              and get in before everyone else.
            </p>
          </div>

          {/* Right: CSS dashboard mockup */}
          <div className="hidden lg:flex items-center justify-center relative">
            {/* Shadow layer (offset duplicate) */}
            <div
              className="absolute border border-[#E5E5E5] bg-[#F5F5F5] w-full max-w-[400px]"
              style={{ transform: "rotate(-1deg) translate(10px, 10px)", height: "420px" }}
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
              <div className="p-5 space-y-3">
                <div className="text-[10px] tracking-[0.15em] uppercase text-[#525252] pb-3 border-b border-[#E5E5E5] font-code">
                  Applications — Cycle 2025–26
                </div>

                {[
                  { school: "Stanford University", status: "In Progress", progress: 75 },
                  { school: "MIT", status: "Complete", progress: 100 },
                  { school: "Harvard University", status: "Draft", progress: 30 },
                  { school: "Yale University", status: "In Progress", progress: 55 },
                  { school: "Princeton University", status: "Not Started", progress: 0 },
                ].map((item) => (
                  <div
                    key={item.school}
                    className="flex items-center gap-3 py-2 border-b border-[#E5E5E5] last:border-0"
                  >
                    <div
                      className={`w-4 h-4 border flex items-center justify-center flex-shrink-0 ${
                        item.progress === 100
                          ? "bg-black border-black"
                          : "border-black"
                      }`}
                    >
                      {item.progress === 100 && (
                        <Check size={9} strokeWidth={3} className="text-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs truncate font-serif font-medium">
                        {item.school}
                      </div>
                      <div className="h-[3px] bg-[#E5E5E5] mt-1.5">
                        <div
                          className="h-full bg-black transition-none"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    </div>
                    <div
                      className={`text-[9px] tracking-wide px-2 py-0.5 flex-shrink-0 font-code ${
                        item.status === "Complete"
                          ? "bg-black text-white"
                          : item.status === "In Progress"
                          ? "border border-black text-black"
                          : "border border-[#E5E5E5] text-[#525252]"
                      }`}
                    >
                      {item.status}
                    </div>
                  </div>
                ))}

                {/* Alert */}
                <div className="border border-black p-3 flex items-start gap-2 mt-3 bg-white">
                  <span className="text-[10px] font-bold flex-shrink-0 font-code">!</span>
                  <div>
                    <div className="text-xs font-medium font-serif">
                      Stanford deadline in 3 days
                    </div>
                    <div className="text-[10px] text-[#525252] mt-0.5 font-code">
                      Essays section incomplete
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Decorative bottom element */}
        <div className="flex items-center gap-4 mt-16 md:mt-20">
          <div className="h-[4px] flex-1 bg-black" />
          <div className="w-5 h-5 border-2 border-black flex-shrink-0" aria-hidden />
          <div className="w-5 h-5 bg-black flex-shrink-0" aria-hidden />
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
      title: "Application Tracker",
      description:
        "Manage every application, deadline, and requirement from a single unified dashboard. Status updates, progress bars, and task checklists in one view.",
    },
    {
      icon: <GraduationCap size={20} strokeWidth={1.5} />,
      title: "School Search",
      description:
        "Browse 10,000+ universities worldwide. Compare acceptance rates, deadlines, tuition, and requirements side by side to build your perfect list.",
    },
    {
      icon: <Pencil size={20} strokeWidth={1.5} />,
      title: "Essay Workshop",
      description:
        "Interactive prompts guide you from blank page to polished draft. Version history keeps every revision, and built-in feedback helps you refine.",
    },
    {
      icon: <Award size={20} strokeWidth={1.5} />,
      title: "Scholarship Finder",
      description:
        "AI-powered matching surfaces scholarships tailored to your profile, field of study, and background. Track applications and deadlines in one place.",
    },
    {
      icon: <FileText size={20} strokeWidth={1.5} />,
      title: "Resume Builder",
      description:
        "Guided templates walk you through activities, awards, and achievements. Export a polished resume formatted the way admissions offices expect.",
    },
    {
      icon: <FolderOpen size={20} strokeWidth={1.5} />,
      title: "Document Vault",
      description:
        "Upload transcripts, recommendation letters, and test scores to secure encrypted storage. Share access links directly with institutions.",
    },
    {
      icon: <Calendar size={20} strokeWidth={1.5} />,
      title: "Deadline Dashboard",
      description:
        "Every deadline across every school in one calendar view. Smart alerts warn you days in advance so nothing slips through the cracks.",
    },
    {
      icon: <Lock size={20} strokeWidth={1.5} />,
      title: "Secure by Default",
      description:
        "AES-256 encryption and SOC2-compliant infrastructure protect every file and form entry. Your data is yours: always private, always accessible.",
    },
  ];

  return (
    <section id="features" className="relative py-24 md:py-32 lg:py-40 bg-white">
      <LinesTexture />
      <div className="relative max-w-6xl mx-auto px-6 lg:px-12">
        {/* Section header */}
        <div className="text-center mb-16 md:mb-20">
          <p className="text-[11px] tracking-[0.18em] uppercase text-[#525252] mb-5 font-code">
            Platform
          </p>
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-none mb-6 font-display">
            Built Around Your Application
          </h2>
          <p className="text-lg text-[#525252] max-w-xl mx-auto font-serif">
            All the tools you need to actually get through the college
            application process, in one place.
          </p>
        </div>

        {/* Scrollable cards */}
        <div className="border border-black overflow-x-auto">
          <div className="flex min-w-max">
            {features.map((feature, i) => (
              <div
                key={feature.title}
                className={`group w-72 flex-none p-8 transition-colors duration-100 hover:bg-black hover:text-white cursor-default ${
                  i < features.length - 1 ? "border-r border-black" : ""
                }`}
              >
                <div className="mb-6 group-hover:text-white transition-colors duration-100">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold mb-4 font-display">
                  {feature.title}
                </h3>
                <p className="text-[#525252] group-hover:text-[#BFBFBF] leading-relaxed transition-colors duration-100 font-serif text-sm">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>

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
            Designed to simplify
            <br />
            the complex.
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
                <div className="border border-black text-[10px] tracking-wide px-2.5 py-1 flex-shrink-0 font-code">
                  In Progress
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-[#525252]">
                  <span className="font-serif">Overall Progress</span>
                  <span className="font-code">75%</span>
                </div>
                <div className="h-1.5 bg-[#E5E5E5]">
                  <div className="h-full bg-black" style={{ width: "75%" }} />
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
                      item.done
                        ? "bg-black border-black"
                        : "border-[#525252]"
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
          </div>

          {/* Scholarship Finder — inverted */}
          <div className="p-8 lg:p-10 bg-black text-white">
            <p className="text-[10px] tracking-[0.18em] uppercase text-[#888] mb-7 font-code">
              Scholarship Finder
            </p>

            <p className="text-lg mb-10 leading-relaxed font-serif">
              AI-powered matching connects you with scholarships tailored to
              your profile, field of study, and background.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 mb-10">
              {[
                { amount: "$12k", label: "Average Award" },
                { amount: "$5k", label: "Minimum Match" },
              ].map((stat) => (
                <div key={stat.label} className="border border-white p-5">
                  <div className="text-4xl font-bold mb-1.5 font-display">
                    {stat.amount}
                  </div>
                  <div className="text-[10px] text-[#888] tracking-[0.12em] uppercase font-code">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            <Link
              href="/signup"
              className="inline-flex items-center gap-2 border border-white text-white text-[11px] tracking-[0.18em] uppercase px-6 py-3.5 hover:bg-white hover:text-black transition-colors duration-100 font-code focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-white focus-visible:outline-offset-[3px]"
            >
              Find Scholarships
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

          {/* Resume Builder */}
          <div className="p-8 lg:p-10">
            <div className="w-10 h-10 border border-black flex items-center justify-center mb-6">
              <FileText size={17} strokeWidth={1.5} />
            </div>
            <h3 className="text-2xl font-bold mb-4 font-display">
              Resume Builder
            </h3>
            <p className="text-[#525252] leading-relaxed mb-6 font-serif">
              Guided templates help you build a resume that stands out. Highlight
              achievements, activities, and skills in a format that admissions
              offices love.
            </p>
            <Link
              href="/signup"
              className="text-sm font-medium hover:underline tracking-wide inline-flex items-center gap-1.5 mb-10 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-black focus-visible:outline-offset-2"
            >
              Explore Templates{" "}
              <ArrowRight size={13} strokeWidth={1.5} />
            </Link>

            {/* Resume mockup stack */}
            <div className="relative mt-2 h-28">
              {/* Back layer */}
              <div
                className="absolute border border-[#E5E5E5] bg-[#F5F5F5] p-4 text-xs"
                style={{
                  width: "82%",
                  right: 0,
                  top: 4,
                  transform: "rotate(3.5deg)",
                  zIndex: 0,
                }}
                aria-hidden
              >
                <div className="font-bold font-display text-sm text-[#BFBFBF]">
                  Alex Johnson
                </div>
                <div className="text-[#BFBFBF] font-code text-[10px] mt-1">
                  Template v2
                </div>
              </div>
              {/* Front layer */}
              <div
                className="absolute border border-black bg-white p-4 text-xs"
                style={{
                  width: "88%",
                  left: 0,
                  top: 0,
                  transform: "rotate(-1deg)",
                  zIndex: 1,
                }}
              >
                <div className="font-bold font-display text-sm">Alex Johnson</div>
                <div className="text-[#525252] font-code text-[10px] mt-0.5">
                  alex@email.com · Boston, MA
                </div>
                <div className="h-px bg-black my-2" />
                <div className="font-medium font-serif text-[11px] mb-1">
                  Education
                </div>
                <div className="text-[#525252] font-serif text-[10px]">
                  Boston Latin School, GPA 3.98 / 4.0
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
              Everything you need, step by step
            </h2>
            <p className="text-lg text-[#525252] leading-relaxed font-serif mb-8">
              CAAT walks you through every stage of applying to college, from your first school search to hitting submit.
            </p>
            <div className="h-[4px] w-12 bg-black" aria-hidden />
          </div>

          {/* Right steps */}
          <div>
            {steps.map((step, i) => (
              <div
                key={step.number}
                className={`flex gap-6 ${
                  i < steps.length - 1 ? "pb-8 mb-8 border-b border-[#E5E5E5]" : ""
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
          {/* Left */}
          <div>
            <p className="text-[11px] tracking-[0.18em] uppercase text-[#888] mb-5 font-code">
              Security
            </p>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05] mb-6 font-display text-white">
              Your Data Stays Yours
            </h2>
            <p className="text-[#999] leading-relaxed mb-10 text-lg font-serif">
              We build on Supabase, so your data sits on infrastructure that
              banks and large companies rely on. You get that same protection,
              for free.
            </p>

            <div className="flex flex-wrap gap-3">
              {[
                { icon: <Shield size={13} strokeWidth={1.5} />, label: "SOC2 Compliant" },
                { icon: <Lock size={13} strokeWidth={1.5} />, label: "AES-256 Encryption" },
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

          {/* Right: testimonial */}
          <div className="group border border-white p-8 lg:p-10 transition-all duration-100 hover:border-t-[3px]">
            <div
              className="text-7xl font-bold leading-none mb-4 font-display opacity-20 group-hover:opacity-30 transition-opacity duration-100"
              aria-hidden
            >
              &ldquo;
            </div>
            <blockquote className="text-xl italic leading-relaxed text-white mb-8 font-display">
              CAAT kept all my application documents organized and secure. I
              never worried about losing my work, even when applying to 15
              schools simultaneously.
            </blockquote>
            <div className="flex items-center gap-4 pt-6 border-t border-white/20">
              <div className="w-10 h-10 bg-white text-black flex items-center justify-center text-xs font-bold font-code flex-shrink-0">
                SM
              </div>
              <div>
                <div className="font-medium text-white text-sm">
                  Sarah Mitchell
                </div>
                <div className="text-[11px] text-[#888] font-code mt-0.5">
                  Class of 2025 at Harvard University
                </div>
              </div>
            </div>
          </div>
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
          your journey?
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
          <Link
            href="#"
            className="inline-flex items-center justify-center gap-2 bg-transparent text-white text-[11px] tracking-[0.18em] uppercase px-8 py-4 border border-white hover:bg-white hover:text-black transition-colors duration-100 font-code focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-white focus-visible:outline-offset-[3px]"
          >
            Talk to an Advisor
          </Link>
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
    { label: "Privacy Policy", href: "#" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Contact Us", href: "#" },
    { label: "Help Center", href: "#" },
  ];

  return (
    <footer className="py-12 md:py-16 bg-white border-t border-black">
      <div className="max-w-6xl mx-auto px-6 lg:px-12">
        <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-10">
          <div>
            <div className="mb-3">
              <Image src="/logo.png" alt="CAAT" width={72} height={28} className="object-contain" />
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
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
