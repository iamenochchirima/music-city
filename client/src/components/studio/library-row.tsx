import Link from "next/link";
import type { ReactNode } from "react";

export function LibraryRow({
  title,
  href,
  leading,
  description,
  actions,
  children,
}: {
  title: string;
  href: string;
  leading?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-start gap-4 py-5 first:pt-0">
      {leading}
      <div className="min-w-0 flex-1 space-y-2">
        <Link
          href={href}
          className="inline-block max-w-full break-words text-base font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {actions}
        </div>
      ) : null}
    </li>
  );
}
