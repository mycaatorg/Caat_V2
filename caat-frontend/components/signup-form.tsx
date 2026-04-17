"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Eye, EyeOff, ArrowRight, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { supabase } from "@/src/lib/supabaseClient"

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmationSent, setConfirmationSent] = useState(false)
  const [password, setPassword] = useState("")
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const passwordTooShort = password.length > 0 && password.length < 8

  // Strength criteria
  const hasMinLength = password.length >= 8
  const hasUppercase = /[A-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const hasSpecial = /[^A-Za-z0-9]/.test(password)
  const strengthScore = [hasMinLength, hasUppercase, hasNumber, hasSpecial].filter(Boolean).length

  const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value)
    setPasswordTouched(true)
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(event.currentTarget)
    const name = formData.get("name") as string
    const email = formData.get("email") as string
    const pw = formData.get("password") as string
    const confirmPassword = formData.get("confirm-password") as string

    if (pw.length < 8) {
      setError("Password must be at least 8 characters long")
      setLoading(false)
      return
    }

    if (pw !== confirmPassword) {
      setError("Passwords do not match")
      setLoading(false)
      return
    }

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password: pw,
        options: { data: { full_name: name } },
      })

      if (signUpError) throw signUpError

      if (data.session) {
        router.push("/dashboard")
        router.refresh()
      } else {
        setConfirmationSent(true)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  if (confirmationSent) {
    return (
      <div className={cn("flex flex-col gap-6", className)}>
        <div className="w-10 h-10 bg-black flex items-center justify-center">
          <Check size={18} strokeWidth={2} className="text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display mb-2">
            Check your email
          </h1>
          <p className="text-sm text-[#525252] font-serif leading-relaxed">
            We&apos;ve sent a confirmation link to your email address. Click it to activate your account, then come back and log in.
          </p>
        </div>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 border-2 border-black text-black text-[11px] tracking-[0.18em] uppercase px-6 py-3.5 hover:bg-black hover:text-white transition-colors duration-100 font-code"
        >
          Go to Login
          <ArrowRight size={13} strokeWidth={1.5} />
        </Link>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("flex flex-col gap-0", className)}
      {...props}
    >
      {/* Heading */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight font-display mb-2">
          Create account
        </h1>
        <p className="text-sm text-[#525252] font-serif">
          Start your college application journey today.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 border-l-4 border-black bg-[#F5F5F5] px-4 py-3 text-sm text-black font-serif">
          {error}
        </div>
      )}

      {/* Full name */}
      <div className="mb-6">
        <label htmlFor="name" className="block text-[11px] tracking-[0.12em] uppercase font-code text-[#525252] mb-2">
          Full Name
        </label>
        <input
          name="name"
          id="name"
          type="text"
          placeholder="Jane Smith"
          required
          className="w-full bg-transparent border-0 border-b-2 border-black px-0 py-2 text-base text-black placeholder:text-[#BFBFBF] focus:border-b-[3px] focus:outline-none transition-none font-serif"
        />
      </div>

      {/* Email */}
      <div className="mb-6">
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
      <div className="mb-6">
        <label htmlFor="password" className="block text-[11px] tracking-[0.12em] uppercase font-code text-[#525252] mb-2">
          Password
        </label>
        <div className="relative">
          <input
            name="password"
            id="password"
            type={showPassword ? "text" : "password"}
            required
            minLength={8}
            value={password}
            onChange={handlePasswordChange}
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

        {/* Strength indicator */}
        {passwordTouched && password.length > 0 && (
          <div className="mt-3 space-y-2">
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((level) => (
                <div
                  key={level}
                  className={`h-[3px] flex-1 transition-colors ${strengthScore >= level ? "bg-black" : "bg-[#E5E5E5]"}`}
                />
              ))}
            </div>
            <ul className="text-[11px] text-[#525252] font-code space-y-0.5">
              {!hasMinLength && <li>• At least 8 characters</li>}
              {!hasUppercase && <li>• One uppercase letter</li>}
              {!hasNumber && <li>• One number</li>}
              {!hasSpecial && <li>• One special character</li>}
            </ul>
          </div>
        )}
        {(!passwordTouched || password.length === 0) && (
          <p className="text-[11px] text-[#525252] font-code mt-1.5">Must be at least 8 characters.</p>
        )}
      </div>

      {/* Confirm password */}
      <div className="mb-10">
        <label htmlFor="confirm-password" className="block text-[11px] tracking-[0.12em] uppercase font-code text-[#525252] mb-2">
          Confirm Password
        </label>
        <div className="relative">
          <input
            name="confirm-password"
            id="confirm-password"
            type={showConfirm ? "text" : "password"}
            required
            className="w-full bg-transparent border-0 border-b-2 border-black px-0 py-2 pr-10 text-base text-black placeholder:text-[#BFBFBF] focus:border-b-[3px] focus:outline-none transition-none font-serif"
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            className="absolute right-0 top-1/2 -translate-y-1/2 text-[#525252] hover:text-black transition-colors focus-visible:outline focus-visible:outline-[2px] focus-visible:outline-black focus-visible:outline-offset-2"
            aria-label={showConfirm ? "Hide password" : "Show password"}
          >
            {showConfirm ? <EyeOff className="h-4 w-4" strokeWidth={1.5} /> : <Eye className="h-4 w-4" strokeWidth={1.5} />}
          </button>
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-black text-white text-[11px] tracking-[0.18em] uppercase px-8 py-4 border border-black hover:bg-white hover:text-black transition-colors duration-100 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-black focus-visible:outline-offset-[3px] font-code disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? "Creating account…" : (
          <>
            Create Account
            <ArrowRight size={13} strokeWidth={1.5} />
          </>
        )}
      </button>

      {/* Login link */}
      <p className="text-center text-sm text-[#525252] mt-8 font-serif">
        Already have an account?{" "}
        <Link href="/login" className="text-black underline underline-offset-4 hover:no-underline">
          Log in
        </Link>
      </p>
    </form>
  )
}
