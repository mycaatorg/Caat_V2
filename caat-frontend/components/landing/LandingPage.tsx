"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Play,
  Menu,
  X,
  Shield,
  Lock,
  CheckCircle,
  Calendar,
  PenLine,
  Database,
  FileText,
  BookOpen,
  Star,
  Users,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════
   Design Tokens — Newsprint
   ═══════════════════════════════════════════════════════════════ */
const C = {
  bg: "#F9F9F7",
  ink: "#111111",
  muted: "#E5E5E0",
  red: "#CC0000",
  n100: "#F5F5F5",
  n200: "#E5E5E5",
  n400: "#A3A3A3",
  n500: "#737373",
  n600: "#525252",
} as const;

const F = {
  serif: "'Playfair Display', 'Times New Roman', serif",
  body: "'Lora', Georgia, serif",
  sans: "'Inter', 'Helvetica Neue', sans-serif",
  mono: "'JetBrains Mono', 'Courier New', monospace",
} as const;

const DOT_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4' viewBox='0 0 4 4'%3E%3Cpath fill='%23111111' fill-opacity='0.04' d='M1 3h1v1H1V3zm2-2h1v1H3V1z'%3E%3C/path%3E%3C/svg%3E")`;

/* ═══════════════════════════════════════════════════════════════
   Atoms
   ═══════════════════════════════════════════════════════════════ */

function SectionLabel({ children, red = false }: { children: React.ReactNode; red?: boolean }) {
  return (
    <span
      style={{
        fontFamily: F.mono,
        fontSize: "0.6rem",
        fontWeight: 700,
        letterSpacing: "0.18em",
        textTransform: "uppercase" as const,
        color: red ? C.red : C.n500,
        display: "inline-block",
        borderLeft: `3px solid ${red ? C.red : C.ink}`,
        paddingLeft: "8px",
      }}
    >
      {children}
    </span>
  );
}

function HRule({ thick = false, color = C.ink }: { thick?: boolean; color?: string }) {
  return <div style={{ height: thick ? "4px" : "1px", backgroundColor: color, width: "100%" }} />;
}

function OrnamentalDivider() {
  return (
    <div
      style={{
        padding: "20px 0",
        textAlign: "center",
        fontFamily: F.serif,
        fontSize: "1.4rem",
        color: C.n400,
        letterSpacing: "1em",
      }}
    >
      &#x2727; &#x2727; &#x2727;
    </div>
  );
}

function PrimaryBtn({
  children,
  href,
  size = "default",
  className = "",
}: {
  children: React.ReactNode;
  href?: string;
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  const pad = size === "lg" ? "px-8 py-4" : size === "sm" ? "px-4 py-2.5" : "px-6 py-3.5";
  const text = size === "lg" ? "text-[0.78rem]" : size === "sm" ? "text-[0.62rem]" : "text-[0.7rem]";
  const cls = `inline-flex items-center gap-2 bg-[#111111] text-[#F9F9F7] border border-[#111111] hover:bg-[#F9F9F7] hover:text-[#111111] transition-all duration-200 font-bold uppercase tracking-widest min-h-[44px] cursor-pointer select-none ${pad} ${text} ${className}`;
  if (href)
    return (
      <Link href={href} className={cls} style={{ borderRadius: 0, fontFamily: F.sans }}>
        {children}
      </Link>
    );
  return (
    <button className={cls} style={{ borderRadius: 0, fontFamily: F.sans }}>
      {children}
    </button>
  );
}

function SecondaryBtn({
  children,
  href,
  size = "default",
  className = "",
}: {
  children: React.ReactNode;
  href?: string;
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  const pad = size === "lg" ? "px-8 py-4" : size === "sm" ? "px-4 py-2.5" : "px-6 py-3.5";
  const text = size === "lg" ? "text-[0.78rem]" : size === "sm" ? "text-[0.62rem]" : "text-[0.7rem]";
  const cls = `inline-flex items-center gap-2 bg-transparent text-[#111111] border border-[#111111] hover:bg-[#111111] hover:text-[#F9F9F7] transition-all duration-200 font-bold uppercase tracking-widest min-h-[44px] cursor-pointer select-none ${pad} ${text} ${className}`;
  if (href)
    return (
      <Link href={href} className={cls} style={{ borderRadius: 0, fontFamily: F.sans }}>
        {children}
      </Link>
    );
  return (
    <button className={cls} style={{ borderRadius: 0, fontFamily: F.sans }}>
      {children}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Dashboard Mockup (newspaper-style printed report)
   ═══════════════════════════════════════════════════════════════ */

function DashboardMockup() {
  const rows = [
    { name: "Stanford University", pct: 72, status: "In Progress", color: "#b45309" },
    { name: "MIT", pct: 100, status: "Complete", color: "#15803d" },
    { name: "Harvard University", pct: 35, status: "Essay Due", color: C.red },
    { name: "UC Berkeley", pct: 48, status: "In Progress", color: "#b45309" },
  ];

  return (
    <div
      style={{
        transform: "rotate(-1.5deg) perspective(900px) rotateY(4deg)",
        filter: "drop-shadow(8px 12px 28px rgba(0,0,0,0.18))",
        maxWidth: "400px",
        width: "100%",
        position: "relative",
      }}
    >
      <div style={{ border: `3px solid ${C.ink}`, backgroundColor: C.bg }}>
        {/* Header */}
        <div style={{ backgroundColor: C.ink, padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: F.mono, fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "#F9F9F7" }}>
            CAAT · Application Status Bulletin
          </span>
          <span style={{ fontFamily: F.mono, fontSize: "0.5rem", color: "rgba(255,255,255,0.4)" }}>Vol. 1</span>
        </div>

        {/* Column headers */}
        <div style={{ borderBottom: `1px solid ${C.ink}`, padding: "6px 16px", display: "grid", gridTemplateColumns: "1fr 80px 36px", gap: "8px", backgroundColor: C.n100 }}>
          {["Institution", "Status", "%"].map((h) => (
            <span key={h} style={{ fontFamily: F.mono, fontSize: "0.48rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: C.n500 }}>
              {h}
            </span>
          ))}
        </div>

        {/* Rows */}
        {rows.map((row, i) => (
          <div
            key={row.name}
            style={{ borderBottom: i < rows.length - 1 ? `1px solid ${C.muted}` : "none", padding: "10px 16px", display: "grid", gridTemplateColumns: "1fr 80px 36px", gap: "8px", alignItems: "center" }}
          >
            <div>
              <div style={{ fontFamily: F.sans, fontSize: "0.7rem", fontWeight: 600, color: C.ink, marginBottom: "4px" }}>{row.name}</div>
              <div style={{ height: "3px", backgroundColor: C.muted }}>
                <div style={{ width: `${row.pct}%`, height: "100%", backgroundColor: row.color }} />
              </div>
            </div>
            <span style={{ fontFamily: F.mono, fontSize: "0.44rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" as const, color: row.color, border: `1px solid ${row.color}`, padding: "2px 5px", whiteSpace: "nowrap" as const }}>
              {row.status}
            </span>
            <span style={{ fontFamily: F.mono, fontSize: "0.65rem", fontWeight: 700, color: C.ink, textAlign: "right" as const }}>
              {row.pct}%
            </span>
          </div>
        ))}

        {/* Footer stat */}
        <div style={{ borderTop: `2px solid ${C.ink}`, padding: "7px 16px", display: "flex", justifyContent: "space-between", backgroundColor: C.n100 }}>
          <span style={{ fontFamily: F.mono, fontSize: "0.48rem", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: C.n500 }}>Overall Progress</span>
          <span style={{ fontFamily: F.mono, fontSize: "0.6rem", fontWeight: 700, color: C.ink }}>64% · 1/4 Submitted</span>
        </div>
      </div>

      {/* Alert chip */}
      <div style={{ position: "absolute", bottom: "-24px", right: "-12px", backgroundColor: C.red, padding: "7px 14px", display: "flex", alignItems: "center", gap: "8px", border: `2px solid ${C.red}` }}>
        <div style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#F9F9F7" }} />
        <span style={{ fontFamily: F.mono, fontSize: "0.5rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "#F9F9F7", whiteSpace: "nowrap" as const }}>
          3 Deadlines This Week
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Navbar
   ═══════════════════════════════════════════════════════════════ */

function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-40" style={{ backgroundColor: C.bg }}>
      {/* Edition bar */}
      <div style={{ backgroundColor: C.ink }}>
        <div className="max-w-screen-xl mx-auto px-6 flex items-center justify-between" style={{ padding: "5px 24px" }}>
          <span style={{ fontFamily: F.mono, fontSize: "0.5rem", fontWeight: 500, letterSpacing: "0.12em", color: C.n400, textTransform: "uppercase" as const }}>
            Vol. 1 &nbsp;·&nbsp; {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} &nbsp;·&nbsp; New York Edition
          </span>
          <span style={{ fontFamily: F.mono, fontSize: "0.5rem", color: C.n500, letterSpacing: "0.08em" }}>Est. 2024</span>
        </div>
      </div>

      {/* Main nav */}
      <div style={{ borderBottom: `3px solid ${C.ink}` }}>
        <div className="max-w-screen-xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: "12px", textDecoration: "none" }}>
            <Image src="/logo.png" alt="CAAT" width={32} height={32} style={{ borderRadius: 0 }} />
            <div>
              <div style={{ fontFamily: F.serif, fontSize: "1.5rem", fontWeight: 900, color: C.ink, letterSpacing: "-0.02em", lineHeight: 1 }}>CAAT</div>
              <div style={{ fontFamily: F.mono, fontSize: "0.4rem", letterSpacing: "0.14em", textTransform: "uppercase" as const, color: C.n500, lineHeight: 1.2 }}>
                College Application Assistance Tool
              </div>
            </div>
          </Link>

          <div className="hidden md:flex items-center">
            {[
              { label: "Features", href: "#features" },
              { label: "How it Works", href: "#how-it-works" },
              { label: "Scholarships", href: "#scholarships" },
              { label: "Pricing", href: "#pricing" },
            ].map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="transition-colors duration-200 hover:text-[#CC0000]"
                style={{ fontFamily: F.sans, fontSize: "0.78rem", fontWeight: 600, color: C.ink, padding: "8px 14px", textDecoration: "none", borderRight: `1px solid ${C.muted}` }}
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/login"
              className="transition-colors duration-200 hover:text-[#CC0000]"
              style={{ fontFamily: F.sans, fontSize: "0.78rem", fontWeight: 600, color: C.n600, padding: "8px 14px", textDecoration: "none" }}
            >
              Log in
            </Link>
            <PrimaryBtn href="/signup" size="sm">
              Sign Up
              <ArrowRight size={12} strokeWidth={2.5} />
            </PrimaryBtn>
          </div>

          <button
            className="md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-[#F5F5F5] transition-colors duration-200"
            style={{ border: `1px solid ${C.ink}`, backgroundColor: "transparent", borderRadius: 0 }}
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {open ? <X size={20} color={C.ink} /> : <Menu size={20} color={C.ink} />}
          </button>
        </div>
      </div>

      {open && (
        <div style={{ backgroundColor: C.bg, borderBottom: `3px solid ${C.ink}` }} className="md:hidden">
          <div className="px-6 py-4 flex flex-col">
            {[
              { label: "Features", href: "#features" },
              { label: "How it Works", href: "#how-it-works" },
              { label: "Scholarships", href: "#scholarships" },
              { label: "Pricing", href: "#pricing" },
            ].map((link, i, arr) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setOpen(false)}
                style={{ fontFamily: F.sans, fontSize: "0.9rem", fontWeight: 600, color: C.ink, padding: "12px 0", textDecoration: "none", borderBottom: i < arr.length - 1 ? `1px solid ${C.muted}` : "none" }}
              >
                {link.label}
              </a>
            ))}
            <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <Link href="/login" style={{ fontFamily: F.sans, fontSize: "0.85rem", fontWeight: 600, color: C.n600, padding: "12px 0", textDecoration: "none", textAlign: "center", borderBottom: `1px solid ${C.muted}` }}>
                Log in
              </Link>
              <PrimaryBtn href="/signup" className="w-full justify-center">
                Sign Up Free
                <ArrowRight size={14} strokeWidth={2.5} />
              </PrimaryBtn>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Hero
   ═══════════════════════════════════════════════════════════════ */

function Hero() {
  const avatars = [
    { bg: "#b45309", initial: "A" },
    { bg: "#0369a1", initial: "M" },
    { bg: "#6d28d9", initial: "S" },
    { bg: "#be185d", initial: "J" },
    { bg: "#065f46", initial: "K" },
  ];

  return (
    <section style={{ borderBottom: `4px solid ${C.ink}`, backgroundImage: DOT_BG, backgroundColor: C.bg }}>
      {/* Breaking news strip */}
      <div style={{ borderBottom: `1px solid ${C.muted}`, padding: "7px 0" }}>
        <div className="max-w-screen-xl mx-auto px-6 flex items-center gap-4">
          <span style={{ fontFamily: F.mono, fontSize: "0.52rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, backgroundColor: C.red, color: "#fff", padding: "3px 8px", flexShrink: 0 }}>
            Special Report
          </span>
          <span style={{ fontFamily: F.mono, fontSize: "0.52rem", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: C.n500 }}>
            Your Future, Curated — The Definitive College Application Platform
          </span>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-6">
        <div className="grid lg:grid-cols-12">
          {/* Left 7/12 */}
          <div
            className="lg:col-span-7"
            style={{ padding: "48px 48px 60px 0", borderRight: `1px solid ${C.muted}`, display: "flex", flexDirection: "column", justifyContent: "center" }}
          >
            <div style={{ marginBottom: "18px" }}>
              <SectionLabel red>Feature Report — College Admissions</SectionLabel>
            </div>

            <h1
              style={{
                fontFamily: F.serif,
                fontSize: "clamp(3rem, 6vw, 5.5rem)",
                fontWeight: 900,
                color: C.ink,
                lineHeight: 0.95,
                letterSpacing: "-0.03em",
                marginBottom: "18px",
              }}
            >
              Master Your
              <br />
              Path to{" "}
              <span style={{ textDecoration: "underline", textDecorationColor: C.red, textDecorationThickness: "6px", textUnderlineOffset: "10px" }}>
                University
              </span>
            </h1>

            <HRule thick />

            {/* Drop-cap paragraph */}
            <div style={{ margin: "20px 0 28px" }}>
              <p style={{ fontFamily: F.body, fontSize: "1.05rem", lineHeight: 1.75, color: C.n600, maxWidth: "520px", textAlign: "justify" }}>
                <span
                  style={{ float: "left", fontFamily: F.serif, fontSize: "4.2rem", fontWeight: 900, lineHeight: 0.75, color: C.ink, marginRight: "8px", marginTop: "8px" }}
                >
                  S
                </span>
                top juggling spreadsheets and sticky notes. CAAT keeps your
                deadlines, essays, and documents organized so you can focus on
                what matters — getting accepted. One platform. Complete clarity.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 items-center" style={{ marginBottom: "28px" }}>
              <PrimaryBtn href="/signup" size="lg">
                Get Started for Free
                <ArrowRight size={16} strokeWidth={2.5} />
              </PrimaryBtn>
              <SecondaryBtn size="lg">
                <div style={{ width: "26px", height: "26px", backgroundColor: C.ink, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Play size={11} color={C.bg} fill={C.bg} />
                </div>
                Watch Demo
              </SecondaryBtn>
            </div>

            {/* Social proof */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ display: "flex" }}>
                {avatars.map((av, idx) => (
                  <div
                    key={idx}
                    style={{ width: "30px", height: "30px", border: `2px solid ${C.bg}`, backgroundColor: av.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F.sans, fontSize: "0.6rem", fontWeight: 700, color: "#fff", marginLeft: idx === 0 ? 0 : "-9px", zIndex: avatars.length - idx, position: "relative" }}
                  >
                    {av.initial}
                  </div>
                ))}
              </div>
              <p style={{ fontFamily: F.body, fontSize: "0.875rem", color: C.n600, lineHeight: 1.5 }}>
                <strong style={{ fontFamily: F.sans, color: C.ink, fontWeight: 700 }}>Join 2,000+</strong>{" "}
                students applying this cycle
              </p>
            </div>
          </div>

          {/* Right 5/12 */}
          <div className="hidden lg:flex lg:col-span-5 items-center justify-center" style={{ padding: "48px 0 60px 48px" }}>
            <DashboardMockup />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   News Ticker
   ═══════════════════════════════════════════════════════════════ */

function NewsTicker() {
  const items = [
    { badge: "LIVE", text: "2,000+ Students Enrolled This Cycle" },
    { badge: "DATA", text: "$12K Average Scholarship Award Found" },
    { badge: "STAT", text: "4,000+ Universities in Our Database" },
    { badge: "LIVE", text: "94% Scholarship Match Accuracy" },
    { badge: "NEWS", text: "SOC2 Compliant · AES-256 Encrypted" },
    { badge: "DATA", text: "Essay Workshop Now Available" },
    { badge: "STAT", text: "Application Deadlines Tracked Automatically" },
    { badge: "LIVE", text: "Resume Builder with College Templates" },
  ];
  const doubled = [...items, ...items];

  return (
    <div style={{ backgroundColor: C.ink, overflow: "hidden", padding: "10px 0", borderBottom: `2px solid ${C.ink}` }}>
      <div className="np-ticker-track">
        {doubled.map((item, i) => (
          <div key={i} style={{ display: "inline-flex", alignItems: "center", gap: "12px", paddingRight: "48px", flexShrink: 0 }}>
            <span style={{ fontFamily: F.mono, fontSize: "0.5rem", fontWeight: 700, letterSpacing: "0.1em", backgroundColor: C.red, color: "#fff", padding: "3px 7px" }}>
              {item.badge}
            </span>
            <span style={{ fontFamily: F.mono, fontSize: "0.62rem", fontWeight: 500, letterSpacing: "0.06em", color: "rgba(255,255,255,0.7)", textTransform: "uppercase" as const, whiteSpace: "nowrap" as const }}>
              {item.text}
            </span>
            <span style={{ color: "rgba(255,255,255,0.18)", fontSize: "0.55rem", marginLeft: "8px" }}>◆</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Features Grid
   ═══════════════════════════════════════════════════════════════ */

function FeaturesGrid() {
  const features = [
    { roman: "I", icon: Calendar, title: "All-in-One Tracking", desc: "Deadlines, tasks, and application status for every school — all in a single, structured view. Never miss a due date again.", accent: true },
    { roman: "II", icon: PenLine, title: "Expert Essay Support", desc: "AI-powered prompts, version history, and a built-in editor that helps you craft compelling personal statements fast.", accent: false },
    { roman: "III", icon: Database, title: "Secure Doc Storage", desc: "Upload transcripts, rec letters, and test scores once. Access them anywhere, share instantly with any school.", accent: false },
  ];

  return (
    <section id="features" style={{ borderBottom: `4px solid ${C.ink}`, backgroundColor: C.bg }}>
      <div style={{ borderBottom: `1px solid ${C.muted}`, padding: "36px 0 28px", backgroundImage: DOT_BG }}>
        <div className="max-w-screen-xl mx-auto px-6 text-center">
          <div style={{ marginBottom: "12px" }}><SectionLabel>Special Coverage · Built Different</SectionLabel></div>
          <h2 style={{ fontFamily: F.serif, fontSize: "clamp(2.2rem, 4vw, 3.5rem)", fontWeight: 900, color: C.ink, letterSpacing: "-0.03em", lineHeight: 1 }}>
            Engineered for Excellence
          </h2>
          <p style={{ fontFamily: F.body, fontSize: "1rem", color: C.n600, lineHeight: 1.7, maxWidth: "480px", margin: "12px auto 0" }}>
            Purpose-built tools that eliminate the chaos of applying to college.
          </p>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-6">
        <div className="grid md:grid-cols-3" style={{ borderLeft: `1px solid ${C.muted}` }}>
          {features.map((f) => (
            <div
              key={f.title}
              className="np-hard-hover"
              style={{ borderRight: `1px solid ${C.muted}`, padding: "40px 32px", position: "relative", cursor: "default" }}
            >
              <div style={{ fontFamily: F.serif, fontSize: "4.5rem", fontWeight: 900, color: f.accent ? C.red : C.muted, lineHeight: 1, marginBottom: "16px", letterSpacing: "-0.04em" }}>
                {f.roman}
              </div>
              <div style={{ border: `1px solid ${C.ink}`, width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "20px", backgroundColor: f.accent ? C.ink : "transparent" }}>
                <f.icon size={20} strokeWidth={1.5} color={f.accent ? C.bg : C.ink} />
              </div>
              <h3 style={{ fontFamily: F.sans, fontSize: "0.75rem", fontWeight: 700, color: C.ink, letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: "12px", paddingBottom: "12px", borderBottom: `2px solid ${f.accent ? C.red : C.ink}` }}>
                {f.title}
              </h3>
              <p style={{ fontFamily: F.body, fontSize: "0.9rem", color: C.n600, lineHeight: 1.75, textAlign: "justify" as const }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Product Showcase
   ═══════════════════════════════════════════════════════════════ */

function ProductShowcase() {
  return (
    <section style={{ borderBottom: `4px solid ${C.ink}`, backgroundColor: C.bg }}>
      <div style={{ borderBottom: `1px solid ${C.muted}`, padding: "40px 0 32px" }}>
        <div className="max-w-screen-xl mx-auto px-6">
          <SectionLabel>Product Overview</SectionLabel>
          <h2 style={{ fontFamily: F.serif, fontSize: "clamp(2rem, 3.5vw, 3rem)", fontWeight: 900, color: C.ink, letterSpacing: "-0.03em", lineHeight: 1.05, marginTop: "10px" }}>
            Designed to simplify
            <br />the complex.
          </h2>
          <p style={{ fontFamily: F.body, fontSize: "1rem", color: C.n600, lineHeight: 1.7, maxWidth: "440px", marginTop: "10px" }}>
            Two flagship tools, one seamless experience — built for the high-stakes reality of college admissions.
          </p>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-6">
        <div className="grid md:grid-cols-2" style={{ borderLeft: `1px solid ${C.muted}` }}>
          {/* Application Tracker */}
          <div style={{ borderRight: `1px solid ${C.muted}`, padding: "40px 36px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
              <div>
                <div style={{ fontFamily: F.mono, fontSize: "0.5rem", letterSpacing: "0.14em", textTransform: "uppercase" as const, color: C.n400, marginBottom: "4px" }}>Module 01</div>
                <h3 style={{ fontFamily: F.serif, fontSize: "1.5rem", fontWeight: 700, color: C.ink, letterSpacing: "-0.02em" }}>Application Tracker</h3>
              </div>
              <div style={{ border: `1px solid ${C.ink}`, padding: "6px 12px", fontFamily: F.mono, fontSize: "0.48rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "#15803d", display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#15803d" }} />
                Active
              </div>
            </div>

            <div style={{ border: `1px solid ${C.ink}` }}>
              {[
                { name: "Stanford University", status: "In Progress", pct: 72, color: "#b45309" },
                { name: "MIT", status: "Complete", pct: 100, color: "#15803d" },
                { name: "Harvard University", status: "Essay Due", pct: 35, color: C.red },
              ].map((row, i, arr) => (
                <div key={row.name} style={{ borderBottom: i < arr.length - 1 ? `1px solid ${C.muted}` : "none", padding: "12px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "32px", height: "32px", border: `1px solid ${C.ink}`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F.mono, fontSize: "0.5rem", fontWeight: 700, color: C.ink }}>
                    {row.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: F.sans, fontSize: "0.82rem", fontWeight: 600, color: C.ink, marginBottom: "6px" }}>{row.name}</div>
                    <div style={{ height: "3px", backgroundColor: C.muted }}>
                      <div style={{ width: `${row.pct}%`, height: "100%", backgroundColor: row.color }} />
                    </div>
                  </div>
                  <span style={{ fontFamily: F.mono, fontSize: "0.44rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" as const, color: row.color, border: `1px solid ${row.color}`, padding: "3px 7px", flexShrink: 0 }}>
                    {row.status}
                  </span>
                </div>
              ))}
            </div>

            <p style={{ fontFamily: F.body, fontSize: "0.875rem", color: C.n600, lineHeight: 1.7, marginTop: "20px" }}>
              Track every school, deadline, and requirement in one place. Filter by status, sort by deadline, and never miss a step.
            </p>
          </div>

          {/* Scholarship Finder — red accent bg */}
          <div style={{ borderRight: `1px solid ${C.ink}`, padding: "40px 36px", backgroundColor: C.red }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px" }}>
              <div>
                <div style={{ fontFamily: F.mono, fontSize: "0.5rem", letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.5)", marginBottom: "4px" }}>Module 02</div>
                <h3 style={{ fontFamily: F.serif, fontSize: "1.5rem", fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>Scholarship Finder</h3>
              </div>
              <span style={{ fontFamily: F.mono, fontSize: "0.48rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: C.red, backgroundColor: "#fff", padding: "4px 10px" }}>
                AI Powered
              </span>
            </div>
            <p style={{ fontFamily: F.body, fontSize: "0.95rem", color: "rgba(255,255,255,0.8)", lineHeight: 1.7, marginBottom: "28px" }}>
              Our matching engine scans thousands of scholarships and surfaces the ones you&apos;re most likely to win — ranked by fit score.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", border: "1px solid rgba(255,255,255,0.3)" }}>
              {[
                { val: "$12k", label: "Avg. Award Found" },
                { val: "94%", label: "Match Accuracy" },
                { val: "5k+", label: "Scholarships Listed" },
                { val: "3 min", label: "Setup Time" },
              ].map((stat, i) => (
                <div key={stat.label} style={{ padding: "16px 20px", borderRight: i % 2 === 0 ? "1px solid rgba(255,255,255,0.3)" : "none", borderBottom: i < 2 ? "1px solid rgba(255,255,255,0.3)" : "none" }}>
                  <div style={{ fontFamily: F.mono, fontSize: "1.6rem", fontWeight: 700, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1, marginBottom: "4px" }}>{stat.val}</div>
                  <div style={{ fontFamily: F.mono, fontSize: "0.48rem", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.55)" }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   More Features
   ═══════════════════════════════════════════════════════════════ */

function MoreFeatures() {
  return (
    <section style={{ borderBottom: `4px solid ${C.ink}`, backgroundColor: C.bg }}>
      <div className="max-w-screen-xl mx-auto px-6">
        <div className="grid md:grid-cols-2" style={{ borderLeft: `1px solid ${C.muted}` }}>
          {/* Essay Workshop */}
          <div style={{ borderRight: `1px solid ${C.muted}`, padding: "40px 36px" }}>
            <div style={{ border: `1px solid ${C.ink}`, width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "20px" }}>
              <BookOpen size={20} strokeWidth={1.5} color={C.ink} />
            </div>
            <h3 style={{ fontFamily: F.serif, fontSize: "1.5rem", fontWeight: 700, color: C.ink, letterSpacing: "-0.02em", marginBottom: "12px" }}>Essay Workshop</h3>
            <HRule />
            <p style={{ fontFamily: F.body, fontSize: "0.9rem", color: C.n600, lineHeight: 1.75, margin: "16px 0 24px", textAlign: "justify" as const }}>
              Interactive prompts guide you from blank page to compelling draft. Version tracking lets you compare revisions, roll back, and refine without fear.
            </p>
            <div style={{ border: `1px solid ${C.ink}`, backgroundColor: C.n100 }}>
              <div style={{ borderBottom: `1px solid ${C.muted}`, padding: "6px 12px", display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontFamily: F.mono, fontSize: "0.5rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: C.n500 }}>Draft v4 — Common App Essay</span>
                <div style={{ marginLeft: "auto", width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#15803d" }} />
              </div>
              <div style={{ padding: "16px" }}>
                {[
                  { text: "The moment I realized I wanted to", highlight: true },
                  { text: "study computational biology was", highlight: false },
                  { text: "the summer I turned sixteen...", highlight: false },
                ].map((line, i) => (
                  <div key={i} style={{ fontFamily: F.body, fontSize: "0.78rem", color: line.highlight ? C.ink : C.n400, padding: "4px 8px", marginBottom: "2px", borderLeft: line.highlight ? `2px solid ${C.red}` : "2px solid transparent", backgroundColor: line.highlight ? "rgba(204,0,0,0.04)" : "transparent" }}>
                    {line.text}
                  </div>
                ))}
                <span className="np-cursor" style={{ display: "inline-block", width: "2px", height: "14px", backgroundColor: C.red, marginLeft: "8px", verticalAlign: "middle" }} />
              </div>
            </div>
          </div>

          {/* Resume Builder */}
          <div style={{ borderRight: `1px solid ${C.muted}`, padding: "40px 36px" }}>
            <div style={{ border: `1px solid ${C.ink}`, width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "20px" }}>
              <FileText size={20} strokeWidth={1.5} color={C.ink} />
            </div>
            <h3 style={{ fontFamily: F.serif, fontSize: "1.5rem", fontWeight: 700, color: C.ink, letterSpacing: "-0.02em", marginBottom: "12px" }}>Resume Builder</h3>
            <HRule />
            <p style={{ fontFamily: F.body, fontSize: "0.9rem", color: C.n600, lineHeight: 1.75, margin: "16px 0 16px", textAlign: "justify" as const }}>
              Guided templates built for college applications — highlight your activities, awards, and leadership exactly the way admissions officers want to see them.
            </p>
            <Link href="/signup" className="hover:underline" style={{ fontFamily: F.sans, fontSize: "0.7rem", fontWeight: 700, color: C.red, letterSpacing: "0.08em", textTransform: "uppercase" as const, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px", marginBottom: "28px" }}>
              Explore Templates
              <ArrowRight size={13} strokeWidth={2.5} />
            </Link>
            <div style={{ position: "relative", height: "100px" }}>
              {[
                { rotate: "3deg", top: "16px", bg: C.muted, z: 1 },
                { rotate: "-2deg", top: "8px", bg: C.n200, z: 2 },
                { rotate: "0deg", top: "0", bg: "#fff", z: 3 },
              ].map((card, i) => (
                <div key={i} style={{ position: "absolute", top: card.top, left: 0, width: "180px", border: `1px solid ${C.muted}`, backgroundColor: card.bg, padding: "12px", transform: `rotate(${card.rotate})`, zIndex: card.z, boxShadow: i === 2 ? `2px 2px 0 0 ${C.ink}` : "none" }}>
                  {i === 2 && (
                    <>
                      <div style={{ height: "6px", width: "75px", backgroundColor: C.ink, marginBottom: "6px" }} />
                      <div style={{ height: "3px", width: "52px", backgroundColor: C.muted, marginBottom: "10px" }} />
                      {[72, 50, 88, 42].map((w, j) => (
                        <div key={j} style={{ height: "3px", width: `${w}%`, backgroundColor: j === 0 ? C.red : C.muted, marginBottom: "4px" }} />
                      ))}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Three Steps
   ═══════════════════════════════════════════════════════════════ */

function ThreeSteps() {
  const steps = [
    { n: "01", title: "Sign up for CAAT", desc: "Create your free account in under 60 seconds. No credit card, no commitment. Just your future." },
    { n: "02", title: "Add Your Dream Schools", desc: "Search from 4,000+ universities and add them to your personalized dashboard in seconds." },
    { n: "03", title: "Complete Your Journey", desc: "Track essays, deadlines, and documents as you submit each application with confidence." },
  ];

  return (
    <section id="how-it-works" style={{ borderBottom: `4px solid ${C.ink}`, backgroundImage: DOT_BG, backgroundColor: C.bg }}>
      <div className="max-w-screen-xl mx-auto px-6">
        <div className="grid lg:grid-cols-12" style={{ borderLeft: `1px solid ${C.muted}` }}>
          <div className="lg:col-span-5" style={{ borderRight: `1px solid ${C.muted}`, padding: "48px 40px 48px 0", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <SectionLabel red>How It Works</SectionLabel>
            <h2 style={{ fontFamily: F.serif, fontSize: "clamp(2.2rem, 4vw, 3.2rem)", fontWeight: 900, color: C.ink, letterSpacing: "-0.03em", lineHeight: 1.0, marginTop: "16px", marginBottom: "20px" }}>
              Your Journey
              <br />
              <span style={{ color: C.red }}>in Three Steps</span>
            </h2>
            <HRule />
            <p style={{ fontFamily: F.body, fontSize: "1rem", color: C.n600, lineHeight: 1.7, marginTop: "20px", marginBottom: "32px", textAlign: "justify" as const }}>
              From first login to submitted application — CAAT guides every step of the process with clarity and precision.
            </p>
            <PrimaryBtn href="/signup" size="lg">
              Start Your Journey
              <ArrowRight size={16} strokeWidth={2.5} />
            </PrimaryBtn>
          </div>

          <div className="lg:col-span-7" style={{ padding: "48px 0 48px 40px" }}>
            {steps.map((step, i) => (
              <div key={step.n} style={{ borderBottom: i < steps.length - 1 ? `1px solid ${C.muted}` : "none", padding: i === 0 ? "0 0 36px 0" : "36px 0", display: "grid", gridTemplateColumns: "68px 1fr", gap: "24px", alignItems: "start" }}>
                <div style={{ fontFamily: F.serif, fontSize: "3.5rem", fontWeight: 900, color: i === 0 ? C.red : C.muted, lineHeight: 1, letterSpacing: "-0.04em" }}>
                  {step.n}
                </div>
                <div>
                  <h4 style={{ fontFamily: F.sans, fontSize: "0.75rem", fontWeight: 700, color: C.ink, letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: "10px", paddingBottom: "10px", borderBottom: `2px solid ${i === 0 ? C.red : C.muted}` }}>
                    {step.title}
                  </h4>
                  <p style={{ fontFamily: F.body, fontSize: "0.9rem", color: C.n600, lineHeight: 1.75 }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Security Banner — Inverted
   ═══════════════════════════════════════════════════════════════ */

function SecurityBanner() {
  return (
    <section id="scholarships" style={{ backgroundColor: C.ink, borderBottom: `4px solid ${C.red}`, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4' viewBox='0 0 4 4'%3E%3Cpath fill='%23ffffff' fill-opacity='0.03' d='M1 3h1v1H1V3zm2-2h1v1H3V1z'%3E%3C/path%3E%3C/svg%3E")`, pointerEvents: "none" as const }} />

      <div className="max-w-screen-xl mx-auto px-6 relative">
        <div className="grid lg:grid-cols-12" style={{ borderLeft: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="lg:col-span-6" style={{ borderRight: "1px solid rgba(255,255,255,0.08)", padding: "56px 40px 56px 0" }}>
            <div style={{ marginBottom: "20px" }}><SectionLabel>Enterprise Security</SectionLabel></div>
            <h2 style={{ fontFamily: F.serif, fontSize: "clamp(2.2rem, 4vw, 3.5rem)", fontWeight: 900, color: "#fff", letterSpacing: "-0.03em", lineHeight: 0.95, marginBottom: "20px" }}>
              Fortress-Level
              <br />
              <span style={{ color: C.red }}>Security</span>
            </h2>
            <HRule color="rgba(255,255,255,0.12)" />
            <p style={{ fontFamily: F.body, fontSize: "0.95rem", color: "rgba(255,255,255,0.6)", lineHeight: 1.75, marginTop: "20px", marginBottom: "28px", maxWidth: "400px", textAlign: "justify" as const }}>
              Built on Supabase infrastructure with military-grade encryption. Your transcripts, essays, and personal data are protected by the same standards trusted by Fortune 500 companies.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
              {[
                { icon: CheckCircle, label: "SOC2 Compliant" },
                { icon: Lock, label: "AES-256 Encryption" },
              ].map((badge) => (
                <div key={badge.label} style={{ border: "1px solid rgba(255,255,255,0.18)", padding: "10px 16px", display: "flex", alignItems: "center", gap: "8px", fontFamily: F.mono, fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "#fff" }}>
                  <badge.icon size={14} color={C.red} strokeWidth={2} />
                  {badge.label}
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-6" style={{ borderRight: "1px solid rgba(255,255,255,0.08)", padding: "56px 0 56px 40px", display: "flex", alignItems: "center" }}>
            <div style={{ border: "1px solid rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.04)", padding: "36px", width: "100%" }}>
              <div style={{ fontFamily: F.serif, fontSize: "5rem", fontWeight: 900, color: C.red, lineHeight: 0.8, marginBottom: "8px" }}>&ldquo;</div>
              <div style={{ display: "flex", gap: "4px", marginBottom: "16px" }}>
                {[...Array(5)].map((_, i) => <Star key={i} size={13} color={C.red} fill={C.red} />)}
              </div>
              <p style={{ fontFamily: F.body, fontSize: "1.05rem", color: "rgba(255,255,255,0.85)", lineHeight: 1.75, fontStyle: "italic", marginBottom: "24px", textAlign: "justify" as const }}>
                CAAT kept all my documents organized and secure. I never had to worry about losing my work — and I got into my top choice.
              </p>
              <HRule color="rgba(255,255,255,0.1)" />
              <div style={{ marginTop: "20px", display: "flex", alignItems: "center", gap: "14px" }}>
                <div style={{ width: "44px", height: "44px", border: "1px solid rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F.sans, fontSize: "0.75rem", fontWeight: 700, color: "#fff", backgroundColor: "rgba(204,0,0,0.3)" }}>
                  SM
                </div>
                <div>
                  <div style={{ fontFamily: F.sans, fontSize: "0.875rem", fontWeight: 700, color: "#fff", marginBottom: "2px" }}>Sarah M.</div>
                  <div style={{ fontFamily: F.mono, fontSize: "0.5rem", letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.4)" }}>
                    Class of 2025 · Stanford University
                  </div>
                </div>
                <div style={{ marginLeft: "auto", fontFamily: F.mono, fontSize: "0.46rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "#15803d", border: "1px solid rgba(21,128,61,0.4)", padding: "4px 10px", display: "flex", alignItems: "center", gap: "5px" }}>
                  <div style={{ width: "5px", height: "5px", borderRadius: "50%", backgroundColor: "#15803d" }} />
                  Verified
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Final CTA
   ═══════════════════════════════════════════════════════════════ */

function FinalCTA() {
  return (
    <section style={{ borderBottom: `4px solid ${C.ink}`, backgroundColor: C.bg, backgroundImage: DOT_BG }}>
      <OrnamentalDivider />
      <div className="max-w-screen-xl mx-auto px-6" style={{ paddingBottom: "64px" }}>
        <div style={{ border: `1px solid ${C.ink}`, padding: "56px 48px", textAlign: "center", position: "relative", maxWidth: "760px", margin: "0 auto" }}>
          {/* Corner dots */}
          {[{ top: "-5px", left: "-5px" }, { top: "-5px", right: "-5px" }, { bottom: "-5px", left: "-5px" }, { bottom: "-5px", right: "-5px" }].map((pos, i) => (
            <div key={i} style={{ position: "absolute", width: "9px", height: "9px", backgroundColor: C.red, ...pos }} />
          ))}
          <div style={{ marginBottom: "16px" }}><SectionLabel red>Limited Spots Available</SectionLabel></div>
          <h2 style={{ fontFamily: F.serif, fontSize: "clamp(2.5rem, 5vw, 4.5rem)", fontWeight: 900, color: C.ink, letterSpacing: "-0.035em", lineHeight: 0.95, marginBottom: "20px" }}>
            Ready to start
            <br />
            your{" "}
            <span style={{ color: C.red, textDecoration: "underline", textDecorationColor: C.red, textDecorationThickness: "4px", textUnderlineOffset: "8px" }}>
              journey?
            </span>
          </h2>
          <HRule thick />
          <p style={{ fontFamily: F.body, fontSize: "1.05rem", color: C.n600, lineHeight: 1.75, maxWidth: "440px", margin: "20px auto 32px" }}>
            The best time to start was yesterday. The second best time is now.
          </p>
          <div className="flex flex-wrap justify-center gap-4" style={{ marginBottom: "28px" }}>
            <PrimaryBtn href="/signup" size="lg">
              Get Started for Free
              <ArrowRight size={16} strokeWidth={2.5} />
            </PrimaryBtn>
            <SecondaryBtn size="lg">
              Talk to an Advisor
              <Users size={16} strokeWidth={1.5} />
            </SecondaryBtn>
          </div>
          <p style={{ fontFamily: F.mono, fontSize: "0.52rem", fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: C.n400 }}>
            No credit card required &nbsp;·&nbsp; Secure data storage &nbsp;·&nbsp; Expert support
          </p>
        </div>
      </div>
      <OrnamentalDivider />
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Footer
   ═══════════════════════════════════════════════════════════════ */

function Footer() {
  return (
    <footer style={{ backgroundColor: C.ink, color: C.bg }}>
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "40px 0" }}>
        <div className="max-w-screen-xl mx-auto px-6">
          <div className="grid md:grid-cols-12 gap-8">
            <div className="md:col-span-4">
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                <Image src="/logo.png" alt="CAAT" width={28} height={28} style={{ borderRadius: 0, filter: "brightness(0) invert(1)" }} />
                <span style={{ fontFamily: F.serif, fontSize: "1.4rem", fontWeight: 900, color: "#fff", letterSpacing: "-0.02em" }}>CAAT</span>
              </div>
              <p style={{ fontFamily: F.body, fontSize: "0.82rem", color: "rgba(255,255,255,0.4)", lineHeight: 1.7, maxWidth: "240px" }}>
                The definitive college application platform for the next generation of students.
              </p>
            </div>

            <div className="md:col-span-5 flex flex-wrap gap-x-8 gap-y-3 items-start md:pt-2">
              {["Privacy Policy", "Terms of Service", "Contact Us", "Help Center"].map((link) => (
                <a key={link} href="#" className="transition-colors duration-200 hover:text-white" style={{ fontFamily: F.sans, fontSize: "0.72rem", fontWeight: 600, color: "rgba(255,255,255,0.45)", textDecoration: "none", letterSpacing: "0.02em" }}>
                  {link}
                </a>
              ))}
            </div>

            <div className="md:col-span-3 md:text-right">
              <div style={{ fontFamily: F.mono, fontSize: "0.5rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: C.red, marginBottom: "4px" }}>
                The College Edition
              </div>
              <div style={{ fontFamily: F.mono, fontSize: "0.48rem", color: "rgba(255,255,255,0.22)", letterSpacing: "0.08em", lineHeight: 1.9 }}>
                Vol. 1 · Est. 2024<br />
                Printed in New York City<br />
                Fig. 1.0 — Launch Edition
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: "14px 0" }}>
        <div className="max-w-screen-xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#15803d" }} />
            <span style={{ fontFamily: F.mono, fontSize: "0.48rem", color: "rgba(255,255,255,0.28)", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>
              System Operational
            </span>
          </div>
          <p style={{ fontFamily: F.mono, fontSize: "0.48rem", color: "rgba(255,255,255,0.22)", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>
            © {new Date().getFullYear()} CAAT — All Rights Reserved
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Root Export
   ═══════════════════════════════════════════════════════════════ */

export default function LandingPage() {
  return (
    <>
      {/* Newsprint fonts: Playfair Display, Lora, Inter, JetBrains Mono */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,900;1,400&family=Lora:ital,wght@0,400;0,600;1,400&display=block"
        rel="stylesheet"
      />

      <div style={{ backgroundColor: C.bg, color: C.ink, minHeight: "100vh" }}>
        <Navbar />
        <main>
          <Hero />
          <NewsTicker />
          <FeaturesGrid />
          <ProductShowcase />
          <MoreFeatures />
          <ThreeSteps />
          <SecurityBanner />
          <FinalCTA />
        </main>
        <Footer />
      </div>
    </>
  );
}
