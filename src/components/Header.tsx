"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

/** Three bars, each starting where the last one ended: a run on a timeline. */
export function Logo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true" className="shrink-0">
      <rect x="1" y="2" width="9" height="3.5" rx="1.5" className="fill-viz-model" />
      <rect x="5" y="7.25" width="7" height="3.5" rx="1.5" className="fill-viz-call" />
      <rect x="9" y="12.5" width="8" height="3.5" rx="1.5" className="fill-viz-wait" />
    </svg>
  );
}

const LINKS = [
  { href: "/", label: "Runs" },
  { href: "/overview", label: "Overview" },
  { href: "/sources", label: "Sources" },
];

// Opaque desk with a hairline under it: nothing is blurred. The page you are on
// is ink with a rule under it, drawn on the header's own edge.
export function Header() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-desk">
      <div className="mx-auto flex h-14 w-full max-w-[1280px] items-center gap-2 px-3 min-[380px]:gap-3 min-[380px]:px-4 sm:gap-7 sm:px-6">
        <Link href="/" className="flex h-11 items-center gap-2 rounded-control text-[17px] font-bold tracking-tight sm:gap-2.5">
          <Logo size={20} />
          {/* On the narrowest phones the name gives way to the mark, so the toggle stays on the screen; it is still the link's name. */}
          <span className="sr-only min-[380px]:not-sr-only">Hindsight</span>
        </Link>
        <nav aria-label="Main" className="flex h-full items-stretch gap-2.5 min-[380px]:gap-3 sm:gap-5">
          {LINKS.map((link) => {
            const current = link.href === "/" ? pathname === "/" || pathname.startsWith("/runs") : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={current ? "page" : undefined}
                // The link is as tall as the header, so its ring is drawn inside it, not above the top edge of the page.
                className={`flex items-center rounded-control border-b-2 px-0.5 pt-0.5 text-[14px] font-medium transition-colors duration-150 focus-visible:-outline-offset-2 ${
                  current ? "border-ink text-ink" : "border-transparent text-ink-2 hover:text-ink"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
