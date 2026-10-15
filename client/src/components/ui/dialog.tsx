import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export function Dialog({
  title,
  description,
  children,
  onClose,
  busy = false,
  className,
  hideTitle = false,
  suspended = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
  className?: string;
  hideTitle?: boolean;
  suspended?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const restoreFocus = useRef(document.activeElement as HTMLElement | null);
  const id = useId();
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const dialog = ref.current!;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      dialog.close();
      if (restoreFocus.current?.isConnected) restoreFocus.current.focus();
    };
  }, []);
  useEffect(() => {
    const dialog = ref.current!;
    if (suspended) dialog.close();
    else if (!dialog.open) dialog.showModal();
  }, [suspended]);
  return createPortal(
    <dialog
      ref={ref}
      aria-labelledby={`${id}-title`}
      aria-describedby={description ? `${id}-description` : undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = [
          ...ref.current!.querySelectorAll<HTMLElement>(
            'button, input:not([type="hidden"]), select, textarea, a[href], [tabindex]',
          ),
        ].filter(
          (element) =>
            element.tabIndex >= 0 &&
            !element.matches(":disabled") &&
            element.getClientRects().length > 0,
        );
        const first = controls[0],
          last = controls.at(-1);
        if (!first) {
          event.preventDefault();
          ref.current?.focus();
          return;
        }
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          event.preventDefault();
          last?.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            document.activeElement === ref.current)
        ) {
          event.preventDefault();
          first.focus();
        }
      }}
      className={cn(
        "studio-theme m-auto max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-lg border border-border bg-card p-5 text-foreground shadow-xl backdrop:bg-black/75 sm:p-6",
        hideTitle ? "space-y-0" : "space-y-5",
        className,
      )}
    >
      <div className={hideTitle ? "sr-only" : "space-y-2"}>
        <h2 id={`${id}-title`} className="break-words text-xl font-semibold">
          {title}
        </h2>
        {description ? (
          <p
            id={`${id}-description`}
            className="break-words text-sm leading-6 text-muted-foreground"
          >
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </dialog>,
    document.body,
  );
}
