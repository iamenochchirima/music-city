import { useEffect, useId, useRef, useState } from "react";
import type { ContributorSummary } from "@music-city/shared";
import { Input } from "@/components/ui/input";
import { usersApi } from "@/features/users/lib/users-api";

type Props = {
  id?: string;
  value: string;
  linked: boolean;
  token?: string;
  profiles: ContributorSummary[];
  disabled?: boolean;
  onChange: (name: string, profile?: ContributorSummary) => void;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
};

export function ContributorNameInput({
  id, value, linked, token, profiles, disabled, onChange,
  "aria-describedby": describedBy, "aria-invalid": invalid,
}: Props) {
  const listId = useId();
  const container = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [result, setResult] = useState<{ query: string; items: ContributorSummary[]; error?: boolean } | null>(null);
  const query = value.trim();
  const searching = open && !linked && !disabled && query.length >= 2;
  const localMatches = profiles.filter(profile =>
    `${profile.name} ${profile.walletAddress}`.toLowerCase().includes(query.toLowerCase()),
  ).slice(0, 20);
  const currentResult = result?.query === query ? result : null;
  const options = searching ? (token ? currentResult?.items ?? [] : localMatches) : [];
  const loading = searching && Boolean(token) && !currentResult;
  const expanded = open && !linked && !disabled;

  useEffect(() => {
    if (!searching || !token) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      usersApi.searchContributors(token, query).then(
        items => { if (!cancelled) setResult({ query, items }); },
        () => { if (!cancelled) setResult({ query, items: [], error: true }); },
      );
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [searching, token, query]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const select = (profile: ContributorSummary) => {
    onChange(profile.name, profile);
    setOpen(false);
    setActive(-1);
  };

  return (
    <div ref={container} className="relative min-w-0">
      <Input
        id={id}
        value={value}
        disabled={disabled}
        maxLength={80}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={expanded ? listId : undefined}
        aria-activedescendant={expanded && active >= 0 && options[active] ? `${listId}-${active}` : undefined}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        placeholder="Search users or enter a name"
        onFocus={() => { setOpen(true); setActive(-1); }}
        onBlur={event => {
          if (!container.current?.contains(event.relatedTarget)) setOpen(false);
        }}
        onChange={event => { onChange(event.target.value); setOpen(true); setActive(-1); }}
        onKeyDown={event => {
          if (event.key === "Escape" && expanded) {
            event.preventDefault(); event.stopPropagation(); setOpen(false);
          } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault(); setOpen(true);
            if (options.length) setActive(index => index < 0
              ? event.key === "ArrowDown" ? 0 : options.length - 1
              : (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
          } else if (event.key === "Enter" && expanded && active >= 0 && options[active]) {
            event.preventDefault(); select(options[active]);
          }
        }}
      />
      {expanded && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border border-input bg-popover shadow-lg">
          <ul id={listId} role="listbox" aria-label="Matching Music City users" className="max-h-60 overflow-y-auto p-1">
            {options.map((profile, index) => (
              <li
                key={profile.id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                onMouseDown={event => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => select(profile)}
                className={`min-h-11 cursor-pointer rounded px-3 py-2 text-sm ${index === active ? "bg-accent" : "hover:bg-accent"}`}
              >
                <span className="block break-words">{profile.name}</span>
                <span className="block text-xs text-muted-foreground">{profile.walletAddress.slice(0, 6)}…{profile.walletAddress.slice(-4)}</span>
              </li>
            ))}
          </ul>
          {!options.length && (
            <p role="status" className="px-3 pb-3 text-xs text-muted-foreground">
              {query.length < 2 ? "Type at least 2 characters to find a Music City user."
                : loading ? "Searching users…"
                  : currentResult?.error ? "Couldn't search users. Keep the name or try again."
                    : "No users found. You can keep this name without linking a profile."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
