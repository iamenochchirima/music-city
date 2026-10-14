import { Progress } from "@/components/ui/progress";

export function FlowProgress({
  label,
  current,
  total,
}: {
  label: string;
  current: number;
  total: number;
}) {
  const value = Math.round((current / Math.max(total - 1, 1)) * 100);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>{label}</span>
        <span>
          Step {current + 1} of {total}
        </span>
      </div>
      <Progress
        value={value}
        aria-label="Onboarding progress"
        className="h-1.5"
      />
    </div>
  );
}
