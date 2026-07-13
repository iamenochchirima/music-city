"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type SearchablePickerProps = {
  id: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly string[];
  placeholder: string;
  searchPlaceholder: string;
  required?: boolean;
  className?: string;
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
}: SearchablePickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputId = useId();
  const shouldSearch = options.length > 8;

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return options;
    return options.filter((option) =>
      option.toLocaleLowerCase().includes(normalizedQuery),
    );
  }, [options, query]);

  useEffect(() => {
    const closeWhenOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", closeWhenOutside);
    return () => document.removeEventListener("mousedown", closeWhenOutside);
  }, []);

  const selectOption = (option: string) => {
    onValueChange(option);
    setQuery("");
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <input type="hidden" name={id} value={value} required={required} />
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`${inputId}-listbox`}
        onClick={() => setIsOpen((open) => !open)}
        className="flex h-10 w-full items-center justify-between rounded-md border border-white/10 bg-slate-950/70 px-3 text-left text-sm text-white outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
      >
        <span className={value ? "text-white" : "text-slate-500"}>{value || placeholder}</span>
        <ChevronDown className={cn("ml-3 h-4 w-4 shrink-0 text-slate-400 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen ? (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-lg border border-white/10 bg-slate-950 shadow-xl shadow-black/30">
          {shouldSearch ? (
            <div className="border-b border-white/10 p-2">
              <label htmlFor={inputId} className="sr-only">{searchPlaceholder}</label>
              <div className="flex items-center gap-2 rounded-md bg-white/5 px-3">
                <Search className="h-4 w-4 text-slate-400" aria-hidden="true" />
                <input
                  id={inputId}
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-9 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                />
              </div>
            </div>
          ) : null}
          <ul id={`${inputId}-listbox`} role="listbox" className="max-h-60 overflow-y-auto p-1">
            {filteredOptions.length ? filteredOptions.map((option) => (
              <li key={option}>
                <button
                  type="button"
                  role="option"
                  aria-selected={value === option}
                  onClick={() => selectOption(option)}
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-emerald-400/10 hover:text-white focus-visible:bg-emerald-400/10 focus-visible:outline-none"
                >
                  {option}
                  {value === option ? <Check className="h-4 w-4 text-emerald-300" aria-hidden="true" /> : null}
                </button>
              </li>
            )) : (
              <li className="px-3 py-6 text-center text-sm text-slate-500">No matches found.</li>
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
};
