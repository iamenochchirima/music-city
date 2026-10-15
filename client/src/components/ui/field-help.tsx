import { Info } from "lucide-react";
import type { ReactNode } from "react";

export function FieldHelp({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <details
      className="relative shrink-0"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.currentTarget.open = false;
          event.currentTarget.querySelector("summary")?.focus();
        }
      }}
    >
      <summary
        role="button"
        aria-label={label}
        className="flex size-7 cursor-pointer list-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
      >
        <Info className="size-4" aria-hidden="true" />
      </summary>
      <div className="absolute -left-16 top-full z-20 mt-1 w-52 sm:left-0 sm:w-64 max-w-[calc(100vw-3rem)] rounded-md border border-border bg-popover p-3 text-sm font-normal leading-5 text-popover-foreground shadow-lg">
        {children}
      </div>
    </details>
  );
}
