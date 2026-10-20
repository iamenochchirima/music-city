import Link from "next/link";
import type { ReactNode } from "react";

export function LibraryRow({
  title,
  href,
  leading,
  description,
  actions,
  children,
  variant = "row",
}: {
  title: string;
  href: string;
  leading?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  variant?: "row" | "card";
}) {
  return (
    <li className={variant === "card"
      ? "relative isolate flex flex-wrap items-start gap-4 rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/50 hover:bg-muted/40"
      : "flex flex-wrap items-start gap-4 py-5 first:pt-0"}>
      {leading}
      <div className="min-w-0 flex-1 space-y-2">
        <Link
          href={href}
          className={`inline-block max-w-full break-words text-base font-medium text-foreground underline-offset-4 focus-visible:outline-none ${variant === "card"
            ? "after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ring"
            : "hover:underline focus-visible:ring-2 focus-visible:ring-ring"}`}
        >
          {title}
        </Link>
        {description ? (
          <div className="text-sm leading-6 text-muted-foreground">
            {description}
          </div>
        ) : null}
        {children}
      </div>
      {actions ? (
        <div className={variant === "card" ? "pointer-events-none relative z-10 flex w-full flex-wrap items-center gap-2 sm:w-auto [&>*]:pointer-events-auto" : "flex w-full flex-wrap items-center gap-2 sm:w-auto"}>
          {actions}
        </div>
      ) : null}
    </li>
  );
}
