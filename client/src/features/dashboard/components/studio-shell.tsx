"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  BarChart3,
  CircleDollarSign,
  Disc3,
  LayoutDashboard,
  Library,
  PlusSquare,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const studioNavItems = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: LayoutDashboard,
  },
  {
    href: "/dashboard/create",
    label: "Create",
    icon: PlusSquare,
  },
  {
    href: "/dashboard/tracks",
    label: "Tracks",
    icon: Library,
  },
  {
    href: "/dashboard/releases",
    label: "Releases",
    icon: Disc3,
  },
  {
    href: "/dashboard/analytics",
    label: "Analytics",
    icon: BarChart3,
  },
  {
    href: "/dashboard/revenue",
    label: "Revenue",
    icon: CircleDollarSign,
  },
  { href: "/account/agreements", label: "Royalty agreements", icon: Disc3 },
] as const;

export const StudioShell = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isActive = (href: string) =>
    pathname === href ||
    (href !== "/dashboard" && pathname.startsWith(`${href}/`));
  const activeDestination =
    studioNavItems.find((item) => isActive(item.href))?.href ?? "";

  return (
    <section className="studio-workspace min-h-[calc(100vh-4rem)] bg-background py-6 sm:py-8">
      <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-8">
          <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
            <p className="mb-4 px-3 text-sm font-semibold text-muted-foreground">
              Artist Studio
            </p>
            <nav aria-label="Studio navigation" className="space-y-1">
              {studioNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isActive(item.href)
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <Icon
                      aria-hidden="true"
                      className={cn(
                        "h-4 w-4 shrink-0",
                        isActive(item.href) && "text-primary",
                      )}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
          <div className="min-w-0 space-y-6">
            <nav aria-label="Mobile Studio navigation" className="lg:hidden">
              <label
                htmlFor="studio-destination"
                className="mb-2 block text-sm font-medium text-muted-foreground"
              >
                Artist Studio
              </label>
              <Select
                id="studio-destination"
                value={activeDestination}
                onChange={(event) => navigate(event.target.value)}
              >
                {!activeDestination ? (
                  <option value="" disabled>
                    Choose a section
                  </option>
                ) : null}
                {studioNavItems.map((item) => (
                  <option key={item.href} value={item.href}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </nav>
            {children}
          </div>
        </div>
      </div>
    </section>
  );
};
