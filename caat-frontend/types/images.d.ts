// Minimal module declarations for image imports used in the app.
// This allows TypeScript to understand imports like:
//   import logo from "@/components/assets/logo.webp"
// without changing runtime behavior (Next.js still handles the actual image).

declare module "*.webp" {
  const src: string;
  export default src;
}

