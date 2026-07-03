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
    description: "Studio home",
    icon: LayoutDashboard,
  },
  {
    href: "/dashboard/create",
    label: "Create",
    description: "Upload a new track",
    icon: PlusSquare,
  },
  {
    href: "/dashboard/tracks",
    label: "Tracks",
    description: "Manage your catalog",
    icon: Library,
  },
  {
    href: "/dashboard/releases",
    label: "Releases",
    description: "Singles, EPs, and albums",
    icon: Disc3,
  },
  {
    href: "/dashboard/analytics",
    label: "Analytics",
    description: "Streams and audience",
    icon: BarChart3,
  },
  {
    href: "/dashboard/revenue",
    label: "Revenue",
    description: "Sales and subscriptions",
    icon: CircleDollarSign,
  },
] as const;

export const StudioShell = ({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) => {
  const location = useLocation();
  const pathname = location.pathname;

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <section className="py-10 sm:py-14">
      <PageContainer>
        <div className="space-y-8">
          <div className="rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_32%),rgba(255,255,255,0.03)] p-6 sm:p-8">
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-emerald-400">
              {eyebrow}
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              {title}
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">
              {description}
            </p>
          </div>

          <div className="grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)]">
            <aside className="space-y-3 xl:sticky xl:top-24 xl:self-start">
              <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-3">
                <div className="mb-3 px-3 pt-2">
                  <p className="text-xs font-medium uppercase tracking-[0.24em] text-white/40">
                    Studio navigation
                  </p>
                </div>
                <nav className="grid gap-1">
                  {studioNavItems.map((item) => {
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "rounded-2xl px-3 py-3 transition",
                          isActive(item.href)
                            ? "bg-white/10 text-white"
                            : "text-white/65 hover:bg-white/6 hover:text-white",
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              "mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl border",
                              isActive(item.href)
                                ? "border-emerald-400/35 bg-emerald-400/12 text-emerald-300"
                                : "border-white/10 bg-white/[0.03] text-white/70",
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold">{item.label}</p>
                            <p className="mt-1 text-xs leading-relaxed text-white/45">
                              {item.description}
                            </p>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </aside>

            <div className="space-y-4">
              <div className="flex gap-2 overflow-x-auto pb-1 xl:hidden">
                {studioNavItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition",
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
