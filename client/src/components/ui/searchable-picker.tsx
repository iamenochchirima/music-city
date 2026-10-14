"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type SearchablePickerProps = {
  id: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly (string | { value: string; label: string })[];
  placeholder: string;
  searchPlaceholder: string;
  required?: boolean;
  className?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  disabled?: boolean;
};

export const SearchablePicker = ({
  id,
  value,
  onValueChange,
  options,
  placeholder,
  searchPlaceholder,
  required,
  className,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  disabled,
}: SearchablePickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputId = useId();
  const shouldSearch = options.length > 8;
  const normalizedOptions = useMemo(
    () =>
      options.map((option) =>
        typeof option === "string" ? { value: option, label: option } : option,
      ),
    [options],
  );
  const displayValue =
    normalizedOptions.find((option) => option.value === value)?.label ?? value;

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return normalizedOptions;
    return normalizedOptions.filter((option) =>
      option.label.toLocaleLowerCase().includes(normalizedQuery),
    );
  }, [normalizedOptions, query]);

  useEffect(() => {
    const closeWhenOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node))
        setIsOpen(false);
    };
    document.addEventListener("mousedown", closeWhenOutside);
    return () => document.removeEventListener("mousedown", closeWhenOutside);
  }, []);

  const selectOption = (option: string) => {
    onValueChange(option);
    setQuery("");
    setIsOpen(false);
    document.getElementById(id)?.focus();
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative", className)}
      onKeyDown={(event) => {
        if (event.key === "Escape" && isOpen) {
          event.preventDefault();
          event.stopPropagation();
          setIsOpen(false);
          document.getElementById(id)?.focus();
        }
        if ((event.key === "ArrowDown" || event.key === "ArrowUp") && isOpen) {
          const options = [
            ...containerRef.current!.querySelectorAll<HTMLButtonElement>(
              '[role="option"]',
            ),
          ];
          if (!options.length) return;
          event.preventDefault();
          const index = options.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          const next =
            index < 0
              ? event.key === "ArrowDown"
                ? 0
                : options.length - 1
              : (index +
                  (event.key === "ArrowDown" ? 1 : -1) +
                  options.length) %
                options.length;
          options[next]?.focus();
        }
      }}
    >
      <input type="hidden" name={id} value={value} required={required} />
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        aria-required={required}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`${inputId}-listbox`}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={(event) => {
          if (
            (event.key === "ArrowDown" || event.key === "ArrowUp") &&
            !isOpen
          ) {
            event.preventDefault();
            setIsOpen(true);
          }
        }}
        className="disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive flex h-11 md:h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-left text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <span
          className={cn(
            "min-w-0 truncate",
            value ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {value ? displayValue : placeholder}
        </span>
        <ChevronDown
          className={cn(
            "ml-3 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {isOpen ? (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-lg border border-input bg-popover shadow-xl shadow-black/30">
          {shouldSearch ? (
            <div className="border-b border-input p-2">
              <label htmlFor={inputId} className="sr-only">
                {searchPlaceholder}
              </label>
              <div className="flex items-center gap-2 rounded-md bg-white/5 px-3">
                <Search
                  className="h-4 w-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  id={inputId}
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-9 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>
          ) : null}
          <ul
            id={`${inputId}-listbox`}
            role="listbox"
            aria-labelledby={id}
            className="max-h-60 overflow-y-auto p-1"
          >
            {filteredOptions.length ? (
              filteredOptions.map((option) => (
                <li key={option.value} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={value === option.value}
                    onClick={() => selectOption(option.value)}
                    className="flex w-full items-center justify-between rounded-md min-h-11 px-3 py-2 text-left text-sm text-foreground transition hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:outline-none"
                  >
                    <span className="min-w-0 break-words">{option.label}</span>
                    {value === option.value ? (
                      <Check
                        className="h-4 w-4 shrink-0 text-primary"
                        aria-hidden="true"
                      />
                    ) : null}
                  </button>
                </li>
              ))
            ) : (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                No matches found.
              </li>
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
};
