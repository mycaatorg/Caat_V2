"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/src/lib/supabaseClient";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setSessionReady(true);
      setCheckingSession(false);
    });

    // D1 — getUser() validates the JWT against the Supabase Auth server,
    // unlike getSession() which trusts whatever is in local storage.
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setSessionReady(true);
      setCheckingSession(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col min-h-svh bg-white">
      {/* Top bar */}
      <div className="flex items-center px-8 py-6 border-b border-[#E5E5E5]">
        <Link href="/" className="flex items-center focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-black focus-visible:outline-offset-2">
          <Image src="/logo.png" alt="CAAT" width={72} height={28} className="object-contain" priority />
        </Link>
      </div>

      {/* Content */}
      <div className="flex flex-1 items-center justify-center px-8 py-12">
        <div className="w-full max-w-sm">
          {checkingSession ? (
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 border-2 border-[#E5E5E5] border-t-black animate-spin" />
              <span className="text-sm text-[#525252] font-code">Verifying link…</span>
            </div>
          ) : !sessionReady ? (
            <div className="space-y-6">
              <div className="h-[4px] w-12 bg-black" />
              <h1 className="text-3xl font-bold tracking-tight font-display">
                Link expired
              </h1>
              <p className="text-sm text-[#525252] font-serif leading-relaxed">
                This password reset link is no longer valid. Please request a new one.
              </p>
              <Link
                href="/forgot-password"
                className="inline-flex items-center gap-2 bg-black text-white text-[11px] tracking-[0.18em] uppercase px-6 py-3.5 hover:bg-white hover:text-black border border-black transition-colors duration-100 font-code"
              >
                Request new link
                <ArrowRight size={13} strokeWidth={1.5} />
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-0">
              <div className="mb-10">
                <h1 className="text-3xl font-bold tracking-tight font-display mb-2">
                  Set new password
                </h1>
                <p className="text-sm text-[#525252] font-serif">
                  Choose a strong password for your account.
                </p>
              </div>

              {error && (
                <div className="mb-6 border-l-4 border-black bg-[#F5F5F5] px-4 py-3 text-sm text-black font-serif">
                  {error}
                </div>
              )}

              {/* New password */}
              <div className="mb-6">
                <label htmlFor="password" className="block text-[11px] tracking-[0.12em] uppercase font-code text-[#525252] mb-2">
                  New Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="w-full bg-transparent border-0 border-b-2 border-black px-0 py-2 pr-10 text-base text-black placeholder:text-[#BFBFBF] focus:border-b-[3px] focus:outline-none transition-none font-serif"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-0 top-1/2 -translate-y-1/2 text-[#525252] hover:text-black transition-colors focus-visible:outline focus-visible:outline-[2px] focus-visible:outline-black"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" strokeWidth={1.5} /> : <Eye className="h-4 w-4" strokeWidth={1.5} />}
                  </button>
                </div>
              </div>

              {/* Confirm password */}
              <div className="mb-10">
                <label htmlFor="confirm" className="block text-[11px] tracking-[0.12em] uppercase font-code text-[#525252] mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    id="confirm"
                    type={showConfirm ? "text" : "password"}
                    placeholder="Repeat your password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="w-full bg-transparent border-0 border-b-2 border-black px-0 py-2 pr-10 text-base text-black placeholder:text-[#BFBFBF] focus:border-b-[3px] focus:outline-none transition-none font-serif"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-0 top-1/2 -translate-y-1/2 text-[#525252] hover:text-black transition-colors focus-visible:outline focus-visible:outline-[2px] focus-visible:outline-black"
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" strokeWidth={1.5} /> : <Eye className="h-4 w-4" strokeWidth={1.5} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-black text-white text-[11px] tracking-[0.18em] uppercase px-8 py-4 border border-black hover:bg-white hover:text-black transition-colors duration-100 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-black focus-visible:outline-offset-[3px] font-code disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? "Updating…" : (
                  <>
                    Update password
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
