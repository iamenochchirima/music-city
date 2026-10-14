import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function ChoiceCard({
  label,
  description,
  type = "radio",
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "className"> & {
  label: string;
  description?: string;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-start gap-3 rounded-md border p-4 text-foreground transition-colors focus-within:ring-2 focus-within:ring-ring",
        props.checked
          ? "border-primary bg-primary/5"
          : "border-input hover:bg-accent",
        props.disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <input
        type={type}
        {...props}
        className="mt-1 h-4 w-4 shrink-0 accent-primary"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {description ? (
          <span className="mt-1 block text-sm leading-6 text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}
