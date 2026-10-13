import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Mono, Mozilla_Headline } from "next/font/google";
import { Header } from "@/components/Header";
import { Providers } from "@/components/Providers";
import { THEME_SCRIPT } from "@/components/themeScript";
import "./globals.css";

// Mozilla Headline for everything that is read: its zeros are slashed, so a page
// of durations and ids never mixes up 0 and O, and its width axis gives a narrow
// cut for the label gutter. Atkinson Hyperlegible Mono only for text that is
// data (the JSON tree, the run file, ids), built so that 0/O and 1/l/I differ.
// Both are self-hosted at build; the page asks no other site for a font.
const headline = Mozilla_Headline({
  variable: "--font-headline",
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
  fallback: ["system-ui", "Segoe UI", "sans-serif"],
});

const verbatim = Atkinson_Hyperlegible_Mono({
  variable: "--font-verbatim",
  subsets: ["latin"],
  display: "swap",
  // Only the JSON tree and the run file use it, so it is fetched when one is on the page.
  preload: false,
  fallback: ["ui-monospace", "Cascadia Mono", "Consolas", "monospace"],
});

const TITLE = "Hindsight: what your agents did, after the fact";
const DESCRIPTION =
  "Reads the runs of four apps (Sayso, Flowboard, Agent Desk and the GitHub bot) and lays each one out on a timeline: what was understood, every call, every wait, every check.";

// On Vercel this is the site's public address, which link previews need.
const SITE = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3040";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: TITLE, template: "%s · Hindsight" },
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", siteName: "Hindsight" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e9ebef" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0f13" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The script below sets data-theme before React loads, so the attribute
    // differs from what the server sent. That is expected.
    <html lang="en" data-theme="light" suppressHydrationWarning className={`${headline.variable} ${verbatim.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <Providers>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-control focus:bg-ink focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-paper"
          >
            Skip to the content
          </a>
          <Header />
          <main id="main" className="mx-auto w-full max-w-[1280px] px-4 pb-20 pt-6 sm:px-6 sm:pt-10">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
