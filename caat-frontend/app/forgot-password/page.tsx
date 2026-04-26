"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";
import { supabase } from "@/src/lib/supabaseClient";
import { preflightAuthAction } from "@/app/auth-actions";
import { TurnstileWidget, captchaEnabled } from "@/components/TurnstileWidget";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // G1 + D3 — rate limit + CAPTCHA before triggering Supabase reset email.
      const preflight = await preflightAuthAction({
        turnstileToken: captchaToken ?? undefined,
        intent: "forgot-password",
      });
      if (!preflight.ok) {
        setError(preflight.error);
        setLoading(false);
        return;
      }

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        { redirectTo: `${window.location.origin}/reset-password` }
      );
      if (resetError) throw resetError;
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col min-h-svh bg-white">
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-6 border-b border-[#E5E5E5]">
        <Link href="/" className="flex items-center focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-black focus-visible:outline-offset-2">
          <Image src="/logo.png" alt="CAAT" width={72} height={28} className="object-contain" priority />
        </Link>
        <Link
          href="/login"
          className="flex items-center gap-1.5 text-xs text-[#525252] font-code tracking-wide hover:text-black transition-colors"
        >
          <ArrowLeft size={12} strokeWidth={1.5} />
          Back to login
        </Link>
      </div>

      {/* Content */}
      <div className="flex flex-1 items-center justify-center px-8 py-12">
        <div className="w-full max-w-sm">
          {submitted ? (
            <div className="space-y-6">
              <div className="w-10 h-10 bg-black flex items-center justify-center">
                <Check size={18} strokeWidth={2} className="text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight font-display mb-2">
                  Check your email
                </h1>
                <p className="text-sm text-[#525252] font-serif leading-relaxed">
                  We sent a password reset link to{" "}
                  <strong className="text-black">{email}</strong>. Click the
                  link to set a new password.
                </p>
              </div>
              <p className="text-xs text-[#525252] font-code">
                Didn&apos;t receive it?{" "}
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="text-black underline underline-offset-4 hover:no-underline"
                >
                  Try again
                </button>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-0">
              <div className="mb-10">
                <h1 className="text-3xl font-bold tracking-tight font-display mb-2">
                  Reset password
                </h1>
                <p className="text-sm text-[#525252] font-serif">
                  Enter your email and we&apos;ll send you a reset link.
                </p>
              </div>

              {error && (
                <div className="mb-6 border-l-4 border-black bg-[#F5F5F5] px-4 py-3 text-sm text-black font-serif">
                  {error}
                </div>
              )}

              <div className="mb-10">
                <label htmlFor="email" className="block text-[11px] tracking-[0.12em] uppercase font-code text-[#525252] mb-2">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full bg-transparent border-0 border-b-2 border-black px-0 py-2 text-base text-black placeholder:text-[#BFBFBF] focus:border-b-[3px] focus:outline-none transition-none font-serif"
                />
              </div>

              <TurnstileWidget onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />

              <button
                type="submit"
                disabled={loading || (captchaEnabled && !captchaToken)}
                className="w-full bg-black text-white text-[11px] tracking-[0.18em] uppercase px-8 py-4 border border-black hover:bg-white hover:text-black transition-colors duration-100 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-black focus-visible:outline-offset-[3px] font-code disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? "Sending…" : (
                  <>
                    Send reset link
                    <ArrowRight size={13} strokeWidth={1.5} />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
