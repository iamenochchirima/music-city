import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-dashed border-border px-4 py-8 text-center">
      <h3 className="text-lg font-medium text-foreground">{title}</h3>
      {description ? (
        <p className="mx-auto max-w-md text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action}
    </div>
  );
}
