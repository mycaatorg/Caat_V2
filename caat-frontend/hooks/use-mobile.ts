import { useSyncExternalStore } from "react"

// Match the sidebar's 768px breakpoint, including fractional CSS pixels.
const MOBILE_QUERY = "(width < 768px)"

function subscribe(onChange: () => void) {
  const media = window.matchMedia(MOBILE_QUERY)
  media.addEventListener("change", onChange)
  return () => media.removeEventListener("change", onChange)
}

function getSnapshot() {
  return window.matchMedia(MOBILE_QUERY).matches
}

// Server markup and its first hydration render must agree before reading window.
function getServerSnapshot() {
  return false
}

export function useIsMobile() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
