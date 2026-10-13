import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex max-w-[60ch] flex-col items-start gap-3 py-16">
      <h1 className="page-title">There is no page at this address</h1>
      <p className="text-[15px] leading-relaxed text-ink-2">The link may be mistyped, or the page may have moved.</p>
      <Link href="/" className="mt-2 inline-flex h-11 items-center rounded-control bg-ink px-3.5 text-[13px] font-medium text-paper hover:bg-ink-2 sm:h-9">
        Go to the runs
      </Link>
    </div>
  );
}
