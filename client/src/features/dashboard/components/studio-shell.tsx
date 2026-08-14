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
import { useLocation } from "react-router-dom";

import { PageContainer } from "@/components/common/page-container";
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
] as const;

export const StudioShell = ({
  children,
}: {
  children: ReactNode;
}) => {
  const location = useLocation();
  const pathname = location.pathname;

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <section className="py-6 sm:py-10">
      <PageContainer>
        <div className="space-y-5">
          <div className="grid gap-4 xl:grid-cols-[216px_minmax(0,1fr)]">
            <aside className="xl:sticky xl:top-24 xl:self-start">
              <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-2">
                <div className="sr-only">Studio navigation</div>
                <nav className="grid gap-0.5">
                  {studioNavItems.map((item) => {
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "rounded-lg px-2.5 py-2 transition",
                          isActive(item.href)
                            ? "bg-white/10 text-white"
                            : "text-white/65 hover:bg-white/6 hover:text-white",
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                              isActive(item.href)
                                ? "border-emerald-400/35 bg-emerald-400/12 text-emerald-300"
                                : "border-white/10 bg-white/[0.03] text-white/70",
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <p className="text-sm font-medium">{item.label}</p>
                        </div>
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </aside>

            <div className="min-w-0 space-y-4">
              <div className="flex gap-1.5 overflow-x-auto pb-1 xl:hidden">
                {studioNavItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "whitespace-nowrap rounded-lg border px-3 py-2 text-sm font-medium transition",
                      isActive(item.href)
                        ? "border-emerald-400/35 bg-emerald-400/12 text-emerald-200"
                        : "border-white/10 bg-white/[0.03] text-white/65 hover:text-white",
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>

              {children}
            </div>
          </div>
        </div>
      </PageContainer>
    </section>
  );
};
