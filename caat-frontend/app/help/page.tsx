"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronDown } from "lucide-react";

/**
 * /help — the CAAT help centre. A grouped FAQ that answers the things a
 * student actually wonders before and while using the app, in a plain,
 * human voice. Accordion items so the page stays scannable.
 */

interface Faq {
  q: string;
  a: React.ReactNode;
}

interface FaqGroup {
  label: string;
  items: Faq[];
}

const GROUPS: FaqGroup[] = [
  {
    label: "Getting started",
    items: [
      {
        q: "What is CAAT, in plain terms?",
        a: (
          <>
            It is one place to plan your path to university. Instead of living
            in five browser tabs and a messy spreadsheet, you keep your
            deadlines, essays, universities, courses, scholarships, resume, and
            documents together, and CAAT keeps track of what is due and what is
            left to do. CAAT does not submit anything for you: you still apply
            through UAC, VTAC, QTAC, SATAC, TISC or directly to the university,
            and through each scholarship provider.
          </>
        ),
      },
      {
        q: "Is it free?",
        a: (
          <>
            Yes, you can start for free. We are in early release right now, so
            the people who join early get full access while we keep building.
            If we ever add paid features later, anything you are already using
            will not get pulled out from under you without plenty of warning.
          </>
        ),
      },
      {
        q: "Who is it for?",
        a: (
          <>
            Mostly Australian high school students in Years 10 to 12 planning
            for university, and anyone helping them. If you are juggling a few
            universities, a couple of scholarship deadlines, and an essay or
            two, you are exactly who we built this for. It works whether you
            are aiming for one university or several, here or overseas.
          </>
        ),
      },
      {
        q: "How do I actually get going?",
        a: (
          <>
            Sign up, then answer five quick questions: your year level, whether
            you will study as a domestic or international student, where and
            what you would like to study, and where you are up to. That is what
            lets CAAT tailor your scholarship and university suggestions. After
            that, save a university or add a deadline and you are off.
          </>
        ),
      },
    ],
  },
  {
    label: "The tools",
    items: [
      {
        q: "Will it write my essays for me?",
        a: (
          <>
            No, and that is on purpose. Selection panels can spot a generated
            essay, and so can your future self. CAAT helps you get from a blank
            page to a real draft with prompts and tips, and lets you keep
            several drafts so you never lose a good line. The words stay yours.
          </>
        ),
      },
      {
        q: "How does the resume builder work?",
        a: (
          <>
            You fill in guided sections (education, experience, activities,
            skills) and watch a clean, properly formatted resume build itself
            on the right as you type. When you are happy, export it to PDF. No
            fighting with margins in a word processor.
          </>
        ),
      },
      {
        q: "Does it find scholarships I can actually apply for?",
        a: (
          <>
            It surfaces scholarships and tags the ones that fit your profile, so
            a strong match for your field of study, country, and level floats to
            the top. Change your target majors or countries in your profile and
            the matches update straight away. Always read the official eligibility
            on the scholarship itself before you apply, since rules can change.
          </>
        ),
      },
      {
        q: "Can it keep me on top of deadlines?",
        a: (
          <>
            Yes. Add your application and scholarship deadlines and they show up
            on Today and your dashboard counting down, so the thing due in three
            days is never a surprise at 11pm. You can see everything at a glance instead
            of digging through emails.
          </>
        ),
      },
      {
        q: "What about all my documents?",
        a: (
          <>
            The document vault is where your school reports, ID, English test
            results, and references live. Link each file to the applications
            that need it, and each application shows which documents are
            uploaded and which are still missing.
          </>
        ),
      },
    ],
  },
  {
    label: "Your data and privacy",
    items: [
      {
        q: "Is my information safe?",
        a: (
          <>
            Your data sits behind your account and is not visible to other
            users. We only collect what we need to run the app, and you can read
            exactly what that is in our{" "}
            <Link href="/privacy" className="underline hover:text-black">
              privacy policy
            </Link>
            .
          </>
        ),
      },
      {
        q: "Do you sell my data?",
        a: (
          <>
            No. We do not sell your information to advertisers or anyone else,
            and we do not use your essays or profile to train AI models. That is
            not the deal.
          </>
        ),
      },
      {
        q: "Can I delete my account and everything in it?",
        a: (
          <>
            Yes, any time. You can export your data or delete your account
            outright, and when you delete, it is gone. If you ever want a hand
            with that, email us and we will sort it.
          </>
        ),
      },
      {
        q: "Can my parents or my careers adviser see my stuff?",
        a: (
          <>
            Only if you show them. Your account is yours. Nothing you put in CAAT
            is shared with a parent, school, or careers adviser unless you
            choose to share it.
          </>
        ),
      },
    ],
  },
  {
    label: "Account and access",
    items: [
      {
        q: "Can I use CAAT on my phone?",
        a: (
          <>
            Yes, it runs in your phone browser, so you can check a deadline or
            tweak an essay on the bus. The bigger jobs like building a resume
            tend to feel better on a laptop, but nothing is locked to desktop.
          </>
        ),
      },
      {
        q: "I forgot my password.",
        a: (
          <>
            Use the forgot password link on the login page and we will email you
            a reset. If it does not show up, check your spam folder, then email
            us if it is still missing.
          </>
        ),
      },
      {
        q: "I signed up with Google. Do I need a password too?",
        a: (
          <>
            No. If you signed in with Google, just keep using the Google button
            and you are in. You do not need to set a separate password.
          </>
        ),
      },
    ],
  },
  {
    label: "Everything else",
    items: [
      {
        q: "Is CAAT connected to any specific university?",
        a: (
          <>
            No. We are independent, so the suggestions you get are not steered by
            any university paying to be there. We are not part of UAC, VTAC,
            QTAC, SATAC or TISC either. University and scholarship info comes
            from public sources, and we point you to the official page for the
            final word.
          </>
        ),
      },
      {
        q: "Some scholarship or deadline info looks wrong.",
        a: (
          <>
            It happens, since these change often and we pull from a lot of
            sources. Always trust the official scholarship or university page
            over what you see here, and if you spot something off, tell us so we
            can fix it for the next person.
          </>
        ),
      },
      {
        q: "I found a bug, or I have an idea.",
        a: (
          <>
            We genuinely want to hear it. We are early and shaping this around
            real students, so a quick email about what broke or what would make
            your life easier actually changes what we build next. Reach us at{" "}
            <a
              href="mailto:contact@purpl.au"
              className="underline hover:text-black"
            >
              contact@purpl.au
            </a>
            .
          </>
        ),
      },
    ],
  },
];

export default function HelpCenterPage() {
  return (
    <div className="min-h-screen bg-white text-black font-serif">
      {/* Top bar */}
      <header className="border-b border-black px-8 py-6 flex items-center justify-between max-w-6xl mx-auto">
        <Link
          href="/"
          className="flex items-center focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-black focus-visible:outline-offset-2"
        >
          <Image
            src="/logo.png"
            alt="CAAT"
            width={72}
            height={28}
            className="object-contain"
            priority
          />
        </Link>
        <Link
          href="/"
          className="text-xs font-code tracking-wide text-[#525252] hover:text-black hover:underline"
        >
          ← Back to home
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 lg:px-12 py-16 md:py-24">
        {/* Title */}
        <div className="mb-12 border-b border-[#E5E5E5] pb-8">
          <p className="text-[11px] tracking-[0.18em] uppercase text-[#9a1a27] mb-4 font-code">
            Support
          </p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-none mb-4 font-display">
            Help Center
          </h1>
          <p className="text-base text-[#525252]">
            The questions students ask us most, answered straight. Cannot find
            yours? Email{" "}
            <a
              href="mailto:contact@purpl.au"
              className="underline hover:text-black"
            >
              contact@purpl.au
            </a>{" "}
            and a real person will get back to you.
          </p>
        </div>

        {/* FAQ groups */}
        <div className="space-y-14">
          {GROUPS.map((group) => (
            <section key={group.label}>
              <h2 className="text-[11px] tracking-[0.18em] uppercase text-[#525252] mb-5 font-code">
                {group.label}
              </h2>
              <div className="border-t border-black">
                {group.items.map((item) => (
                  <FaqItem key={item.q} q={item.q} a={item.a} />
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Still stuck */}
        <div className="mt-20 border-2 border-black p-8 md:p-10">
          <h3 className="text-2xl font-bold font-display mb-2">
            Still stuck?
          </h3>
          <p className="text-[#525252] mb-6">
            We are a small team and we actually read these. Tell us what is
            going on and we will help you out.
          </p>
          <a
            href="mailto:contact@purpl.au"
            className="inline-flex items-center justify-center gap-2 bg-[#9a1a27] text-white text-[11px] tracking-[0.18em] uppercase px-8 py-4 border border-[#9a1a27] hover:bg-white hover:text-[#9a1a27] transition-colors duration-100 font-code"
          >
            Email us
          </a>
        </div>
      </main>
    </div>
  );
}

function FaqItem({ q, a }: Faq) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-black">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 py-5 text-left group"
      >
        <span className="font-display font-bold text-lg md:text-xl leading-snug">
          {q}
        </span>
        <ChevronDown
          size={20}
          strokeWidth={1.5}
          className={`shrink-0 text-[#9a1a27] transition-transform duration-150 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div className="pb-6 -mt-1 text-[#333] leading-relaxed max-w-2xl">
          {a}
        </div>
      )}
    </div>
  );
}
