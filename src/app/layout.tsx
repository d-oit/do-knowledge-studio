import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import "./globals.css";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { StudioThemeProvider } from "@/components/studio/theme-provider";

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
    "A local-first knowledge studio for rich notes, knowledge graphs, mind maps, semantic search, and AI-assisted thinking — all in your browser, no backend required.",
  keywords: [
    "knowledge management",
    "local-first",
    "knowledge graph",
    "mind map",
    "semantic search",
    "AI agents",
    "TRIZ",
    "second brain",
  ],
  authors: [{ name: "DO Knowledge Studio" }],
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "DO Knowledge Studio",
    description: "Local-first thinking, connected. Rich notes, graphs, mind maps, semantic search, and AI agents.",
    type: "website",
  },
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
          {children}
        </StudioThemeProvider>
        <SonnerToaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
