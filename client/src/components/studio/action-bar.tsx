import type { ReactNode } from "react";

export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6 pb-[env(safe-area-inset-bottom)]">
      {children}
    </div>
  );
}
