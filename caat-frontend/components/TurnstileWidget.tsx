"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { Turnstile, type TurnstileInstance as ProviderInstance } from "@marsidev/react-turnstile";

// Auth forms only need reset; keep feedback and token invalidation in this wrapper.
export type TurnstileInstance = Pick<ProviderInstance, "reset">;
interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onExpire: () => void;
  ref?: Ref<TurnstileInstance>;
}

type Status = "checking" | "interactive" | "verified" | "failed" | "expired" | "timeout" | "unsupported" | "script-error" | "slow";
const messages = {
  failed: "The security check could not finish. Please try again.",
  expired: "The security check expired. Please try again.",
  timeout: "The security check timed out. Please try again.",
  unsupported: "The security check does not support this browser. Update it or try another browser.",
  "script-error": "The security check could not load. Check your connection, then reload this page.",
  slow: "The security check is taking longer than expected. Check your connection and try again.",
};

/** Shared recovery UI for login, signup and password reset. Server verification stays required. */
export function TurnstileWidget({ onVerify, onExpire, ref }: TurnstileWidgetProps) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const widget = useRef<ProviderInstance>(null);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<Status>("checking");
  const [attempt, setAttempt] = useState(0);

  function reset() {
    onExpire();
    setStatus("checking");
    setAttempt(value => value + 1);
    widget.current?.reset();
  }
  useImperativeHandle(ref, () => ({ reset }));

  // A blocked script may never emit any provider event. Give the student a way
  // out of an indefinitely disabled form without accepting an unverified token.
  useEffect(() => {
    if (!siteKey || status !== "checking") return;
    const timer = setTimeout(() => setStatus("slow"), 30_000);
    return () => clearTimeout(timer);
  }, [siteKey, status, attempt]);

  function unavailable(next: keyof typeof messages) {
    onExpire();
    setStatus(next);
  }

  if (!siteKey) return null;
  const error = status in messages ? messages[status as keyof typeof messages] : null;
  const canReset = loaded && status !== "script-error" && status !== "unsupported";

  return (
    <div className="mb-6">
      <Turnstile
        ref={widget}
        siteKey={siteKey}
        onWidgetLoad={() => setLoaded(true)}
        onSuccess={token => { setStatus("verified"); onVerify(token); }}
        onExpire={() => unavailable("expired")}
        onError={() => unavailable("failed")}
        onTimeout={() => unavailable("timeout")}
        onUnsupported={() => unavailable("unsupported")}
        onBeforeInteractive={() => setStatus("interactive")}
        scriptOptions={{ onError: () => unavailable("script-error") }}
        options={{ theme: "light" }}
      />
      {(status === "checking" || status === "interactive") && (
        <p role="status" className="mt-2 text-sm text-[#525252]">
          {status === "interactive" ? "Complete the security check above to continue." : "Checking your connection securely…"}
        </p>
      )}
      {error && (
        <div className="mt-2 border-l-4 border-[#9a1a27] bg-[#F5F5F5] px-4 py-3 text-sm text-[#111111]">
          <p role="alert">{error}</p>
          {canReset ? (
            <button type="button" onClick={reset} className="mt-2 min-h-11 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
              Retry security check
            </button>
          ) : (
            <a href="" className="mt-2 inline-flex min-h-11 items-center underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
              Reload page
            </a>
          )}
        </div>
      )}
    </div>
  );
}

/** Auth submit stays disabled until a verified token arrives when configured. */
export const captchaEnabled = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
