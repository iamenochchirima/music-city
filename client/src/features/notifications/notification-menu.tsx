import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { clientEnv } from "@/lib/config/env";

type Notification = {
  id: string;
  title: string;
  body: string;
  href: string;
  createdAt: string;
  readAt: string | null;
};
type Inbox = {
  items: Notification[];
  unreadCount: number;
  nextCursor?: string | null;
};
export function NotificationMenu({ token }: { token?: string }) {
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const request = useCallback(
    async (path = "", method = "GET", signal?: AbortSignal) => {
      const response = await fetch(
        `${clientEnv.apiBaseUrl}/notifications${path}`,
        {
          method,
          credentials: "include",
          cache: "no-store",
          signal: signal ?? AbortSignal.timeout(15000),
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      );
      if (!response.ok)
        throw new Error("Could not load notifications. Try again.");
      return method === "GET" ? ((await response.json()) as Inbox) : null;
    },
    [token],
  );
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const next = await request("", "GET", signal);
        if (!signal?.aborted) {
          setInbox(next);
          setError(null);
        }
      } catch {
        if (!signal?.aborted)
          setError("Could not load notifications. Try again.");
      }
    },
    [request],
  );
  useEffect(() => {
    const controller = new AbortController();
    setInbox(null);
    const check = () => {
      if (document.visibilityState !== "hidden")
        void refresh(controller.signal);
    };
    check();
    const timer = setInterval(check, 30000);
    window.addEventListener("focus", check);
    return () => {
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("focus", check);
    };
  }, [refresh]);
  async function read(id?: string) {
    try {
      await request(id ? `/${id}/read` : "/read", "POST");
      await refresh();
    } catch {
      setError("Could not mark notifications as read. Try again.");
    }
  }
  async function older() {
    if (!inbox?.nextCursor) return;
    try {
      const next = await request(`?before=${inbox.nextCursor}`);
      if (next)
        setInbox((previous) =>
          previous
            ? {
                ...next,
                items: [
                  ...previous.items,
                  ...next.items.filter(
                    (item) =>
                      !previous.items.some(
                        (existing) => existing.id === item.id,
                      ),
                  ),
                ],
              }
            : next,
        );
      setError(null);
    } catch {
      setError("Could not load older notifications. Try again.");
    }
  }
  const count = inbox?.unreadCount ?? 0;
  return (
    <DropdownMenu
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (value) void refresh();
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative rounded-full border-white/10 bg-white/[0.04] text-white hover:bg-white/10"
          aria-label={`Notifications${count ? `, ${count} unread` : ""}`}
        >
          <Bell className="h-4 w-4" />
          {count > 0 && (
            <span
              className="absolute -right-1 -top-1 min-w-4 rounded-full bg-violet-500 px-1 text-[10px] leading-4 text-white"
              aria-hidden="true"
            >
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-96 max-w-[calc(100vw-2rem)] border-white/10 bg-[#070718] text-white shadow-2xl"
      >
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        {count > 0 && (
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              void read();
            }}
            className="cursor-pointer focus:bg-white/10 focus:text-white"
          >
            Mark all as read
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator className="bg-white/10" />
        {error && (
          <div className="px-2 py-3 text-sm" role="status">
            {error}{" "}
            <button className="underline" onClick={() => void refresh()}>
              Retry
            </button>
          </div>
        )}
        {!inbox && !error && (
          <p className="px-2 py-4 text-sm text-slate-400">
            Loading notifications...
          </p>
        )}
        {inbox?.items.length === 0 && !error && (
          <p className="px-2 py-4 text-sm text-slate-400">
            You're all caught up. Agreement requests and account updates will
            appear here.
          </p>
        )}
        <div className="max-h-[55vh] overflow-y-auto">
          {inbox?.items.map((item) => (
            <DropdownMenuItem
              key={item.id}
              asChild
              className="cursor-pointer items-start rounded-lg px-3 py-3 focus:bg-white/10 focus:text-white"
            >
              <Link
                href={item.href}
                onClick={() => {
                  setOpen(false);
                  if (!item.readAt) void read(item.id);
                }}
                className="flex flex-col gap-1"
              >
                <span
                  className={
                    item.readAt
                      ? "text-sm text-slate-300"
                      : "text-sm font-semibold text-white"
                  }
                >
                  {!item.readAt && (
                    <span
                      aria-label="Unread"
                      className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-violet-400"
                    />
                  )}
                  {item.title}
                </span>
                <span className="text-xs leading-relaxed text-slate-400">
                  {item.body}
                </span>
                <time
                  dateTime={item.createdAt}
                  className="text-xs text-slate-500"
                >
                  {new Date(item.createdAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </time>
              </Link>
            </DropdownMenuItem>
          ))}
          {inbox?.nextCursor && (
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                void older();
              }}
              className="cursor-pointer focus:bg-white/10 focus:text-white"
            >
              Load older notifications
            </DropdownMenuItem>
          )}
        </div>
        <DropdownMenuSeparator className="bg-white/10" />
        <p className="px-2 py-2 text-xs leading-relaxed text-slate-400">
          Agreement, payment and account emails go to your profile email.
          Release, artist and product updates follow your preferences.
        </p>
        <DropdownMenuItem
          asChild
          className="focus:bg-white/10 focus:text-white"
        >
          <Link href="/account" onClick={() => setOpen(false)}>
            Manage your profile
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
