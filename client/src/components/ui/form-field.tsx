import { cloneElement, type ReactElement, type ReactNode } from "react";
import { Label } from "./label";
import { cn } from "@/lib/utils";

type FieldControl = {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
};

export function FormField({
  id,
  label,
  hint,
  help,
  error,
  children,
  className,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  help?: ReactNode;
  error?: string;
  children: ReactElement<FieldControl>;
  className?: string;
}) {
  const description = [
    children.props["aria-describedby"],
    hint ? `${id}-help` : null,
    error ? `${id}-error` : null,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cn("min-w-0 space-y-2", className)}>
      <div className="flex min-h-7 items-center gap-1.5">
        <Label htmlFor={id}>{label}</Label>
        {help}
      </div>
      {cloneElement(children, {
        id,
        "aria-describedby": description || undefined,
        "aria-invalid": Boolean(error) || children.props["aria-invalid"],
      })}
      {hint ? (
        <p
          id={`${id}-help`}
          className="text-xs leading-5 text-muted-foreground"
        >
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
