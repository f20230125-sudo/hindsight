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
  { href: "/sources", label: "Sources" },
];

export function Header() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-[1280px] items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 rounded-md text-[15px] font-semibold tracking-tight">
          <Logo />
          Hindsight
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1">
          {LINKS.map((link) => {
            const current = link.href === "/" ? pathname === "/" || pathname.startsWith("/runs") : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={current ? "page" : undefined}
                className={`rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors ${current ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg"}`}
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
