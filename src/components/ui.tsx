import type { ButtonHTMLAttributes, ReactNode } from "react";

// The few building blocks every screen shares.

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost";
};

// A control is 6 px round. Selected and primary are filled with ink; the rest is
// paper, with a border that can be found. On a phone every button is 44 px high.
const VARIANTS: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-ink text-paper hover:bg-ink-2",
  outline: "border border-edge bg-paper text-ink hover:bg-paper-2",
  ghost: "text-ink-2 hover:bg-paper-2 hover:text-ink",
};

export function Button({ variant = "outline", className = "", type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-control px-3.5 text-[13px] font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45 sm:h-9 ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  );
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Read by screen readers and shown as the tooltip. */
  label: string;
  children: ReactNode;
};

export function IconButton({ label, className = "", type = "button", children, ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-control text-ink-2 transition-colors duration-150 hover:bg-paper-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:bg-transparent sm:h-8 sm:w-8 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-bar border border-rule bg-paper-2 px-1.5 py-0.5 font-mono text-[12px] text-ink-2">{children}</kbd>;
}
