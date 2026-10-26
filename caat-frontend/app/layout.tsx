import type { Metadata } from "next";
import { Playfair_Display, Source_Serif_4, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { SiteTelemetry } from "@/components/site-telemetry";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

const sourceSerif4 = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.mycaat.com";
const siteDescription =
  "CAAT is the College Application Assistance Tool for Australian students. Compare 10,000+ universities, track applications and UAC deadlines, draft essays, match scholarships to your profile, and build an admissions-ready resume, all in one place.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "CAAT: College Application Assistance Tool",
    template: "%s | CAAT",
  },
  description: siteDescription,
  applicationName: "CAAT",
  keywords: [
    "university applications",
    "Australian universities",
    "UAC",
    "ATAR",
    "scholarships",
    "college essays",
    "admissions resume",
  ],
  openGraph: {
    type: "website",
    siteName: "CAAT",
    url: siteUrl,
    title: "CAAT: College Application Assistance Tool",
    description: siteDescription,
    locale: "en_AU",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "CAAT: College Application Assistance Tool",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CAAT: College Application Assistance Tool",
    description: siteDescription,
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${playfairDisplay.variable} ${sourceSerif4.variable} ${jetbrainsMono.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster richColors position="bottom-right" />
        </ThemeProvider>
        <SiteTelemetry />
      </body>
    </html>
  );
}