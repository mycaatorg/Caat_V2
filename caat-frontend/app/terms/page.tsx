import Link from "next/link";
import Image from "next/image";

const LAST_UPDATED = "April 2026";

export const metadata = {
  title: "Terms of Service — CAAT",
  description: "Terms of Service for CAAT, the College Application Assistance Tool.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white text-black font-serif">
      {/* Top bar */}
      <header className="border-b border-black px-8 py-6 flex items-center justify-between max-w-6xl mx-auto">
        <Link href="/" className="flex items-center focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-black focus-visible:outline-offset-2">
          <Image src="/logo.png" alt="CAAT" width={72} height={28} className="object-contain" priority />
        </Link>
        <Link href="/" className="text-xs font-code tracking-wide text-[#525252] hover:text-black hover:underline">
          ← Back to home
        </Link>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 lg:px-12 py-16 md:py-24">
        {/* Page title */}
        <div className="mb-12 border-b border-[#E5E5E5] pb-8">
          <p className="text-[11px] tracking-[0.18em] uppercase text-[#525252] mb-4 font-code">Legal</p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-none mb-4 font-display">
            Terms of Service
          </h1>
          <p className="text-sm text-[#525252] font-code">Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="space-y-10 text-[#333] leading-relaxed">

          <section>
            <h2 className="text-xl font-bold font-display mb-3 text-black">1. Acceptance of Terms</h2>
            <p>
              By accessing or using CAAT (College Application Assistance Tool) at any of our web
              addresses or applications ("Service"), you agree to be bound by these Terms of Service
              ("Terms"). If you do not agree to these Terms, do not use the Service.
            </p>
            <p className="mt-3">
              We may update these Terms from time to time. Continued use of the Service after any
              changes constitutes your acceptance of the new Terms. We will make reasonable efforts
              to notify users of significant changes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold font-display mb-3 text-black">2. Description of Service</h2>
            <p>
              CAAT is a college application tracking platform that helps students organize their
              university applications, deadlines, essays, documents, scholarships, and resumes.
              The Service is provided for personal, non-commercial use.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold font-display mb-3 text-black">3. Eligibility</h2>
            <p>
              You must be at least 13 years old to use the Service. If you are under 18, you
              confirm that you have parental or guardian consent to use the Service and that they
              have reviewed and agreed to these Terms on your behalf.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold font-display mb-3 text-black">4. Your Account</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials
              and for all activity that occurs under your account. You agree to notify us immediately
              of any unauthorised use of your account.
            </p>
            <p className="mt-3">
              You must provide accurate and complete information when creating your account. Accounts
              created with false information may be suspended or terminated.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold font-display mb-3 text-black">5. User Content</h2>
            <p>
              You retain full ownership of any content you upload or create within the Service,
              including essays, documents, and profile information ("User Content"). By uploading
              content, you grant CAAT a limited licence to store and display that content solely for
              the purpose of providing the Service to you.
            </p>
            <p className="mt-3">
              You are solely responsible for ensuring that your User Content does not violate any
              third-party rights or applicable laws. You must not upload content that is unlawful,
              harmful, or infringes on the intellectual property of others.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold font-display mb-3 text-black">6. Acceptable Use</h2>
            <p>You agree not to use the Service to:</p>
            <ul className="list-disc ml-6 mt-3 space-y-1.5 text-sm">
              <li>Violate any applicable law or regulation</li>
              <li>Upload or transmit malicious code, viruses, or harmful content</li>
              <li>Attempt to gain unauthorised access to any part of the Service or its infrastructure</li>
              <li>Interfere with or disrupt the Service or its servers</li>
              <li>Scrape, harvest, or collect data from the Service without our written permission</li>
              <li>Impersonate any person or entity or misrepresent your affiliation</li>
              <li>Use the Service for any commercial purpose without prior written consent</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold font-display mb-3 text-black">7. Intellectual Property</h2>
            <p>
              All elements of the Service that are not User Content — including the platform design,
              software, branding, and underlying code — are owned by or licensed to CAAT and are
              protected by applicable intellectual property laws. You may not copy, modify,
              distribute, or create derivative works from any part of the Service without our
              express written permission.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold font-display mb-3 text-black">8. Third-Party Services</h2>
            <p>
              The Service relies on third-party infrastructure providers, including Supabase for
              authentication and data storage. Your use of the Service is also subject to the terms
              of those providers. We are not responsible for the practices of third-party services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold font-display mb-3 text-black">9. Disclaimers</h2>
            <p>
              The Service is provided "as is" and "as available" without warranties of any kind,
              express or implied. We do not guarantee that the Service will be uninterrupted,
              error-free, or free of harmful components. We make no guarantees regarding admission
              outcomes or scholarship results.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold font-display mb-3 text-black">10. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, CAAT and its team shall not be liable for any
              indirect, incidental, special, consequential, or punitive damages arising from your
              use of or inability to use the Service, even if we have been advised of the possibility
              of such damages.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold font-display mb-3 text-black">11. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your account at any time for violation
              of these Terms or for any other reason at our discretion. You may delete your account
              at any time. Upon termination, your right to use the Service ceases immediately.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold font-display mb-3 text-black">12. Governing Law</h2>
            <p>
              These Terms are governed by and construed in accordance with applicable laws. Any
              disputes arising from these Terms or your use of the Service will be resolved in the
              appropriate courts of the jurisdiction in which CAAT operates.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold font-display mb-3 text-black">13. Contact</h2>
            <p>
              If you have any questions about these Terms, please contact us. A contact email will
              be provided here once available.
            </p>
          </section>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E5E5E5] py-8 mt-16">
        <div className="max-w-3xl mx-auto px-6 lg:px-12 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-[11px] text-[#525252] font-code">
            © {new Date().getFullYear()} CAAT. All rights reserved.
          </p>
          <Link href="/" className="text-[11px] text-[#525252] font-code hover:text-black hover:underline">
            Back to home
          </Link>
        </div>
      </footer>
    </div>
  );
}
