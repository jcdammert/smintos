import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "dark" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-card font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none";

const variants: Record<Variant, string> = {
  primary: "bg-mint text-ink hover:bg-mint-dark",
  dark: "bg-ink text-white hover:bg-ink/90",
  ghost: "bg-transparent text-text-primary hover:bg-black/5",
  outline: "border border-line bg-white text-text-primary hover:bg-black/5",
  danger: "bg-danger text-white hover:bg-danger/90",
};

// Sizes keep all interactive controls >= 44px tall for mobile tap targets.
const sizes: Record<Size, string> = {
  sm: "min-h-[44px] px-3 text-sm",
  md: "min-h-[48px] px-5 text-sm",
  lg: "min-h-[52px] px-6 text-base w-full",
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  className?: string;
}

type ButtonProps = CommonProps &
  Omit<ComponentProps<"button">, "className" | "children">;

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

type LinkButtonProps = CommonProps &
  Omit<ComponentProps<typeof Link>, "className" | "children">;

export function LinkButton({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: LinkButtonProps) {
  return (
    <Link
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {children}
    </Link>
  );
}
