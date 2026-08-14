"use client";

import Link from "next/link";
import {
  ChevronDown,
  CircleUserRound,
  Compass,
  LayoutDashboard,
  LogOut,
  Menu,
  Play,
  Settings,
} from "lucide-react";
import { useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  primaryNavigationItems,
} from "@/lib/constants/navigation";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export const SiteHeader = () => {
  const { session, connectWallet, isLoading, logout } = useAuth();
  const location = useLocation();
  const pathname = location.pathname;

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-[#03030d]/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="rounded-full border-white/10 bg-white/[0.04] text-white hover:bg-white/10 lg:hidden"
                aria-label="Open navigation menu"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-72 border-white/10 bg-[#070718] p-2 text-white shadow-2xl shadow-black/40"
            >
              <DropdownMenuLabel className="px-3 pt-2 text-[11px] font-medium uppercase tracking-[0.24em] text-white/45">
                Explore
              </DropdownMenuLabel>
              {primaryNavigationItems.map((item) => (
                <DropdownMenuItem
                  key={item.href}
                  asChild
                  className="rounded-2xl px-3 py-3 focus:bg-white/10 focus:text-white"
                >
                  <Link href={item.href} className="flex flex-col items-start gap-1">
                    <span className="text-sm font-semibold text-white">{item.label}</span>
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Link href="/" className="flex min-w-0 items-center gap-3 text-white">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-violet-500 to-cyan-300 shadow-[0_0_22px_rgba(139,92,246,0.45)]">
              <Play className="ml-0.5 h-4 w-4 fill-white text-white" />
            </span>
            <span className="truncate text-xl font-bold tracking-[-0.04em]">
              Music City
            </span>
          </Link>
        </div>

        <nav className="hidden items-center lg:flex">
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
            {primaryNavigationItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium text-white/65 transition hover:text-white",
                  isActive(item.href) && "bg-white/10 text-white",
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {session ? (
            <>
              <span className="hidden text-sm text-slate-300 xl:inline">
                {session.displayName ||
                  `${session.walletAddress.slice(0, 6)}...${session.walletAddress.slice(-4)}`}
              </span>
              {session.primaryIntent === "artist" || session.primaryIntent === "both" ? (
                <Button
                  asChild
                  variant="outline"
                  className="rounded-full border-white/10 bg-white/[0.04] px-3 text-white hover:bg-white/10"
                >
                  <Link href="/dashboard">
                    <LayoutDashboard className="h-4 w-4" />
                    <span className="hidden sm:inline">Studio</span>
                  </Link>
                </Button>
              ) : null}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="gap-2 rounded-full border-white/10 bg-white/[0.04] px-3 text-white hover:bg-white/10"
                    aria-label="Open account menu"
                  >
                    {session.profileImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={session.profileImageUrl}
                        alt=""
                        className="size-6 rounded-full object-cover"
                      />
                    ) : (
                      <CircleUserRound className="h-4 w-4" />
                    )}
                    <ChevronDown className="h-4 w-4 text-slate-300" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-56 border-white/10 bg-[#070718] text-white shadow-2xl shadow-violet-950/30"
                >
                  <DropdownMenuLabel className="space-y-1 text-slate-300">
                    <div className="text-sm font-medium text-white">
                      {session.displayName || "Signed in"}
                    </div>
                    <div className="text-xs text-slate-400">
                      {session.walletAddress.slice(0, 6)}...{session.walletAddress.slice(-4)}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem
                    asChild
                    className="cursor-pointer focus:bg-white/10 focus:text-white"
                  >
                    <Link href="/account">
                      <Settings className="h-4 w-4" />
                      Account
                    </Link>
                  </DropdownMenuItem>
                  {session.primaryIntent === "artist" || session.primaryIntent === "both" ? (
                    <DropdownMenuItem
                      asChild
                      className="cursor-pointer focus:bg-white/10 focus:text-white sm:hidden"
                    >
                      <Link href="/dashboard">
                        <LayoutDashboard className="h-4 w-4" />
                        Studio
                      </Link>
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuSeparator className="bg-white/10 lg:hidden" />
                  <DropdownMenuItem
                    asChild
                    className="cursor-pointer focus:bg-white/10 focus:text-white lg:hidden"
                  >
                    <Link href="/discover">
                      <Compass className="h-4 w-4" />
                      Discover
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer text-red-300 focus:bg-red-500/10 focus:text-red-200"
                    onClick={() => void logout()}
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button
              className="rounded-full bg-white px-5 font-bold text-black hover:bg-white/90 sm:px-6"
              onClick={() => void connectWallet()}
              disabled={isLoading}
            >
              {isLoading ? "Opening..." : "Login"}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};
