import type { ButtonHTMLAttributes } from "react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

export function ToggleChip({
  selected,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected: boolean }) {
  return (
    <Button
      type="button"
      variant="outline"
      aria-pressed={selected}
      className={cn(selected && "border-primary bg-primary/10 hover:bg-primary/20", className)}
      {...props}
    />
  );
}
