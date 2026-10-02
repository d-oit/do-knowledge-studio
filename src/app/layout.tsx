import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import "./globals.css";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { StudioThemeProvider } from "@/components/studio/theme-provider";
import { ServiceWorkerRegistration } from "@/components/studio/service-worker-registration";
import { OfflineIndicator } from "@/components/studio/offline-indicator";
import { Announcer } from "@/lib/a11y/announcer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "DO Knowledge Studio — Local-first thinking, connected",
  description:
    "A local-first knowledge studio for rich notes, knowledge graphs, mind maps, keyword search, and AI-assisted thinking — all in your browser, no backend required.",
  keywords: [
    "knowledge management",
    "local-first",
    "knowledge graph",
    "mind map",
    "keyword search",
    "AI agents",
    "TRIZ",
    "second brain",
  ],
  authors: [{ name: "DO Knowledge Studio" }],
  // Referrer policy is set once, as a header, in next.config.ts. Setting it
  // here too produced two conflicting policies for one document.
  // Plan 158 P1-3.
  icons: {
    icon: "/favicon.svg",
    // P2-1: iOS ignores manifest icons for the home-screen web clip and
    // falls back to a page screenshot. icon-192.png is an opaque 192px PNG,
    // the size web.dev recommends for apple-touch-icon.
    apple: "/icon-192.png",
  },
  openGraph: {
    title: "DO Knowledge Studio",
    description: "Local-first thinking, connected. Rich notes, graphs, mind maps, keyword search, and AI agents.",
    type: "website",
  },
  manifest: "/manifest.webmanifest",
  // Next's typed `appleWebApp` emits the standard `mobile-web-app-capable`
  // name; the untyped `other` form only produced the legacy Apple-prefixed
  // key, which non-Apple engines honouring the standard tag never saw.
  appleWebApp: {
    capable: true,
    title: "DKS",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  // P2-4: a single value tinted the browser chrome saffron in both themes,
  // which reads wrong over the near-black dark background. The array form is
  // the documented per-scheme override. The light value must track the live
  // accent: globals.css :root --saffron (#9a5c2a) — it previously copied the
  // stale DESIGN-SYSTEM.md value (#c77d3a); dark matches .dark --background.
  //
  // Caveat, stated because it is a real limit: next-themes runs with
  // enableSystem={false}, so this keys off the OS scheme, not the in-app
  // toggle. A user who chose light on a dark OS gets the dark tint. Fixing
  // that properly means updating the meta from the client on toggle.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#9a5c2a" },
    { media: "(prefers-color-scheme: dark)", color: "#14110d" },
  ],
  // P2-8: tell the UA which colour scheme is active so scrollbars, form
  // controls, and default canvas paint correctly in dark mode.
  colorScheme: "light dark",
};

/** Root layout that wraps the app with theme, accessibility, and offline providers. */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} antialiased bg-background text-foreground`}
      >
        <StudioThemeProvider>
          {/* The provider must WRAP the app, not sit beside it: a sibling
              <Announcer /> only provides context to its own children (the
              live region itself), so every useAnnouncer() call in a view
              would silently fall back to the no-op. */}
          <Announcer>
            <OfflineIndicator />
            {children}
          </Announcer>
        </StudioThemeProvider>
        <SonnerToaster position="bottom-right" richColors closeButton />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
