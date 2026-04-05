export function safeText(x: unknown): string {
  return typeof x === "string" ? x : "";
}
