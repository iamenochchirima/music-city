import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function FormSection({
  title,
  description,
  help,
  children,
  className,
}: {
  title: string;
  description?: string;
  help?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn("space-y-4", className)}>
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <h3
            id={id}
            className="text-lg font-semibold leading-6 text-foreground"
          >
            {title}
          </h3>
          {help}
        </div>
        {description ? (
          <p className="text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
