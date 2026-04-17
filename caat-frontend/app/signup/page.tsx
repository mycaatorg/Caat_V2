import Image from "next/image";
import Link from "next/link";
import { SignupForm } from "@/components/signup-form";

export default function SignupPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Left — form side */}
      <div className="flex flex-col bg-white">
        {/* Top bar with logo */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-[#E5E5E5]">
          <Link href="/" className="flex items-center focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-black focus-visible:outline-offset-2">
            <Image src="/logo.png" alt="CAAT" width={72} height={28} className="object-contain" priority />
          </Link>
          <p className="text-xs text-[#525252] font-code tracking-wide">
            Have an account?{" "}
            <Link href="/login" className="text-black underline underline-offset-4 hover:no-underline">
              Log in
            </Link>
          </p>
        </div>

        {/* Form */}
        <div className="flex flex-1 items-center justify-center px-8 py-12">
          <div className="w-full max-w-sm">
            <SignupForm />
          </div>
        </div>
      </div>

      {/* Right — editorial statement */}
      <div className="hidden lg:flex flex-col justify-between bg-black text-white p-12 relative overflow-hidden">
        {/* Texture */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg,transparent,transparent 1px,#ffffff 1px,#ffffff 2px)",
            backgroundSize: "100% 4px",
            opacity: 0.025,
          }}
        />

        {/* Decorative corner mark */}
        <div className="relative flex justify-end">
          <div className="w-5 h-5 bg-white opacity-20" aria-hidden />
        </div>

        {/* Editorial statement */}
        <div className="relative space-y-8">
          <div className="h-[4px] w-16 bg-white" aria-hidden />
          <blockquote
            className="text-5xl xl:text-6xl font-bold italic leading-[1.08] tracking-tight font-display"
          >
            Your journey starts here.
          </blockquote>
          <p className="text-[#888] text-base font-serif leading-relaxed max-w-sm">
            Join thousands of students who&apos;ve used CAAT to organize their applications, track deadlines, and get into their dream schools.
          </p>

          {/* Mini stats */}
          <div className="grid grid-cols-2 gap-4 pt-4">
            {[
              { stat: "4,000+", label: "Universities" },
              { stat: "2,000+", label: "Students" },
            ].map(({ stat, label }) => (
              <div key={label} className="border border-white/20 p-4">
                <div className="text-3xl font-bold font-display">{stat}</div>
                <div className="text-[11px] text-[#888] font-code tracking-[0.1em] mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div className="relative border-t border-white/20 pt-6">
          <p className="text-[11px] text-[#666] font-code tracking-[0.12em]">
            FREE TO START — NO CREDIT CARD REQUIRED
          </p>
        </div>
      </div>
    </div>
  );
}
