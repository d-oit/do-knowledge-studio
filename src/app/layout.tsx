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
  referrer: "no-referrer",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "DO Knowledge Studio",
    description: "Local-first thinking, connected. Rich notes, graphs, mind maps, keyword search, and AI agents.",
    type: "website",
  },
  manifest: "/manifest.webmanifest",
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#c77d3a",
};

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
          <Announcer />
          <OfflineIndicator />
          {children}
        </StudioThemeProvider>
        <SonnerToaster position="bottom-right" richColors closeButton />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
