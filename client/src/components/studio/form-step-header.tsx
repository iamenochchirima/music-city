import { forwardRef } from "react";

export const FormStepHeader = forwardRef<
  HTMLHeadingElement,
  { title: string; eyebrow?: string; description?: string }
>(({ title, eyebrow, description }, ref) => (
  <div className="space-y-2">
    {eyebrow ? (
      <p className="text-sm font-medium text-muted-foreground">{eyebrow}</p>
    ) : null}
    <h2
      ref={ref}
      tabIndex={-1}
      className="scroll-mt-24 break-words text-[28px] font-semibold leading-8 text-foreground focus:outline-none"
    >
      {title}
    </h2>
    {description ? (
      <p className="text-sm leading-6 text-muted-foreground">{description}</p>
    ) : null}
  </div>
));
FormStepHeader.displayName = "FormStepHeader";
