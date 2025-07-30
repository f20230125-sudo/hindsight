import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/** The portfolio that shows Hindsight in a window. */
const PORTFOLIO = "https://uzair-khan-lac.vercel.app";

// What a page of Hindsight may load and reach. It is all its own: there are no
// scripts, fonts or images from another site, and nothing but its own server is
// asked for data. So a line of text from a run that somehow came to be treated
// as code could not fetch a script from elsewhere, or send what it read anywhere.
//
// 'unsafe-inline' is there because Next.js writes small scripts into each page
// (the data a page starts with, and the one that sets the theme before the
// first paint). Doing without it takes a fresh nonce for every request, which
// means no page could be built ahead of time. What keeps a run's text from
// becoming code is that it is only ever drawn as text; this is the second fence.
const contentSecurityPolicy = [
  "default-src 'self'",
  // Development needs eval for fast refresh, and a socket to hear of changes.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // Only Uzair's portfolio may show Hindsight inside a frame (it runs in a
  // window there). No other site may, so its buttons cannot be pressed through
  // another page.
  `frame-ancestors 'self' ${PORTFOLIO}`,
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // X-Frame-Options is left out: it can only say "nobody" or "this site", not
  // "this one other site", and browsers that read both obey frame-ancestors.
  // A file is what its type says it is, and is never guessed to be a script.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Other sites are told which site a visitor came from, never which run they were looking at.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nothing here uses the camera, the microphone or the visitor's position.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  // Cross-Origin-Opener-Policy is left alone on purpose. /open is opened by one
  // of the apps and answers the tab that opened it; "same-origin" there would
  // cut that tie, and no run could be handed over.
];

const nextConfig: NextConfig = {
  // Development only: lets the dev server be opened as 127.0.0.1 as well as localhost.
  allowedDevOrigins: ["127.0.0.1"],
  // The round badge Next.js draws in a corner while developing sits on top of
  // the ask bar, and gets into the README's pictures.
  devIndicators: false,
  // The Docker build asks for a self-contained server (see Dockerfile). Other
  // builds, such as the one on Vercel, are left as they are.
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
