"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Eye, EyeOff } from "lucide-react"
import { supabase } from "@/src/lib/supabaseClient"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(event.currentTarget)
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) throw signInError

      // Redirect to the page the user originally tried to access, or dashboard
      // Validate via URL constructor to prevent open redirect attacks
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
      className={cn("flex flex-col gap-6", className)} 
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Login to your account</h1>
          <p className="text-muted-foreground text-sm text-balance">
            Enter your email below to login to your account
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-md border border-red-200">
            {error}
          </div>
        )}

        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input 
            name="email" 
            id="email" 
            type="email" 
            placeholder="m@example.com" 
            required 
          />
        </Field>
        <Field>
          <div className="flex items-center">
            <FieldLabel htmlFor="password">Password</FieldLabel>
          </div>
          <div className="relative">
            <Input
              name="password"
              id="password"
              type={showPassword ? "text" : "password"}
              required
              className="pr-10"
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
          <Link
            href="/forgot-password"
            className="ml-auto text-sm underline-offset-4 hover:underline"
          >
            Forgot your password?
          </Link>
        </Field>
        <Field>
          <Button type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </Button>
        </Field>
        {/* <FieldSeparator>Or continue with</FieldSeparator> */}
        <Field>
          <FieldDescription className="text-center">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="underline underline-offset-4">
              Sign up
            </Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  )
}