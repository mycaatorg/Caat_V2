"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Eye, EyeOff, ArrowRight } from "lucide-react"
import { supabase } from "@/src/lib/supabaseClient"
import { cn } from "@/lib/utils"
import { preflightAuthAction } from "@/app/auth-actions"
import { TurnstileWidget, captchaEnabled } from "@/components/TurnstileWidget"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(event.currentTarget)
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    try {
      // G1 + D3 — rate limit + CAPTCHA before invoking Supabase auth.
      const preflight = await preflightAuthAction({
        turnstileToken: captchaToken ?? undefined,
        intent: "login",
      })
      if (!preflight.ok) {
        setError(preflight.error)
        setLoading(false)
        return
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) throw signInError

      const next = searchParams.get("next")
      let destination = "/dashboard"
      if (next) {
        try {
          const parsed = new URL(next, window.location.origin)
          if (parsed.origin === window.location.origin) {
            destination = next
          }
        } catch {
          // Invalid URL — fall back to dashboard
        }
      }
      router.push(destination)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid login credentials")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("flex flex-col gap-0", className)}
      {...props}
    >
      {/* Heading */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight font-display mb-2">
          Welcome back
        </h1>
        <p className="text-sm text-[#525252] font-serif">
          Enter your credentials to access your account.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 border-l-4 border-black bg-[#F5F5F5] px-4 py-3 text-sm text-black font-serif">
          {error}
        </div>
      )}

      {/* Email */}
      <div className="mb-8">
        <label htmlFor="email" className="block text-[11px] tracking-[0.12em] uppercase font-code text-[#525252] mb-2">
          Email
        </label>
        <input
          name="email"
          id="email"
          type="email"
          placeholder="you@example.com"
          required
          className="w-full bg-transparent border-0 border-b-2 border-black px-0 py-2 text-base text-black placeholder:text-[#BFBFBF] focus:border-b-[3px] focus:outline-none transition-none font-serif"
        />
      </div>

      {/* Password */}
      <div className="mb-3">
        <label htmlFor="password" className="block text-[11px] tracking-[0.12em] uppercase font-code text-[#525252] mb-2">
          Password
        </label>
        <div className="relative">
          <input
            name="password"
            id="password"
            type={showPassword ? "text" : "password"}
            required
            className="w-full bg-transparent border-0 border-b-2 border-black px-0 py-2 pr-10 text-base text-black placeholder:text-[#BFBFBF] focus:border-b-[3px] focus:outline-none transition-none font-serif"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-0 top-1/2 -translate-y-1/2 text-[#525252] hover:text-black transition-colors focus-visible:outline focus-visible:outline-[2px] focus-visible:outline-black focus-visible:outline-offset-2"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" strokeWidth={1.5} /> : <Eye className="h-4 w-4" strokeWidth={1.5} />}
          </button>
        </div>
      </div>

      {/* Forgot password */}
      <div className="mb-6 flex justify-end">
        <Link
          href="/forgot-password"
          className="text-xs text-[#525252] hover:text-black hover:underline underline-offset-4 font-code"
        >
          Forgot password?
        </Link>
      </div>

      <TurnstileWidget onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />

      {/* Submit */}
      <button
        type="submit"
        disabled={loading || (captchaEnabled && !captchaToken)}
        className="w-full bg-black text-white text-[11px] tracking-[0.18em] uppercase px-8 py-4 border border-black hover:bg-white hover:text-black transition-colors duration-100 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-black focus-visible:outline-offset-[3px] font-code disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? "Signing in…" : (
          <>
            Sign in
            <ArrowRight size={13} strokeWidth={1.5} />
          </>
        )}
      </button>

      {/* Sign up link */}
      <p className="text-center text-sm text-[#525252] mt-8 font-serif">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-black underline underline-offset-4 hover:no-underline">
          Create one
        </Link>
      </p>
    </form>
  )
}
