"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Eye, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

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
  const passwordValid = password.length >= 8

  // Strength criteria
  const hasMinLength = password.length >= 8
  const hasUppercase = /[A-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const hasSpecial = /[^A-Za-z0-9]/.test(password)
  const strengthScore = [hasMinLength, hasUppercase, hasNumber, hasSpecial].filter(Boolean).length
  const strengthLabel =
    password.length === 0 ? null
    : strengthScore <= 1 ? "Weak"
    : strengthScore === 2 ? "Fair"
    : strengthScore === 3 ? "Good"
    : "Strong"
  const strengthColor =
    strengthScore <= 1 ? "bg-destructive"
    : strengthScore === 2 ? "bg-amber-500"
    : strengthScore === 3 ? "bg-blue-500"
    : "bg-green-500"

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
    const password = formData.get("password") as string
    const confirmPassword = formData.get("confirm-password") as string

    if (password.length < 8) {
      setError("Password must be at least 8 characters long")
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      setLoading(false)
      return
    }

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          },
        },
      })

      if (signUpError) throw signUpError

      if (data.session) {
        router.push("/dashboard")
        router.refresh()
      } else {
        setConfirmationSent(true)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong"
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  if (confirmationSent) {
    return (
      <div className={cn("flex flex-col gap-6 items-center text-center", className)}>
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-2xl font-bold">Check your email</h1>
          <p className="text-muted-foreground text-sm text-balance max-w-sm">
            We&apos;ve sent a confirmation link to your email address.
            Please click it to activate your account, then come back and log in.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/login">Go to Login</Link>
        </Button>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("flex flex-col gap-6", className)}
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Create your account</h1>
          <p className="text-muted-foreground text-sm text-balance">
            Fill in the form below to create your account
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-md border border-red-200">
            {error}
          </div>
        )}

        <Field>
          <FieldLabel htmlFor="name">Full Name</FieldLabel>
          <Input name="name" id="name" type="text" placeholder="John Doe" required />
        </Field>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input name="email" id="email" type="email" placeholder="m@example.com" required />
          <FieldDescription>
            We&apos;ll use this to contact you. We will not share your email
            with anyone else.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <div className="relative">
            <Input
              name="password"
              id="password"
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              value={password}
              onChange={handlePasswordChange}
              className={`pr-10 ${passwordTouched && passwordTooShort ? "border-destructive focus-visible:ring-destructive" : ""}`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {passwordTouched && password.length > 0 && (
            <div className="space-y-1.5 mt-1">
              {/* Strength bar */}
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((level) => (
                  <div
                    key={level}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      strengthScore >= level ? strengthColor : "bg-muted"
                    }`}
                  />
                ))}
              </div>
              <p className={`text-xs ${
                strengthScore <= 1 ? "text-destructive"
                : strengthScore === 2 ? "text-amber-500"
                : strengthScore === 3 ? "text-blue-500"
                : "text-green-600"
              }`}>
                {strengthLabel}
              </p>
              {/* Criteria hints */}
              <ul className="text-xs text-muted-foreground space-y-0.5">
                {!hasMinLength && <li>• At least 8 characters</li>}
                {!hasUppercase && <li>• One uppercase letter</li>}
                {!hasNumber && <li>• One number</li>}
                {!hasSpecial && <li>• One special character</li>}
              </ul>
            </div>
          )}
          {(!passwordTouched || password.length === 0) && (
            <FieldDescription>Must be at least 8 characters long.</FieldDescription>
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor="confirm-password">Confirm Password</FieldLabel>
          <div className="relative">
            <Input
              name="confirm-password"
              id="confirm-password"
              type={showConfirm ? "text" : "password"}
              required
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showConfirm ? "Hide password" : "Show password"}
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <FieldDescription>Please confirm your password.</FieldDescription>
        </Field>
        <Field>
          <Button type="submit" disabled={loading}>
            {loading ? "Creating Account..." : "Create Account"}
          </Button>
        </Field>
        <Field>
          <FieldDescription className="px-6 text-center">
            Already have an account?{" "}
            <Link href="/login" className="underline underline-offset-4">
              Log in
            </Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  )
}
