import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
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
            New here?{" "}
            <Link href="/signup" className="text-black underline underline-offset-4 hover:no-underline">
              Create account
            </Link>
          </p>
        </div>

        {/* Form */}
        <div className="flex flex-1 items-center justify-center px-8 py-12">
          <div className="w-full max-w-sm">
            <Suspense>
              <LoginForm />
            </Suspense>
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
              "repeating-linear-gradient(45deg,transparent,transparent 40px,#ffffff08 40px,#ffffff08 42px)",
          }}
        />

        {/* Decorative corner mark */}
        <div className="relative flex justify-end">
          <div className="w-5 h-5 border border-white opacity-40" aria-hidden />
        </div>

        {/* Editorial statement */}
        <div className="relative space-y-8">
          <div className="h-[4px] w-16 bg-white" aria-hidden />
          <blockquote
            className="text-5xl xl:text-6xl font-bold italic leading-[1.08] tracking-tight font-display"
          >
            Where futures are written.
          </blockquote>
          <p className="text-[#888] text-base font-serif leading-relaxed max-w-sm">
            Every great university journey begins with a plan. CAAT gives you the clarity to execute yours.
          </p>
        </div>

        {/* Bottom attribution */}
        <div className="relative border-t border-white/20 pt-6">
          <p className="text-[11px] text-[#666] font-code tracking-[0.12em]">
            TRUSTED BY 2,000+ STUDENTS THIS CYCLE
          </p>
        </div>
      </div>
    </div>
  );
}
