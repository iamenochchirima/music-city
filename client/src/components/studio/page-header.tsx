import type { ReactNode } from "react";

export function StudioPageHeader({
  title,
  description,
  eyebrow,
  actions,
  children,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="space-y-4 border-b border-border pb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          {eyebrow ? (
            <p className="text-sm font-medium text-muted-foreground">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="break-words text-[28px] font-semibold leading-8 text-foreground">
            {title}
          </h2>
          {description ? (
            <p className="text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {actions}
      </div>
      {children}
    </header>
  );
}
