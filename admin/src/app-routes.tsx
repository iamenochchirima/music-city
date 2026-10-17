import { AdminSupportPage } from "@/features/support/support-page";
import { RoyaltyLedgerPage, TreasuryAccountPage } from "@/features/settlements/financial-history";
import { AdminSettlementsPage } from "@/features/settlements/settlements-page";
import { AdminReferralsPage } from "@/features/referrals/referrals-page";
import { AdminSponsorshipsPage } from "@/features/sponsorships/sponsorships-page";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import {
  BarChart3,
  CreditCard,
  Eye,
  EyeOff,
  LayoutDashboard,
  Menu,
  X,
  LogOut,
  Megaphone,
  Percent,
  Radio,
  RefreshCw,
  ShieldCheck,
  Ticket,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import type {
  AdminAccount,
  AdminAnalyticsOverview,
  AdminPlatformSubscriptionSettings,
  AdminSubscriptionList,
  AdminUserList,
  AdminRole,
} from "@music-city/shared";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdsPage } from "@/features/ads/components/ads-page";
import { AdminAgreementsPage } from "@/features/agreements/agreements-page";
import { adminApi } from "@/features/auth/lib/admin-api";
import { useAdminAuth } from "@/features/auth/providers/admin-auth-provider";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/console/support", label: "Fan support", description: "Direct USDC payments", icon: Wallet },
  { href: "/console/sponsorships", label: "Artist sponsorship", description: "Early-user discount", icon: Ticket },
  { href: "/console/referrals", label: "Referrals", description: "Artist registration", icon: ShieldCheck },
  { href: "/console/settlements", label: "Settlements", description: "Fund and reconcile earnings", icon: ShieldCheck },
  { href: "/console/agreements", label: "Agreements", description: "Contributor consent", icon: ShieldCheck },
  {
    href: "/console/analytics",
    label: "Analytics",
    description: "Platform health",
    icon: LayoutDashboard,
  },
  {
    href: "/console",
    label: "Subscriptions",
    description: "Pricing and billing",
    icon: CreditCard,
  },
  {
    href: "/console/admins",
    label: "Admins",
    description: "Access control",
    icon: Users,
  },
  {
    href: "/console/subscribers",
    label: "Subscribers",
    description: "All subscriptions",
    icon: Ticket,
  },
  {
    href: "/console/users",
    label: "Users",
    description: "Audience accounts",
    icon: Users,
  },
  {
    href: "/console/ads",
    label: "Ads",
    description: "Preroll inventory",
    icon: Megaphone,
  },
  {
    href: "/console/royalties",
    label: "Royalties",
    description: "Split registry",
    icon: Percent,
  },
  {
    href: "/console/treasury",
    label: "Treasury",
    description: "Receiving wallet",
    icon: Wallet,
  },
];

const formatRole = (role: AdminRole) =>
  role === "super_admin" ? "Super admin" : "Admin";

const shellPanelClassName = "border border-white/8 bg-[#0f1728]";
const fieldClassName =
  "h-10 rounded-md border border-white/10 bg-[#0b1220] px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-300/35 focus:ring-2 focus:ring-emerald-300/15";
const selectClassName =
  "flex h-10 w-full rounded-md border border-white/10 bg-[#0b1220] px-3 text-sm text-white outline-none transition focus:border-emerald-300/35 focus:ring-2 focus:ring-emerald-300/15";

const PasswordField = ({
  id,
  value,
  onChange,
  placeholder,
  autoComplete,
  minLength,
}: {
  id: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  autoComplete?: string;
  minLength?: number;
}) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        id={id}
        type={isVisible ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        minLength={minLength}
        className={cn(fieldClassName, "pr-10")}
        required
      />
      <button
        type="button"
        onClick={() => setIsVisible((current) => !current)}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-500 transition hover:text-slate-200"
        aria-label={isVisible ? "Hide password" : "Show password"}
      >
        {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
};

const StatTile = ({
  label,
  value,
}: {
  label: string;
  value: string;
}) => (
  <div className="border border-white/8 bg-[#0f1728] px-4 py-3">
    <p className="text-[0.65rem] uppercase tracking-[0.18em] text-slate-500">
      {label}
    </p>
    <p className="mt-2 text-xl font-semibold tracking-[-0.03em] text-white">
      {value}
    </p>
  </div>
);

const SectionHeader = ({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) => (
  <div className="flex flex-col gap-3 border-b border-white/8 pb-4 sm:flex-row sm:items-start sm:justify-between">
    <div className="space-y-1">
      <h2 className="text-xl font-semibold tracking-[-0.03em] text-white">
        {title}
      </h2>
      <p className="text-sm text-slate-400">{description}</p>
    </div>
    {action ? <div>{action}</div> : null}
  </div>
);

const formatBalanceAmount = (value: string) => {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return value;
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 7,
  }).format(numeric);
};

const formatDateTime = (value?: string) => {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

const amountScale = 10_000_000n;

const amountToBaseUnits = (value: string) => {
  const [whole, fraction = ""] = value.split(".");
  const paddedFraction = `${fraction}0000000`.slice(0, 7);
  return BigInt(whole || "0") * amountScale + BigInt(paddedFraction || "0");
};

const baseUnitsToAmount = (value: bigint) => {
  const whole = value / amountScale;
  const fraction = (value % amountScale).toString().padStart(7, "0");
  return `${whole.toString()}.${fraction}`;
};

const formatMoneyAmount = (value: string) => {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return value;
  }

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(numeric);
};

const assetDisplayLabel = (assetCode?: string) => assetCode ?? "XLM";

const adminAnalyticsWindowOptions = [
  { label: "7D", value: 7 as const },
  { label: "30D", value: 30 as const },
  { label: "90D", value: 90 as const },
  { label: "Lifetime", value: "lifetime" as const },
];

const formatAssetAmount = (amount: string, assetCode?: string) =>
  `${formatMoneyAmount(amount)} ${assetDisplayLabel(assetCode)}`;

const summarizeAssetAmounts = (
  items: Array<{
    amount: string;
    assetCode?: string;
    assetIssuer?: string;
  }>,
) => {
  const groups = new Map<string, bigint>();

  for (const item of items) {
    const key = `${item.assetCode ?? "XLM"}:${item.assetIssuer ?? ""}`;
    groups.set(key, (groups.get(key) ?? 0n) + amountToBaseUnits(item.amount));
  }

  return Array.from(groups.entries()).map(([key, amount]) => {
    const [assetCode, assetIssuer] = key.split(":");
    return {
      amount: baseUnitsToAmount(amount),
      assetCode: assetCode === "XLM" ? undefined : assetCode,
      assetIssuer: assetIssuer || undefined,
    };
  });
};

const LoadingScreen = ({ label }: { label: string }) => (
  <div className="flex min-h-screen items-center justify-center bg-[#0a1120] px-6">
    <div className="w-full max-w-sm border border-white/8 bg-[#0f1728] p-8 text-center">
      <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-emerald-400/20 border-t-emerald-300" />
      <p className="text-sm text-slate-300">{label}</p>
    </div>
  </div>
);

const SkeletonBlock = ({
  className,
}: {
  className?: string;
}) => (
  <div
    className={cn("animate-pulse bg-white/8", className)}
    aria-hidden="true"
  />
);

const PageLoadingShell = ({
  title,
  description,
  stats = 3,
  sidebar = false,
}: {
  title: string;
  description: string;
  stats?: number;
  sidebar?: boolean;
}) => (
  <SidebarLayout>
    <div className="space-y-6">
      <SectionHeader
        title={title}
        description={description}
        action={<SkeletonBlock className="h-9 w-24" />}
      />

      <div
        className={cn(
          "grid gap-3",
          stats === 5
            ? "md:grid-cols-5"
            : stats === 4
              ? "md:grid-cols-4"
              : "md:grid-cols-3",
        )}
      >
        {Array.from({ length: stats }).map((_, index) => (
          <div key={index} className="border border-white/8 bg-[#0f1728] px-4 py-3">
            <SkeletonBlock className="h-3 w-20" />
            <SkeletonBlock className="mt-3 h-7 w-24" />
          </div>
        ))}
      </div>

      <div
        className={cn(
          "grid gap-6",
          sidebar ? "xl:grid-cols-[minmax(0,1fr)_340px]" : undefined,
        )}
      >
        <section className={cn(shellPanelClassName, "space-y-4 p-5")}>
          <SkeletonBlock className="h-5 w-40" />
          <SkeletonBlock className="h-4 w-72 max-w-full" />
          <div className="space-y-3 pt-2">
            <SkeletonBlock className="h-10 w-full" />
            <SkeletonBlock className="h-10 w-full" />
            <SkeletonBlock className="h-10 w-3/4" />
            <SkeletonBlock className="h-40 w-full" />
          </div>
        </section>

        {sidebar ? (
          <aside className="space-y-4">
            <section className={cn(shellPanelClassName, "space-y-4 p-5")}>
              <SkeletonBlock className="h-5 w-28" />
              <SkeletonBlock className="h-4 w-full" />
              <SkeletonBlock className="h-24 w-full" />
            </section>
            <section className={cn(shellPanelClassName, "space-y-3 p-5")}>
              <SkeletonBlock className="h-5 w-20" />
              <SkeletonBlock className="h-4 w-full" />
              <SkeletonBlock className="h-4 w-5/6" />
            </section>
          </aside>
        ) : null}
      </div>
    </div>
  </SidebarLayout>
);

const TableLoadingShell = ({
  title,
  description,
  stats = 4,
  columns,
  columnCount,
}: {
  title: string;
  description: string;
  stats?: number;
  columns: string;
  columnCount: number;
}) => (
  <SidebarLayout>
    <div className="space-y-6">
      <SectionHeader title={title} description={description} />

      <div
        className={cn(
          "grid gap-3",
          stats === 5
            ? "md:grid-cols-5"
            : stats === 4
              ? "md:grid-cols-4"
              : "md:grid-cols-3",
        )}
      >
        {Array.from({ length: stats }).map((_, index) => (
          <div key={index} className="border border-white/8 bg-[#0f1728] px-4 py-3">
            <SkeletonBlock className="h-3 w-20" />
            <SkeletonBlock className="mt-3 h-7 w-16" />
          </div>
        ))}
      </div>

      <section className={cn(shellPanelClassName, "overflow-hidden")}>
        <div className={cn("grid gap-4 border-b border-white/8 px-4 py-3", columns)}>
          {Array.from({ length: columnCount }).map((_, index) => (
            <SkeletonBlock key={index} className="h-3 w-16" />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, rowIndex) => (
          <div
            key={rowIndex}
            className={cn("grid gap-4 border-t border-white/6 px-4 py-4", columns)}
          >
            {Array.from({ length: columnCount }).map((_, cellIndex) => (
              <SkeletonBlock key={cellIndex} className="h-4 w-full" />
            ))}
          </div>
        ))}
      </section>
    </div>
  </SidebarLayout>
);

const EmptyState = ({
  title,
  description,
}: {
  title: string;
  description: string;
}) => (
  <div className="border border-dashed border-white/12 bg-[#0f1728] px-6 py-10 text-center">
    <p className="text-base font-medium text-white">{title}</p>
    <p className="mx-auto mt-2 max-w-lg text-sm text-slate-400">{description}</p>
  </div>
);

const SidebarLayout = ({ children }: { children: React.ReactNode }) => {
  const { admin, logout } = useAdminAuth();
  const [navigationOpen, setNavigationOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0a1120] text-slate-100">
      <div className="grid min-h-screen grid-rows-[auto_1fr] lg:grid-cols-[240px_minmax(0,1fr)] lg:grid-rows-none">
        <aside className="border-b border-white/8 bg-[#0c1424] lg:border-b-0 lg:border-r">
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-white/8 px-5 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center bg-emerald-400/12 text-emerald-300">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                    Music City
                  </p>
                  <p className="text-sm font-semibold text-white">Admin</p>
                </div>
              </div>
              <Button type="button" variant="ghost" size="icon" className="lg:hidden" aria-label={navigationOpen ? "Close navigation" : "Open navigation"} aria-expanded={navigationOpen} aria-controls="admin-navigation" onClick={() => setNavigationOpen(!navigationOpen)}>
                {navigationOpen ? <X className="size-5" /> : <Menu className="size-5" />}
              </Button>
            </div>
            <div id="admin-navigation" className={cn("flex-1 flex-col", navigationOpen ? "flex" : "hidden", "lg:flex")}>
            <nav className="flex-1 px-3 py-4">
              <div className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;

                  return (
                    <NavLink
                      key={item.href}
                      to={item.href}
                      onClick={() => setNavigationOpen(false)}
                      end={item.href === "/console"}
                      className={({ isActive }) =>
                        cn(
                          "flex items-start gap-3 border px-3 py-3 text-sm transition",
                          isActive
                            ? "border-emerald-400/25 bg-emerald-400/8 text-white"
                            : "border-transparent text-slate-300 hover:border-white/8 hover:bg-white/[0.03] hover:text-white",
                        )
                      }
                    >
                      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium">{item.label}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.description}
                        </p>
                      </div>
                    </NavLink>
                  );
                })}
              </div>
            </nav>

            <div className="border-t border-white/8 px-4 py-4">
              <div className="space-y-1">
                <p className="truncate text-sm font-medium text-white">
                  {admin?.name}
                </p>
                <p className="truncate text-xs text-slate-500">{admin?.email}</p>
                <p className="text-xs text-slate-500">
                  {admin ? formatRole(admin.role) : ""}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="mt-4 h-9 w-full justify-start rounded-md border border-white/8 px-3 text-slate-300 hover:bg-white/[0.04]"
                onClick={() => void logout()}
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
            </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0">
          <div className="border-b border-white/8 bg-[#0c1424]/65 px-5 py-4 backdrop-blur md:px-7">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <LayoutDashboard className="h-4 w-4" />
              <span>Admin dashboard</span>
            </div>
          </div>
          <div className="px-5 py-5 md:px-7 md:py-6">{children}</div>
        </main>
      </div>
    </div>
  );
};

const AuthPage = () => {
  const {
    bootstrapRequired,
    bootstrapAdmin,
    login,
    isLoading,
    refreshBootstrapStatus,
  } = useAdminAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [bootstrapToken, setBootstrapToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    void refreshBootstrapStatus();
  }, [refreshBootstrapStatus]);

  const mode = bootstrapRequired ? "bootstrap" : "login";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      if (bootstrapRequired) {
        await bootstrapAdmin({ name, email, password, bootstrapToken });
        toast.success("Super admin created.");
        return;
      }

      await login({ email, password });
      toast.success("Signed in.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Request failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading && bootstrapRequired === null) {
    return <LoadingScreen label="Loading admin access..." />;
  }

  return (
    <div className="min-h-screen bg-[#0a1120]">
      <div className="mx-auto grid min-h-screen max-w-5xl items-center gap-10 px-6 py-8 lg:grid-cols-[1fr_380px]">
        <section className="space-y-4">
          <div className="flex h-10 w-10 items-center justify-center bg-emerald-400/12 text-emerald-300">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
              Music City Admin
            </p>
            <h1 className="text-4xl font-semibold tracking-[-0.05em] text-white">
              Login
            </h1>
            <p className="max-w-sm text-sm text-slate-400">
              {bootstrapRequired
                ? "Create the first admin account with the one-time setup token supplied by the operator."
                : "Sign in to manage subscriptions and admin access."}
            </p>
          </div>
        </section>

        <Card className={cn(shellPanelClassName, "rounded-none shadow-none")}>
          <CardHeader className="space-y-2 border-b border-white/8 pb-4">
            <CardTitle className="text-xl text-white">Login</CardTitle>
            <CardDescription className="text-slate-400">
              {mode === "bootstrap"
                ? "Set up the first admin account."
                : "Use your admin credentials."}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            <form className="space-y-4" onSubmit={handleSubmit}>
              {mode === "bootstrap" ? (
                <>
                <div className="space-y-2">
                  <Label htmlFor="name">Full name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Alex Johnson"
                    autoComplete="name"
                    className={fieldClassName}
                    required
                  />
                </div>
                <div className="space-y-2">
          <Label htmlFor="bootstrap-token">Admin setup token</Label>
                  <PasswordField
                    id="bootstrap-token"
                    value={bootstrapToken}
                    onChange={(event) => setBootstrapToken(event.target.value)}
                    placeholder="Provided by the operator"
                    autoComplete="off"
                  />
                </div>
                </>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin@musiccity.app"
                  autoComplete="email"
                  className={fieldClassName}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <PasswordField
                  id="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Password"
                  autoComplete={
                    mode === "bootstrap" ? "new-password" : "current-password"
                  }
                  minLength={mode === "bootstrap" ? 12 : undefined}
                />
              </div>
              <Button
                type="submit"
                className="h-10 w-full rounded-md"
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? "Please wait..."
                  : mode === "bootstrap"
                    ? "Create admin"
                    : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const SubscriptionSettingsPage = () => {
  const { session } = useAdminAuth();
  const [settings, setSettings] = useState<AdminPlatformSubscriptionSettings | null>(
    null,
  );
  const [draft, setDraft] = useState<AdminPlatformSubscriptionSettings | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!session?.token) {
        return;
      }

      setIsLoading(true);

      try {
        const next = await adminApi.getPlatformSubscriptionSettings(session.token);

        if (!cancelled) {
          setSettings(next);
          setDraft(next);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Failed to load plan");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [session?.token]);

  const stats = useMemo(() => {
    if (!settings) {
      return [];
    }

    return [
      {
        label: "Status",
        value: settings.enabled ? "Enabled" : "Disabled",
      },
      {
        label: "Period",
        value: `${settings.periodDays} days`,
      },
      {
        label: "Asset",
        value: settings.assetCode,
      },
    ];
  }, [settings]);

  const updateDraft = <K extends keyof AdminPlatformSubscriptionSettings>(
    key: K,
    value: AdminPlatformSubscriptionSettings[K],
  ) => {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!draft || !session?.token) {
      return;
    }

    setIsSaving(true);

    try {
      const next = await adminApi.updatePlatformSubscriptionSettings(
        draft,
        session.token,
      );
      setSettings(next);
      setDraft(next);
      toast.success("Platform subscription plan updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save plan");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <PageLoadingShell
        title="Platform subscription"
        description="Manage the plan shown to users before checkout."
        stats={3}
        sidebar
      />
    );
  }

  if (!draft) {
    return (
      <SidebarLayout>
        <EmptyState
          title="Subscription settings unavailable"
          description="The plan could not be loaded from the API."
        />
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <SectionHeader
          title="Platform subscription"
          description="Manage the plan shown to users before checkout."
          action={
            <Button
              type="submit"
              form="platform-plan-form"
              className="h-9 rounded-md px-4"
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          }
        />

        <div className="grid gap-3 md:grid-cols-3">
          {stats.map((item) => (
            <StatTile key={item.label} label={item.label} value={item.value} />
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <form
            id="platform-plan-form"
            className="space-y-5"
            onSubmit={handleSubmit}
          >
            <section className={cn(shellPanelClassName, "p-5")}>
              <div className="mb-4 flex items-center justify-between border-b border-white/8 pb-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">Plan settings</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    Name, billing, asset, and checkout text.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => updateDraft("enabled", !draft.enabled)}
                  className={cn(
                    "inline-flex h-8 items-center gap-2 border px-3 text-xs font-medium transition",
                    draft.enabled
                      ? "border-emerald-400/25 bg-emerald-400/8 text-emerald-200"
                      : "border-white/10 text-slate-400 hover:text-white",
                  )}
                >
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      draft.enabled ? "bg-emerald-300" : "bg-slate-500",
                    )}
                  />
                  {draft.enabled ? "Enabled" : "Disabled"}
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="plan-name">Plan name</Label>
                  <Input
                    id="plan-name"
                    value={draft.name}
                    onChange={(event) => updateDraft("name", event.target.value)}
                    className={fieldClassName}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Price</Label>
                  <Input
                    id="price"
                    value={draft.price}
                    onChange={(event) => updateDraft("price", event.target.value)}
                    className={fieldClassName}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="period-days">Billing period</Label>
                  <Input
                    id="period-days"
                    type="number"
                    min={1}
                    value={draft.periodDays}
                    onChange={(event) =>
                      updateDraft("periodDays", Number(event.target.value) || 1)
                    }
                    className={fieldClassName}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="asset-code">Asset code</Label>
                  <Input
                    id="asset-code"
                    value={draft.assetCode}
                    onChange={(event) =>
                      updateDraft("assetCode", event.target.value.toUpperCase())
                    }
                    className={fieldClassName}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="asset-issuer">Asset issuer</Label>
                  <Input
                    id="asset-issuer"
                    value={draft.assetIssuer ?? ""}
                    onChange={(event) => updateDraft("assetIssuer", event.target.value)}
                    placeholder="Leave blank for XLM"
                    className={fieldClassName}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="description">Checkout description</Label>
                  <textarea
                    id="description"
                    value={draft.description}
                    onChange={(event) => updateDraft("description", event.target.value)}
                    className={cn(fieldClassName, "min-h-28 py-2.5")}
                    required
                  />
                </div>
              </div>
            </section>
          </form>

          <aside className="space-y-4">
            <section className={cn(shellPanelClassName, "p-5")}>
              <div className="border-b border-white/8 pb-3">
                <h3 className="text-sm font-semibold text-white">Preview</h3>
                <p className="mt-1 text-sm text-slate-400">
                  What users will see before checkout.
                </p>
              </div>
              <div className="space-y-4 pt-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                    Name
                  </p>
                  <p className="mt-1 text-lg font-semibold text-white">
                    {draft.name}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <StatTile
                    label="Amount"
                    value={`${draft.price} ${draft.assetCode}`}
                  />
                  <StatTile
                    label="Renews"
                    value={`Every ${draft.periodDays} days`}
                  />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                    Description
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {draft.description}
                  </p>
                </div>
              </div>
            </section>

            <section className={cn(shellPanelClassName, "p-5")}>
              <h3 className="text-sm font-semibold text-white">Notes</h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-400">
                <li>Use blank issuer for XLM.</li>
                <li>Use issuer when charging token assets like USDC.</li>
                <li>Disabling blocks new subscriptions only.</li>
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </SidebarLayout>
  );
};

const TreasuryPage = TreasuryAccountPage;

const SubscribersPage = () => {
  const { session } = useAdminAuth();
  const [data, setData] = useState<AdminSubscriptionList | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!session?.token) {
        return;
      }

      setIsLoading(true);

      try {
        const next = await adminApi.listSubscriptions(session.token);

        if (!cancelled) {
          setData(next);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error ? error.message : "Failed to load subscribers",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [session?.token]);

  if (isLoading) {
    return (
        <TableLoadingShell
          title="Subscribers"
          description="See every platform subscription across the app."
          stats={4}
          columns="grid-cols-[1.2fr_110px_110px_140px_140px_160px_160px]"
          columnCount={7}
      />
    );
  }

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <SectionHeader
          title="Subscribers"
          description="See every platform subscription across the app."
        />

        <div className="grid gap-3 md:grid-cols-4">
          <StatTile label="Total" value={String(data?.summary.total ?? 0)} />
          <StatTile label="Active" value={String(data?.summary.active ?? 0)} />
          <StatTile label="Platform" value={String(data?.summary.platform ?? 0)} />
          <StatTile label="Plans" value={String(data?.summary.platform ?? 0)} />
        </div>

        {!data || data.items.length === 0 ? (
          <EmptyState
            title="No subscriptions yet"
            description="As users subscribe, their records will appear here."
          />
        ) : (
          <section className={cn(shellPanelClassName, "overflow-hidden")}>
            <div className="grid grid-cols-[1.2fr_110px_110px_140px_140px_160px_160px] gap-4 border-b border-white/8 px-4 py-3 text-[0.68rem] uppercase tracking-[0.18em] text-slate-500">
              <span>Subscriber</span>
              <span>Scope</span>
              <span>Status</span>
              <span>Amount</span>
              <span>Artist</span>
              <span>Started</span>
              <span>Ends</span>
            </div>
            {data.items.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[1.2fr_110px_110px_140px_140px_160px_160px] gap-4 border-t border-white/6 px-4 py-4 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-white">
                    {item.walletAddress}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    Payment {item.paymentId}
                  </p>
                </div>
                <div>
                  <span className="inline-flex border border-white/10 px-2 py-1 text-xs text-slate-300">
                    {item.scope}
                  </span>
                </div>
                <div>
                  <span
                    className={cn(
                      "inline-flex border px-2 py-1 text-xs",
                      item.status === "active"
                        ? "border-emerald-400/25 bg-emerald-400/8 text-emerald-200"
                        : "border-white/10 text-slate-300",
                    )}
                  >
                    {item.status}
                  </span>
                </div>
                <div className="text-slate-300">
                  {item.amount && item.assetCode
                    ? `${formatBalanceAmount(item.amount)} ${item.assetCode}`
                    : "—"}
                </div>
                <div className="text-slate-300">Music City Pass</div>
                <div className="text-slate-300">{formatDateTime(item.startsAt)}</div>
                <div className="text-slate-300">{formatDateTime(item.endsAt)}</div>
              </div>
            ))}
          </section>
        )}
      </div>
    </SidebarLayout>
  );
};

const UsersPage = () => {
  const { session } = useAdminAuth();
  const [data, setData] = useState<AdminUserList | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!session?.token) {
        return;
      }

      setIsLoading(true);

      try {
        const next = await adminApi.listUsers(session.token);

        if (!cancelled) {
          setData(next);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Failed to load users");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [session?.token]);

  if (isLoading) {
    return (
      <TableLoadingShell
        title="Users"
        description="Browse app users and whether they currently have an active subscription."
        stats={5}
        columns="grid-cols-[1.1fr_0.9fr_120px_130px_120px_160px]"
        columnCount={6}
      />
    );
  }

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <SectionHeader
          title="Users"
          description="Browse app users and whether they currently have an active subscription."
        />

        <div className="grid gap-3 md:grid-cols-5">
          <StatTile label="Total" value={String(data?.summary.total ?? 0)} />
          <StatTile label="Subscribed" value={String(data?.summary.subscribed ?? 0)} />
          <StatTile label="Unsubscribed" value={String(data?.summary.unsubscribed ?? 0)} />
          <StatTile label="Artists" value={String(data?.summary.artists ?? 0)} />
          <StatTile label="Listeners" value={String(data?.summary.listeners ?? 0)} />
        </div>

        {!data || data.items.length === 0 ? (
          <EmptyState
            title="No users yet"
            description="User accounts will appear here as people onboard into Music City."
          />
        ) : (
          <section className={cn(shellPanelClassName, "overflow-hidden")}>
            <div className="grid grid-cols-[1.1fr_0.9fr_120px_130px_120px_160px] gap-4 border-b border-white/8 px-4 py-3 text-[0.68rem] uppercase tracking-[0.18em] text-slate-500">
              <span>User</span>
              <span>Wallet</span>
              <span>Role</span>
              <span>Subscription</span>
              <span>Active subs</span>
              <span>Updated</span>
            </div>
            {data.items.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[1.1fr_0.9fr_120px_130px_120px_160px] gap-4 border-t border-white/6 px-4 py-4 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-white">{item.displayName}</p>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {item.email || item.id}
                  </p>
                </div>
                <p className="truncate text-slate-300">{item.walletAddress}</p>
                <div>
                  <span className="inline-flex border border-white/10 px-2 py-1 text-xs text-slate-300">
                    {item.primaryIntent}
                  </span>
                </div>
                <div>
                  <span
                    className={cn(
                      "inline-flex border px-2 py-1 text-xs",
                      item.subscriptionStatus === "subscribed"
                        ? "border-emerald-400/25 bg-emerald-400/8 text-emerald-200"
                        : "border-white/10 text-slate-300",
                    )}
                  >
                    {item.subscriptionStatus}
                  </span>
                </div>
                <div className="text-slate-300">{item.activeSubscriptionCount}</div>
                <div className="text-slate-300">{formatDateTime(item.updatedAt)}</div>
              </div>
            ))}
          </section>
        )}
      </div>
    </SidebarLayout>
  );
};

const RoyaltiesPage = RoyaltyLedgerPage;

const AdminManagementPage = () => {
  const { admin, session } = useAdminAuth();
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AdminRole>("admin");

  const canManageAdmins = admin?.role === "super_admin";

  const loadAdmins = async () => {
    if (!session?.token) {
      return;
    }

    setIsLoading(true);

    try {
      const nextAdmins = await adminApi.listAdmins(session.token);
      setAdmins(nextAdmins);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load admins");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAdmins();
  }, [session?.token]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session?.token) {
      return;
    }

    setIsSubmitting(true);

    try {
      await adminApi.createAdmin({ name, email, password, role }, session.token);
      toast.success("Admin account created.");
      setName("");
      setEmail("");
      setPassword("");
      setRole("admin");
      await loadAdmins();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create admin");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <SectionHeader
          title="Admins"
          description="View current admins and add new ones."
          action={
            <div className="border border-white/8 bg-[#0f1728] px-3 py-2 text-sm text-slate-300">
              {admins.length} total
            </div>
          }
        />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className={cn(shellPanelClassName, "overflow-hidden")}>
            <div className="grid grid-cols-[1.1fr_1fr_110px] gap-4 border-b border-white/8 px-4 py-3 text-[0.68rem] uppercase tracking-[0.18em] text-slate-500">
              <span>Name</span>
              <span>Email</span>
              <span>Role</span>
            </div>

            {isLoading ? (
              <div className="px-4 py-8 text-sm text-slate-400">Loading admins...</div>
            ) : admins.length === 0 ? (
              <div className="px-4 py-8 text-sm text-slate-400">
                No admin accounts found.
              </div>
            ) : (
              admins.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[1.1fr_1fr_110px] gap-4 border-t border-white/6 px-4 py-4 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">{item.name}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">{item.id}</p>
                  </div>
                  <p className="truncate text-slate-300">{item.email}</p>
                  <div>
                    <span
                      className={cn(
                        "inline-flex border px-2 py-1 text-xs",
                        item.role === "super_admin"
                          ? "border-emerald-400/25 bg-emerald-400/8 text-emerald-200"
                          : "border-white/10 text-slate-300",
                      )}
                    >
                      {formatRole(item.role)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </section>

          <aside className="space-y-4">
            <section className={cn(shellPanelClassName, "p-5")}>
              <div className="mb-4 flex items-center gap-3 border-b border-white/8 pb-3">
                <div className="flex h-8 w-8 items-center justify-center bg-emerald-400/12 text-emerald-300">
                  <UserPlus className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Create admin</h3>
                  <p className="text-sm text-slate-400">
                    Add another operator account.
                  </p>
                </div>
              </div>

              {canManageAdmins ? (
                <form className="space-y-4" onSubmit={handleSubmit}>
                  <div className="space-y-2">
                    <Label htmlFor="admin-name">Full name</Label>
                    <Input
                      id="admin-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className={fieldClassName}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-email">Email</Label>
                    <Input
                      id="admin-email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className={fieldClassName}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-password">Temporary password</Label>
                    <PasswordField
                      id="admin-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Temporary password"
                      autoComplete="new-password"
                      minLength={12}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-role">Role</Label>
                    <select
                      id="admin-role"
                      value={role}
                      onChange={(event) => setRole(event.target.value as AdminRole)}
                      className={selectClassName}
                    >
                      <option value="admin">Admin</option>
                      <option value="super_admin">Super admin</option>
                    </select>
                  </div>
                  <Button
                    type="submit"
                    className="h-10 w-full rounded-md"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Creating..." : "Create admin"}
                  </Button>
                </form>
              ) : (
                <p className="text-sm leading-6 text-slate-400">
                  This account can view the roster but cannot create admins.
                </p>
              )}
            </section>

            <section className={cn(shellPanelClassName, "p-5")}>
              <h3 className="text-sm font-semibold text-white">Access model</h3>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                The first account created becomes super admin. After that,
                super admins control new admin creation from this dashboard.
              </p>
            </section>
          </aside>
        </div>
      </div>
    </SidebarLayout>
  );
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isLoading, session } = useAdminAuth();

  if (isLoading) {
    return <LoadingScreen label="Loading admin session..." />;
  }

  if (!session?.token) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

const AdminAnalyticsPage = () => {
  const { session } = useAdminAuth();
  const [analytics, setAnalytics] = useState<AdminAnalyticsOverview | null>(null);
  const [windowDays, setWindowDays] = useState<7 | 30 | 90 | "lifetime">(30);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadAnalytics = async (refreshOnly = false) => {
    if (!session?.token) {
      setAnalytics(null);
      setIsLoading(false);
      return;
    }

    if (refreshOnly) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      setAnalytics(
        await adminApi.getAnalyticsOverview(
          session.token,
          windowDays === "lifetime" ? undefined : windowDays,
        ),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load analytics");
    } finally {
      if (refreshOnly) {
        setIsRefreshing(false);
      } else {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadAnalytics();
  }, [session?.token, windowDays]);

  const selectedWindowLabel = analytics?.selectedWindowDays
    ? `Last ${analytics.selectedWindowDays} days`
    : "Lifetime";

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <SectionHeader
          title="Platform analytics"
          description="Trusted playback and engagement metrics across the whole catalog."
          action={
            <div className="flex flex-wrap gap-2">
              {adminAnalyticsWindowOptions.map((option) => (
                <Button
                  key={option.label}
                  type="button"
                  variant={windowDays === option.value ? "default" : "outline"}
                  className={
                    windowDays === option.value
                      ? "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                      : "border-white/10 bg-white/5 text-white hover:bg-white/10"
                  }
                  onClick={() => setWindowDays(option.value)}
                >
                  {option.label}
                </Button>
              ))}
              <Button
                type="button"
                variant="outline"
                className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                disabled={isRefreshing}
                onClick={() => void loadAnalytics(true)}
              >
                <RefreshCw
                  className={cn("mr-2 h-4 w-4", isRefreshing && "animate-spin")}
                />
                Refresh
              </Button>
            </div>
          }
        />

        {isLoading ? (
          <div className={cn(shellPanelClassName, "p-6 text-sm text-slate-400")}>
            Loading analytics...
          </div>
        ) : !analytics ? (
          <div className={cn(shellPanelClassName, "p-6 text-sm text-slate-400")}>
            Analytics are not available yet.
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <StatTile
                label={`${selectedWindowLabel} streams`}
                value={analytics.totalStreams.toLocaleString()}
              />
              <StatTile
                label="Active listeners"
                value={analytics.activeListeners.toLocaleString()}
              />
              <StatTile
                label="Release views"
                value={analytics.releaseViews.toLocaleString()}
              />
              <StatTile
                label="New follows"
                value={analytics.newFollows.toLocaleString()}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <StatTile
                label="Artists"
                value={analytics.totalArtists.toLocaleString()}
              />
              <StatTile
                label="Tracks"
                value={analytics.totalTracks.toLocaleString()}
              />
              <StatTile label="Window" value={selectedWindowLabel} />
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
              <section className={cn(shellPanelClassName, "p-5")}>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-emerald-300" />
                  <h3 className="text-sm font-semibold text-white">Top artists</h3>
                </div>
                <div className="mt-4 space-y-3">
                  {analytics.topArtists.length === 0 ? (
                    <p className="text-sm text-slate-400">No artist data yet.</p>
                  ) : (
                    analytics.topArtists.map((artist) => (
                      <div
                        key={artist.artistId}
                        className="flex items-center justify-between gap-3 border border-white/8 bg-[#0b1220] px-4 py-3"
                      >
                        <p className="truncate text-sm font-medium text-white">
                          {artist.artistName}
                        </p>
                        <p className="text-sm text-slate-300">
                          {artist.streams.toLocaleString()}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className={cn(shellPanelClassName, "p-5")}>
                <div className="flex items-center gap-2">
                  <Radio className="h-4 w-4 text-emerald-300" />
                  <h3 className="text-sm font-semibold text-white">Top tracks</h3>
                </div>
                <div className="mt-4 space-y-3">
                  {analytics.topTracks.length === 0 ? (
                    <p className="text-sm text-slate-400">No track data yet.</p>
                  ) : (
                    analytics.topTracks.map((track) => (
                      <div
                        key={track.trackId}
                        className="flex items-center justify-between gap-3 border border-white/8 bg-[#0b1220] px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-white">
                            {track.title}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {track.artistName}
                          </p>
                        </div>
                        <p className="text-sm text-slate-300">
                          {track.streams.toLocaleString()}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className={cn(shellPanelClassName, "p-5")}>
                <div className="flex items-center gap-2">
                  <Ticket className="h-4 w-4 text-emerald-300" />
                  <h3 className="text-sm font-semibold text-white">Top releases</h3>
                </div>
                <div className="mt-4 space-y-3">
                  {analytics.topReleases.length === 0 ? (
                    <p className="text-sm text-slate-400">No release data yet.</p>
                  ) : (
                    analytics.topReleases.map((release) => (
                      <div
                        key={release.releaseId}
                        className="flex items-center justify-between gap-3 border border-white/8 bg-[#0b1220] px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-white">
                            {release.title}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {release.artistName}
                          </p>
                        </div>
                        <p className="text-sm text-slate-300">
                          {release.streams.toLocaleString()}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </SidebarLayout>
  );
};

export const AppRoutes = () => {
  const { session, isLoading } = useAdminAuth();

  if (isLoading && session) {
    return <LoadingScreen label="Refreshing admin session..." />;
  }

  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate replace to={session?.token ? "/console" : "/auth"} />}
      />
      <Route
        path="/auth"
        element={session?.token ? <Navigate replace to="/console" /> : <AuthPage />}
      />
      <Route
        path="/console/analytics"
        element={
          <ProtectedRoute>
            <AdminAnalyticsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/console"
        element={
          <ProtectedRoute>
            <SubscriptionSettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/console/admins"
        element={
          <ProtectedRoute>
            <AdminManagementPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/console/subscribers"
        element={
          <ProtectedRoute>
            <SubscribersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/console/users"
        element={
          <ProtectedRoute>
            <UsersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/console/ads"
        element={
          <ProtectedRoute>
            <AdsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/console/royalties"
        element={
          <ProtectedRoute>
            <RoyaltiesPage />
          </ProtectedRoute>
        }
      />
      <Route path="/console/referrals" element={<ProtectedRoute><SidebarLayout><AdminReferralsPage /></SidebarLayout></ProtectedRoute>} />
      <Route path="/console/sponsorships" element={<ProtectedRoute><SidebarLayout><AdminSponsorshipsPage /></SidebarLayout></ProtectedRoute>} />
      <Route path="/console/support" element={<ProtectedRoute><SidebarLayout><AdminSupportPage /></SidebarLayout></ProtectedRoute>} />
      <Route path="/console/settlements" element={<ProtectedRoute><SidebarLayout><AdminSettlementsPage /></SidebarLayout></ProtectedRoute>} />
      <Route path="/console/agreements" element={<ProtectedRoute><SidebarLayout><AdminAgreementsPage /></SidebarLayout></ProtectedRoute>} />
      <Route path="/console/agreements/:agreementId" element={<ProtectedRoute><SidebarLayout><AdminAgreementsPage /></SidebarLayout></ProtectedRoute>} />
      <Route
        path="/console/treasury"
        element={
          <ProtectedRoute>
            <TreasuryPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate replace to="/" />} />
    </Routes>
  );
};
