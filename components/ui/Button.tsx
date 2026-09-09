import type { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-fg hover:opacity-90 disabled:opacity-40",
  secondary:
    "border border-border bg-bg-elevated text-fg hover:bg-bg-hover disabled:opacity-40",
  ghost: "text-fg-muted hover:bg-bg-hover hover:text-fg disabled:opacity-40",
  danger: "text-danger hover:bg-bg-hover disabled:opacity-40",
};

const SIZES: Record<Size, string> = {
  sm: "h-7 px-2.5 text-xs gap-1.5",
  md: "h-9 px-4 text-sm gap-2",
};

/**
 * Botão único do produto. Uma cor de acento, sem gradiente, sem sombra —
 * o destaque vem do contraste e do espaço em volta (instrucoes.md secao 11).
 */
export function Button({
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={clsx(
        "inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:cursor-not-allowed",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
