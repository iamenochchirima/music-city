import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function StepNavigation({
  steps,
  current,
  onSelect,
  disabled = false,
  label = "Upload progress",
  completed,
}: {
  steps: readonly { id: string; label: string }[];
  current: number;
  onSelect: (index: number) => void;
  disabled?: boolean;
  label?: string;
  completed?: readonly string[];
}) {
  return (
    <nav aria-label={label}>
      <ol
        className="grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`,
        }}
      >
        {steps.map((step, index) => (
          <li key={step.id} className="min-w-0">
            <button
              type="button"
              aria-label={step.label}
              aria-current={index === current ? "step" : undefined}
              disabled={disabled}
              onClick={() => onSelect(index)}
              className={cn(
                "flex h-full min-h-11 w-full items-center gap-2 border-b-2 py-3 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
                index === current
                  ? "border-primary text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs",
                  index === current ||
                    (completed ? completed.includes(step.id) : index < current)
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {(
                  completed
                    ? completed.includes(step.id) && index !== current
                    : index < current
                ) ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  index + 1
                )}
              </span>
              <span className="hidden sm:block">{step.label}</span>
            </button>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-sm text-muted-foreground sm:hidden">
        Step {current + 1} of {steps.length}: {steps[current].label}
      </p>
    </nav>
  );
}
