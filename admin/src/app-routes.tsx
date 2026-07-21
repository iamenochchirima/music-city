import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import {
  BarChart3,
  CircleArrowOutUpRight,
  CreditCard,
  Eye,
  EyeOff,
  LayoutDashboard,
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
  AdminTreasuryTransferResult,
  RoyaltyLedgerEntry,
  RoyaltyEngineConfig,
  RoyaltyFeeSettings,
  RoyaltyPayoutExecutionResult,
  RoyaltyPayoutReconciliationResult,
  RoyaltyPayoutRecord,
  RoyaltyPayoutSettings,
  AdminPlatformSubscriptionSettings,
  AdminSubscriptionList,
  TrackRoyaltySplitRecord,
  TrackSummary,
  AdminUserList,
  AdminTreasuryOverview,
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
import { adminApi } from "@/features/auth/lib/admin-api";
import { useAdminAuth } from "@/features/auth/providers/admin-auth-provider";
import { cn } from "@/lib/utils";

const navItems = [
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
}: {
  id: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  autoComplete?: string;
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

const formatSharePercent = (bps: number) => `${(bps / 100).toFixed(2)}%`;

const stellarTransactionExplorerUrl = (txHash: string, network?: string) =>
  `https://stellar.expert/explorer/${network?.toLowerCase().includes("testnet") ? "testnet" : "public"}/tx/${txHash}`;

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

const formatAssetSummary = (
  items: Array<{
    amount: string;
    assetCode?: string;
    assetIssuer?: string;
  }>,
) => {
  const groups = summarizeAssetAmounts(items);

  if (groups.length === 0) {
    return "—";
  }

  if (groups.length === 1) {
    const group = groups[0]!;
    return formatAssetAmount(group.amount, group.assetCode);
  }

  return `${groups.length} assets`;
};

const statusBadgeClassName = (status: string) => {
  switch (status) {
    case "pending":
      return "border-amber-400/25 bg-amber-400/8 text-amber-200";
    case "approved":
    case "submitted":
      return "border-sky-400/25 bg-sky-400/8 text-sky-200";
    case "paid":
    case "confirmed":
      return "border-emerald-400/25 bg-emerald-400/8 text-emerald-200";
    case "failed":
    case "reversed":
    case "cancelled":
      return "border-rose-400/25 bg-rose-400/8 text-rose-200";
    default:
      return "border-white/10 text-slate-300";
  }
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

  return (
    <div className="min-h-screen bg-[#0a1120] text-slate-100">
      <div className="grid min-h-screen lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="border-b border-white/8 bg-[#0c1424] lg:border-b-0 lg:border-r">
          <div className="flex h-full flex-col">
            <div className="border-b border-white/8 px-5 py-5">
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
            </div>

            <nav className="flex-1 px-3 py-4">
              <div className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;

                  return (
                    <NavLink
                      key={item.href}
                      to={item.href}
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
        await bootstrapAdmin({ name, email, password });
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
                ? "Create the first admin account."
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

const TreasuryPage = () => {
  const { admin, session } = useAdminAuth();
  const [overview, setOverview] = useState<AdminTreasuryOverview | null>(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [transferAssetKey, setTransferAssetKey] = useState("native");
  const [transferRecipient, setTransferRecipient] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferMemo, setTransferMemo] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSendingTransfer, setIsSendingTransfer] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [lastTransfer, setLastTransfer] = useState<AdminTreasuryTransferResult | null>(null);

  const canManageTreasury = admin?.role === "super_admin";
  const balances = overview?.account?.balances ?? [];
  const selectedTransferBalance =
    balances.find((balance) => balance.assetKey === transferAssetKey) ?? balances[0] ?? null;

  const loadTreasury = async (refreshOnly = false) => {
    if (!session?.token) {
      return;
    }

    if (refreshOnly) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const next = await adminApi.getTreasury(session.token);
      const nextAccount = next.account;
      setOverview(next);
      setWalletAddress(next.settings.walletAddress);
      if (nextAccount?.balances.length) {
        setTransferAssetKey((current) =>
          nextAccount.balances.some((balance) => balance.assetKey === current)
            ? current
            : nextAccount.balances[0]!.assetKey,
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load treasury");
    } finally {
      if (refreshOnly) {
        setIsRefreshing(false);
      } else {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadTreasury();
  }, [session?.token]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session?.token) {
      return;
    }

    setIsSaving(true);

    try {
      const next = await adminApi.updateTreasury(
        { walletAddress },
        session.token,
      );
      setOverview(next);
      setWalletAddress(next.settings.walletAddress);
      toast.success("Treasury wallet updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update treasury");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTransfer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session?.token || !selectedTransferBalance) {
      return;
    }

    setIsSendingTransfer(true);

    try {
      const transfer = await adminApi.sendTreasuryTransfer(
        {
          recipientWalletAddress: transferRecipient.trim(),
          amount: transferAmount.trim(),
          assetCode: selectedTransferBalance.assetCode,
          assetIssuer: selectedTransferBalance.assetIssuer,
          memoText: transferMemo.trim() || undefined,
        },
        session.token,
      );

      setLastTransfer(transfer);
      setTransferRecipient("");
      setTransferAmount("");
      setTransferMemo("");
      setIsTransferModalOpen(false);
      toast.success("Treasury transfer submitted.");
      await loadTreasury(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit treasury transfer");
    } finally {
      setIsSendingTransfer(false);
    }
  };

  if (isLoading) {
    return (
      <PageLoadingShell
        title="Treasury wallet"
        description="Set the receiving Stellar account for purchases and subscriptions."
        stats={3}
        sidebar
      />
    );
  }

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <SectionHeader
          title="Treasury wallet"
          description="Set the receiving Stellar account for purchases and subscriptions."
          action={
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-md px-3"
              onClick={() => void loadTreasury(true)}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              Refresh
            </Button>
          }
        />

        <div className="grid gap-3 md:grid-cols-3">
          <StatTile
            label="Configured"
            value={overview?.settings.walletAddress ? "Yes" : "No"}
          />
          <StatTile
            label="Account state"
            value={
              overview?.account
                ? overview.account.exists
                  ? "Funded"
                  : "Unfunded"
                : "Unset"
            }
          />
          <StatTile
            label="Assets"
            value={overview?.account ? String(overview.account.balances.length) : "0"}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className={cn(shellPanelClassName, "p-5")}>
            <div className="mb-4 border-b border-white/8 pb-3">
              <h3 className="text-sm font-semibold text-white">Receiving account</h3>
              <p className="mt-1 text-sm text-slate-400">
                This wallet becomes the destination for new payment intents.
              </p>
            </div>

            {canManageTreasury ? (
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="treasury-wallet-address">Wallet address</Label>
                  <Input
                    id="treasury-wallet-address"
                    value={walletAddress}
                    onChange={(event) => setWalletAddress(event.target.value.trim())}
                    placeholder="G..."
                    className={fieldClassName}
                    required
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    type="submit"
                    className="h-10 rounded-md px-4"
                    disabled={isSaving}
                  >
                    {isSaving ? "Saving..." : "Save wallet"}
                  </Button>
                  <p className="text-sm text-slate-400">
                    New checkouts will use this address immediately.
                  </p>
                </div>
              </form>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Wallet address</Label>
                  <div className={cn(fieldClassName, "flex items-center break-all")}>
                    {overview?.settings.walletAddress || "No wallet configured"}
                  </div>
                </div>
                <p className="text-sm text-slate-400">
                  Only super admins can change the receiving account.
                </p>
              </div>
            )}
          </section>

          <aside className="space-y-4">
            <section className={cn(shellPanelClassName, "p-5")}>
              <h3 className="text-sm font-semibold text-white">Wallet status</h3>
              <div className="mt-4 space-y-3 text-sm">
                <div>
                  <p className="text-slate-500">Address</p>
                  <p className="mt-1 break-all text-slate-200">
                    {overview?.settings.walletAddress || "Not configured"}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Sequence</p>
                  <p className="mt-1 text-slate-200">
                    {overview?.account?.sequence || "Not available"}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Subentries</p>
                  <p className="mt-1 text-slate-200">
                    {overview?.account?.subentryCount ?? 0}
                  </p>
                </div>
              </div>
            </section>

            <section className={cn(shellPanelClassName, "p-5")}>
              <h3 className="text-sm font-semibold text-white">Last transfer</h3>
              {!lastTransfer ? (
                <p className="mt-3 text-sm text-slate-400">
                  No treasury transfer has been submitted in this console session.
                </p>
              ) : (
                <div className="mt-4 space-y-3 text-sm">
                  <div>
                    <p className="text-slate-500">Transaction hash</p>
                    <p className="mt-1 break-all text-slate-200">{lastTransfer.txHash}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Recipient</p>
                    <p className="mt-1 break-all text-slate-200">
                      {lastTransfer.recipientWalletAddress}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Amount</p>
                    <p className="mt-1 text-slate-200">
                      {formatBalanceAmount(lastTransfer.amount)} {lastTransfer.assetCode}
                    </p>
                  </div>
                  {lastTransfer.memoText ? (
                    <div>
                      <p className="text-slate-500">Memo</p>
                      <p className="mt-1 text-slate-200">{lastTransfer.memoText}</p>
                    </div>
                  ) : null}
                </div>
              )}
            </section>
          </aside>
        </div>

        <section className={cn(shellPanelClassName, "p-5")}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">Send from treasury</h3>
              <p className="mt-1 text-sm text-slate-400">
                Open a transfer modal to submit a real Stellar payment from the configured treasury wallet.
              </p>
            </div>
            <Button
              type="button"
              className="h-10 rounded-md px-4"
              disabled={
                !canManageTreasury ||
                !overview?.account?.exists ||
                balances.length === 0
              }
              onClick={() => setIsTransferModalOpen(true)}
            >
              <CircleArrowOutUpRight className="h-4 w-4" />
              Open transfer modal
            </Button>
          </div>
          {!canManageTreasury ? (
            <p className="mt-4 text-sm text-slate-400">
              Only super admins can submit treasury transfers.
            </p>
          ) : !overview?.account?.exists ? (
            <p className="mt-4 text-sm text-slate-400">
              Fund the treasury wallet before sending from it.
            </p>
          ) : balances.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">
              This treasury wallet has no transferable balances yet.
            </p>
          ) : null}
        </section>

        {isTransferModalOpen && canManageTreasury && overview?.account?.exists && balances.length > 0 ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/78 px-4 py-8 backdrop-blur-sm">
            <div className="w-full max-w-5xl border border-white/10 bg-[#121a2c] p-5 shadow-2xl">
              <div className="mb-4 flex items-start justify-between gap-4 border-b border-white/8 pb-3">
                <div>
                  <h3 className="text-lg font-semibold text-white">Send from treasury</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    Submit a real Stellar payment from the configured treasury wallet to verify the end-to-end platform path.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 rounded-md px-3 text-slate-300 hover:bg-white/[0.04]"
                  onClick={() => setIsTransferModalOpen(false)}
                  disabled={isSendingTransfer}
                >
                  Close
                </Button>
              </div>

              <form
                className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]"
                onSubmit={handleSendTransfer}
              >
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="treasury-transfer-asset">Asset</Label>
                      <select
                        id="treasury-transfer-asset"
                        value={transferAssetKey}
                        onChange={(event) => setTransferAssetKey(event.target.value)}
                        className={selectClassName}
                      >
                        {balances.map((balance) => (
                          <option key={balance.assetKey} value={balance.assetKey}>
                            {balance.assetCode} • {formatBalanceAmount(balance.availableAmount)} available
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="treasury-transfer-amount">Amount</Label>
                      <Input
                        id="treasury-transfer-amount"
                        value={transferAmount}
                        onChange={(event) => setTransferAmount(event.target.value)}
                        placeholder="0.0000000"
                        className={fieldClassName}
                        inputMode="decimal"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="treasury-transfer-recipient">Recipient wallet</Label>
                    <Input
                      id="treasury-transfer-recipient"
                      value={transferRecipient}
                      onChange={(event) => setTransferRecipient(event.target.value.trim())}
                      placeholder="G..."
                      className={fieldClassName}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="treasury-transfer-memo">Memo (optional)</Label>
                    <Input
                      id="treasury-transfer-memo"
                      value={transferMemo}
                      onChange={(event) => setTransferMemo(event.target.value)}
                      placeholder="Up to 28 characters"
                      className={fieldClassName}
                      maxLength={28}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      type="submit"
                      className="h-10 rounded-md px-4"
                      disabled={isSendingTransfer || !selectedTransferBalance}
                    >
                      {isSendingTransfer ? "Submitting..." : "Send treasury transfer"}
                    </Button>
                  </div>
                </div>

                <aside className="space-y-4 border border-white/8 bg-[#0b1220] p-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      Transfer preview
                    </p>
                    <p className="mt-2 text-base font-medium text-white">
                      {selectedTransferBalance
                        ? `${selectedTransferBalance.assetCode} from treasury`
                        : "No asset selected"}
                    </p>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-slate-500">Treasury address</p>
                      <p className="mt-1 break-all text-slate-200">
                        {overview?.settings.walletAddress || "Not configured"}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Available balance</p>
                      <p className="mt-1 text-slate-200">
                        {selectedTransferBalance
                          ? `${formatBalanceAmount(selectedTransferBalance.availableAmount)} ${selectedTransferBalance.assetCode}`
                          : "Not available"}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Issuer</p>
                      <p className="mt-1 break-all text-slate-200">
                        {selectedTransferBalance?.assetIssuer || "Native XLM"}
                      </p>
                    </div>
                  </div>
                </aside>
              </form>
            </div>
          </div>
        ) : null}

        <section className={cn(shellPanelClassName, "overflow-hidden")}>
          <div className="border-b border-white/8 px-4 py-3">
            <h3 className="text-sm font-semibold text-white">Balances</h3>
          </div>
          {!overview?.account ? (
            <div className="px-4 py-8 text-sm text-slate-400">
              Set a treasury wallet address to view balances.
            </div>
          ) : !overview.account.exists ? (
            <div className="px-4 py-8 text-sm text-slate-400">
              This Stellar account is not funded yet.
            </div>
          ) : overview.account.balances.length === 0 ? (
            <div className="px-4 py-8 text-sm text-slate-400">
              No balances found on this account.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[120px_1fr_1fr_120px] gap-4 border-b border-white/8 px-4 py-3 text-[0.68rem] uppercase tracking-[0.18em] text-slate-500">
                <span>Asset</span>
                <span>Total</span>
                <span>Available</span>
                <span>Issuer</span>
              </div>
              {overview.account.balances.map((balance) => (
                <div
                  key={balance.assetKey}
                  className="grid grid-cols-[120px_1fr_1fr_120px] gap-4 border-t border-white/6 px-4 py-4 text-sm"
                >
                  <span className="font-medium text-white">{balance.assetCode}</span>
                  <span className="text-slate-300">
                    {formatBalanceAmount(balance.amount)}
                  </span>
                  <span className="text-slate-300">
                    {formatBalanceAmount(balance.availableAmount)}
                  </span>
                  <span className="truncate text-slate-500">
                    {balance.assetIssuer
                      ? `${balance.assetIssuer.slice(0, 6)}...${balance.assetIssuer.slice(-4)}`
                      : "Native"}
                  </span>
                </div>
              ))}
            </>
          )}
        </section>
      </div>
    </SidebarLayout>
  );
};

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
          <StatTile label="Fans" value={String(data?.summary.fans ?? 0)} />
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
                    {item.role}
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

type EditableRoyaltyRecipient = {
  walletAddress: string;
  chain: "stellar" | "evm" | "solana" | "manual";
  role:
    | "artist"
    | "producer"
    | "writer"
    | "featured_artist"
    | "label"
    | "platform"
    | "other";
  shareBps: string;
};

const royaltySourceTypeOptions = [
  "track_purchase",
  "platform_subscription",
  "ad_revenue",
  "manual_adjustment",
] as const;

const RoyaltiesPage = () => {
  const { session } = useAdminAuth();
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [config, setConfig] = useState<RoyaltyEngineConfig | null>(null);
  const [payoutSettings, setPayoutSettings] = useState<RoyaltyPayoutSettings | null>(null);
  const [feeSettings, setFeeSettings] = useState<RoyaltyFeeSettings | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [globalLedgerEntries, setGlobalLedgerEntries] = useState<RoyaltyLedgerEntry[]>([]);
  const [payoutHistory, setPayoutHistory] = useState<RoyaltyPayoutRecord[]>([]);
  const [splitHistory, setSplitHistory] = useState<TrackRoyaltySplitRecord[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<RoyaltyLedgerEntry[]>([]);
  const [draftRecipients, setDraftRecipients] = useState<EditableRoyaltyRecipient[]>([]);
  const [draftNotes, setDraftNotes] = useState("");
  const [ledgerStatusFilter, setLedgerStatusFilter] = useState<
    RoyaltyLedgerEntry["status"] | "all"
  >("pending");
  const [ledgerSourceFilter, setLedgerSourceFilter] = useState<
    RoyaltyLedgerEntry["sourceType"] | "all"
  >("all");
  const [ledgerRecipientFilter, setLedgerRecipientFilter] = useState("");
  const [selectedLedgerEntryIds, setSelectedLedgerEntryIds] = useState<string[]>([]);
  const [payoutStatusFilter, setPayoutStatusFilter] = useState<
    RoyaltyPayoutRecord["status"] | "all"
  >("all");
  const [payoutRecipientFilter, setPayoutRecipientFilter] = useState("");
  const [runRecipientWalletAddress, setRunRecipientWalletAddress] = useState("");
  const [maxPayoutEntries, setMaxPayoutEntries] = useState("100");
  const [lastExecutionResult, setLastExecutionResult] =
    useState<RoyaltyPayoutExecutionResult | null>(null);
  const [lastReconciliationResult, setLastReconciliationResult] =
    useState<RoyaltyPayoutReconciliationResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorkspaceRefreshing, setIsWorkspaceRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingPayoutSettings, setIsSavingPayoutSettings] = useState(false);
  const [isSavingFeeSettings, setIsSavingFeeSettings] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isDryRunning, setIsDryRunning] = useState(false);
  const [isRunningPayouts, setIsRunningPayouts] = useState(false);
  const [isReconcilingPayouts, setIsReconcilingPayouts] = useState(false);
  const [isSplitLoading, setIsSplitLoading] = useState(false);
  const [isPublishingSplit, setIsPublishingSplit] = useState(false);
  const [isVerifyingSplit, setIsVerifyingSplit] = useState(false);

  const fetchRoyaltyWorkspace = async (token: string) => {
    const [
      nextGlobalLedgerEntries,
      nextPayoutHistory,
      nextPayoutSettings,
      nextFeeSettings,
    ] = await Promise.all([
      adminApi.listRoyaltyLedger(token),
      adminApi.listRoyaltyPayouts(token),
      adminApi.getRoyaltyPayoutSettings(token),
      adminApi.getRoyaltyFeeSettings(token),
    ]);

    return {
      nextGlobalLedgerEntries,
      nextPayoutHistory,
      nextPayoutSettings,
      nextFeeSettings,
    };
  };

  const fetchTrackRoyaltyContext = async (trackId: string, token: string) => {
    const [response, nextLedgerEntries] = await Promise.all([
      adminApi.listTrackRoyaltySplits(trackId, token),
      adminApi.listTrackRoyaltyLedger(trackId, token),
    ]);

    return {
      nextSplitHistory: response.items,
      nextLedgerEntries,
    };
  };

  const filteredTracks = useMemo(() => {
    const normalized = search.trim().toLowerCase();

    if (!normalized) {
      return tracks;
    }

    return tracks.filter((track) =>
      [track.title, track.artistName, track.id]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [search, tracks]);

  const selectedTrack = useMemo(
    () => tracks.find((track) => track.id === selectedTrackId) ?? null,
    [selectedTrackId, tracks],
  );
  const activeSplit = useMemo(
    () => splitHistory.find((split) => split.status === "active") ?? splitHistory[0] ?? null,
    [splitHistory],
  );
  const totalDraftBps = useMemo(
    () =>
      draftRecipients.reduce(
        (sum, recipient) => sum + (Number.parseInt(recipient.shareBps, 10) || 0),
        0,
      ),
    [draftRecipients],
  );
  const filteredGlobalLedgerEntries = useMemo(() => {
    const normalizedRecipient = ledgerRecipientFilter.trim().toLowerCase();

    return globalLedgerEntries.filter((entry) => {
      if (ledgerStatusFilter !== "all" && entry.status !== ledgerStatusFilter) {
        return false;
      }

      if (ledgerSourceFilter !== "all" && entry.sourceType !== ledgerSourceFilter) {
        return false;
      }

      if (
        normalizedRecipient &&
        ![
          entry.recipientWalletAddress,
          entry.trackId,
          entry.sourceId,
          entry.assetCode ?? "XLM",
        ]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(normalizedRecipient))
      ) {
        return false;
      }

      return true;
    });
  }, [
    globalLedgerEntries,
    ledgerRecipientFilter,
    ledgerSourceFilter,
    ledgerStatusFilter,
  ]);
  const filteredPayoutHistory = useMemo(() => {
    const normalizedRecipient = payoutRecipientFilter.trim().toLowerCase();

    return payoutHistory.filter((payout) => {
      if (payoutStatusFilter !== "all" && payout.status !== payoutStatusFilter) {
        return false;
      }

      if (
        normalizedRecipient &&
        ![
          payout.recipientWalletAddress,
          payout.txHash ?? "",
          payout.id,
          payout.assetCode ?? "XLM",
        ]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(normalizedRecipient))
      ) {
        return false;
      }

      return true;
    });
  }, [payoutHistory, payoutRecipientFilter, payoutStatusFilter]);
  const selectedPendingEntries = useMemo(
    () =>
      globalLedgerEntries.filter(
        (entry) =>
          selectedLedgerEntryIds.includes(entry.id) && entry.status === "pending",
      ),
    [globalLedgerEntries, selectedLedgerEntryIds],
  );
  const visiblePendingEntryIds = useMemo(
    () =>
      filteredGlobalLedgerEntries
        .filter((entry) => entry.status === "pending")
        .map((entry) => entry.id),
    [filteredGlobalLedgerEntries],
  );
  const pendingEntries = useMemo(
    () => globalLedgerEntries.filter((entry) => entry.status === "pending"),
    [globalLedgerEntries],
  );
  const approvedEntries = useMemo(
    () => globalLedgerEntries.filter((entry) => entry.status === "approved"),
    [globalLedgerEntries],
  );
  const paidEntries = useMemo(
    () => globalLedgerEntries.filter((entry) => entry.status === "paid"),
    [globalLedgerEntries],
  );
  const failedPayouts = useMemo(
    () => payoutHistory.filter((payout) => payout.status === "failed"),
    [payoutHistory],
  );
  const submittedPayouts = useMemo(
    () => payoutHistory.filter((payout) => payout.status === "submitted"),
    [payoutHistory],
  );
  const payoutReadyRecipientCount = useMemo(
    () => new Set(approvedEntries.map((entry) => entry.recipientWalletAddress.toLowerCase())).size,
    [approvedEntries],
  );

  const syncDraftFromSplit = (split: TrackRoyaltySplitRecord | null) => {
    if (!split) {
      setDraftRecipients([
        {
          walletAddress: "",
          chain: "stellar",
          role: "artist",
          shareBps: "10000",
        },
      ]);
      setDraftNotes("");
      return;
    }

    setDraftRecipients(
      split.recipients.map((recipient) => ({
        walletAddress: recipient.walletAddress,
        chain: recipient.chain,
        role: recipient.role,
        shareBps: String(recipient.shareBps),
      })),
    );
    setDraftNotes(split.notes ?? "");
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!session?.token) {
        return;
      }

      setIsLoading(true);

      try {
        const [
          nextTracks,
          nextConfig,
          {
            nextGlobalLedgerEntries,
            nextPayoutHistory,
            nextPayoutSettings,
            nextFeeSettings,
          },
        ] = await Promise.all([
          adminApi.listTracks(session.token),
          adminApi.getRoyaltyConfig(session.token),
          fetchRoyaltyWorkspace(session.token),
        ]);

        if (!cancelled) {
          setTracks(nextTracks);
          setConfig(nextConfig);
          setGlobalLedgerEntries(nextGlobalLedgerEntries);
          setPayoutHistory(nextPayoutHistory);
          setPayoutSettings(nextPayoutSettings);
          setFeeSettings(nextFeeSettings);
          setSelectedTrackId((current) => current ?? nextTracks[0]?.id ?? null);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error ? error.message : "Failed to load royalties",
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

  useEffect(() => {
    let cancelled = false;

    const loadSplits = async () => {
      if (!session?.token || !selectedTrackId) {
        setSplitHistory([]);
        setLedgerEntries([]);
        syncDraftFromSplit(null);
        return;
      }

      setIsSplitLoading(true);

      try {
        const { nextSplitHistory, nextLedgerEntries } =
          await fetchTrackRoyaltyContext(selectedTrackId, session.token);

        if (!cancelled) {
          setSplitHistory(nextSplitHistory);
          setLedgerEntries(nextLedgerEntries);
          syncDraftFromSplit(
            nextSplitHistory.find((split) => split.status === "active") ??
              nextSplitHistory[0] ??
              null,
          );
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error ? error.message : "Failed to load royalty splits",
          );
        }
      } finally {
        if (!cancelled) {
          setIsSplitLoading(false);
        }
      }
    };

    void loadSplits();

    return () => {
      cancelled = true;
    };
  }, [selectedTrackId, session?.token]);

  if (isLoading) {
    return (
      <PageLoadingShell
        title="Royalties"
        description="Manage canonical track split ownership with Stellar as the primary registry path."
        stats={4}
      />
    );
  }

  const updateRecipient = (
    index: number,
    patch: Partial<EditableRoyaltyRecipient>,
  ) => {
    setDraftRecipients((current) =>
      current.map((recipient, recipientIndex) =>
        recipientIndex === index ? { ...recipient, ...patch } : recipient,
      ),
    );
  };

  const addRecipient = () => {
    setDraftRecipients((current) => [
      ...current,
      {
        walletAddress: "",
        chain: "stellar",
        role: "other",
        shareBps: "0",
      },
    ]);
  };

  const removeRecipient = (index: number) => {
    setDraftRecipients((current) =>
      current.length === 1
        ? current
        : current.filter((_, recipientIndex) => recipientIndex !== index),
    );
  };

  const refreshWorkspace = async (token: string) => {
    setIsWorkspaceRefreshing(true);

    try {
      const {
        nextGlobalLedgerEntries,
        nextPayoutHistory,
        nextPayoutSettings,
        nextFeeSettings,
      } =
        await fetchRoyaltyWorkspace(token);
      setGlobalLedgerEntries(nextGlobalLedgerEntries);
      setPayoutHistory(nextPayoutHistory);
      setPayoutSettings(nextPayoutSettings);
      setFeeSettings(nextFeeSettings);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to refresh royalty workspace",
      );
    } finally {
      setIsWorkspaceRefreshing(false);
    }
  };

  const refreshSelectedTrack = async (trackId: string, token: string) => {
    setIsSplitLoading(true);

    try {
      const { nextSplitHistory, nextLedgerEntries } = await fetchTrackRoyaltyContext(
        trackId,
        token,
      );
      setSplitHistory(nextSplitHistory);
      setLedgerEntries(nextLedgerEntries);
      syncDraftFromSplit(
        nextSplitHistory.find((split) => split.status === "active") ??
          nextSplitHistory[0] ??
          null,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to refresh selected track royalties",
      );
    } finally {
      setIsSplitLoading(false);
    }
  };

  const refreshAfterMutation = async () => {
    if (!session?.token) {
      return;
    }

    await Promise.all([
      refreshWorkspace(session.token),
      selectedTrackId ? refreshSelectedTrack(selectedTrackId, session.token) : Promise.resolve(),
    ]);
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session?.token || !selectedTrackId) {
      return;
    }

    try {
      setIsSaving(true);

      await adminApi.updateTrackRoyaltySplits(
        selectedTrackId,
        {
          recipients: draftRecipients.map((recipient) => ({
            walletAddress: recipient.walletAddress.trim(),
            chain: recipient.chain,
            role: recipient.role,
            shareBps: Number.parseInt(recipient.shareBps, 10) || 0,
          })),
          notes: draftNotes.trim() || undefined,
          activate: true,
        },
        session.token,
      );

      toast.success("Royalty split updated.");
      await refreshSelectedTrack(selectedTrackId, session.token);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save royalty split",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublishSplit = async () => {
    if (!session?.token || !selectedTrackId || !activeSplit) {
      return;
    }

    try {
      setIsPublishingSplit(true);
      const result = await adminApi.publishTrackRoyaltySplit(
        selectedTrackId,
        session.token,
      );
      toast.success(`Published split v${result.split.version} to Soroban.`);
      await refreshSelectedTrack(selectedTrackId, session.token);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to publish split to Soroban",
      );
    } finally {
      setIsPublishingSplit(false);
    }
  };

  const handleVerifySplit = async () => {
    if (!session?.token || !selectedTrackId || !activeSplit) {
      return;
    }

    try {
      setIsVerifyingSplit(true);
      const result = await adminApi.verifyTrackRoyaltySplit(
        selectedTrackId,
        session.token,
      );
      if (result.matches) {
        toast.success(`Split v${result.split.version} matches Soroban.`);
      } else {
        toast.error(result.differences.join(" "));
      }
      await refreshSelectedTrack(selectedTrackId, session.token);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to verify the Soroban split",
      );
    } finally {
      setIsVerifyingSplit(false);
    }
  };

  const toggleLedgerSelection = (entryId: string) => {
    setSelectedLedgerEntryIds((current) =>
      current.includes(entryId)
        ? current.filter((candidateId) => candidateId !== entryId)
        : [...current, entryId],
    );
  };

  const handleApproveSelected = async () => {
    if (!session?.token || selectedPendingEntries.length === 0) {
      return;
    }

    try {
      setIsApproving(true);
      await adminApi.approveRoyaltyLedgerEntries(
        {
          entryIds: selectedPendingEntries.map((entry) => entry.id),
        },
        session.token,
      );
      setSelectedLedgerEntryIds([]);
      setLastExecutionResult(null);
      toast.success(`Approved ${selectedPendingEntries.length} royalty entries.`);
      await refreshAfterMutation();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to approve royalty entries",
      );
    } finally {
      setIsApproving(false);
    }
  };

  const handleRunPayouts = async (dryRun: boolean) => {
    if (!session?.token) {
      return;
    }

    const parsedMaxEntries = Math.min(
      500,
      Math.max(1, Number.parseInt(maxPayoutEntries, 10) || 100),
    );
    const nextInput = {
      recipientWalletAddress: runRecipientWalletAddress.trim() || undefined,
      maxEntries: parsedMaxEntries,
      dryRun,
    };

    try {
      if (dryRun) {
        setIsDryRunning(true);
      } else {
        setIsRunningPayouts(true);
      }

      const result = await adminApi.runRoyaltyPayouts(nextInput, session.token);
      setLastExecutionResult(result);

      if (dryRun) {
        toast.success(
          result.items.length === 0
            ? "Dry run found no approved payouts."
            : `Dry run prepared ${result.items.length} payout batch${result.items.length === 1 ? "" : "es"}.`,
        );
      } else {
        toast.success(
          result.items.length === 0
            ? "No approved payouts were available to run."
            : `Processed ${result.items.length} payout batch${result.items.length === 1 ? "" : "es"}.`,
        );
        setSelectedLedgerEntryIds([]);
        await refreshAfterMutation();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to run payouts");
    } finally {
      if (dryRun) {
        setIsDryRunning(false);
      } else {
        setIsRunningPayouts(false);
      }
    }
  };

  const handleSavePayoutSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session?.token || !payoutSettings) {
      return;
    }

    try {
      setIsSavingPayoutSettings(true);
      const nextSettings = await adminApi.updateRoyaltyPayoutSettings(
        payoutSettings,
        session.token,
      );
      setPayoutSettings(nextSettings);
      toast.success("Payout policy updated.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save payout policy",
      );
    } finally {
      setIsSavingPayoutSettings(false);
    }
  };

  const handleSaveFeeSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session?.token || !feeSettings) {
      return;
    }

    try {
      setIsSavingFeeSettings(true);
      const nextSettings = await adminApi.updateRoyaltyFeeSettings(
        feeSettings,
        session.token,
      );
      setFeeSettings(nextSettings);
      toast.success("Fee policy updated.");
      await refreshAfterMutation();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save fee policy");
    } finally {
      setIsSavingFeeSettings(false);
    }
  };

  const handleReconcileSubmitted = async () => {
    if (!session?.token) {
      return;
    }

    try {
      setIsReconcilingPayouts(true);
      const result = await adminApi.reconcileRoyaltyPayouts(
        {
          submittedOnly: true,
          maxItems: Math.min(500, Number.parseInt(maxPayoutEntries, 10) || 100),
        },
        session.token,
      );
      setLastReconciliationResult(result);
      toast.success(
        result.items.length === 0
          ? "No submitted payouts were available to reconcile."
          : `Reconciled ${result.items.length} payout batch${result.items.length === 1 ? "" : "es"}.`,
      );
      await refreshAfterMutation();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to reconcile submitted payouts",
      );
    } finally {
      setIsReconcilingPayouts(false);
    }
  };

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <SectionHeader
          title="Royalties"
          description="Review payout-ready earnings, run treasury settlement, and maintain the split registry."
          action={
            <Button
              type="button"
              variant="ghost"
              className="border border-white/8 text-slate-300 hover:bg-white/[0.04]"
              onClick={() => {
                if (!session?.token) {
                  return;
                }

                void refreshWorkspace(session.token);
              }}
              disabled={isWorkspaceRefreshing}
            >
              <RefreshCw
                className={cn("mr-2 h-4 w-4", isWorkspaceRefreshing && "animate-spin")}
              />
              Refresh workspace
            </Button>
          }
        />

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <StatTile
            label="Primary chain"
            value={config?.primaryChain?.toUpperCase() ?? "—"}
          />
          <StatTile label="Network" value={config?.primaryNetwork ?? "—"} />
          <StatTile label="Registry" value={config?.registryKind ?? "offchain"} />
          <StatTile label="Pending volume" value={formatAssetSummary(
            pendingEntries.map((entry) => ({
              amount: entry.netAmount,
              assetCode: entry.assetCode,
              assetIssuer: entry.assetIssuer,
            })),
          )} />
          <StatTile
            label="Approved recipients"
            value={String(payoutReadyRecipientCount)}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.95fr)]">
          <section className={cn(shellPanelClassName, "overflow-hidden")}>
            <div className="border-b border-white/8 px-5 py-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Payout queue</h3>
                  <p className="text-sm text-slate-400">
                    Approve pending ledger entries and inspect payout-ready balances before settlement.
                  </p>
                </div>
                <div className="text-sm text-slate-400">
                  {selectedPendingEntries.length} selected • {visiblePendingEntryIds.length} visible pending
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-[140px_190px_minmax(0,1fr)]">
                <select
                  value={ledgerStatusFilter}
                  onChange={(event) =>
                    setLedgerStatusFilter(
                      event.target.value as RoyaltyLedgerEntry["status"] | "all",
                    )
                  }
                  className={selectClassName}
                >
                  <option value="all">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="paid">Paid</option>
                  <option value="reversed">Reversed</option>
                </select>
                <select
                  value={ledgerSourceFilter}
                  onChange={(event) =>
                    setLedgerSourceFilter(
                      event.target.value as RoyaltyLedgerEntry["sourceType"] | "all",
                    )
                  }
                  className={selectClassName}
                >
                  <option value="all">All sources</option>
                  {royaltySourceTypeOptions.map((sourceType) => (
                    <option key={sourceType} value={sourceType}>
                      {sourceType}
                    </option>
                  ))}
                </select>
                <Input
                  value={ledgerRecipientFilter}
                  onChange={(event) => setLedgerRecipientFilter(event.target.value)}
                  placeholder="Filter by recipient, asset, track, or source id"
                  className={fieldClassName}
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  className="border border-white/8 text-slate-300 hover:bg-white/[0.04]"
                  onClick={() => setSelectedLedgerEntryIds(visiblePendingEntryIds)}
                  disabled={visiblePendingEntryIds.length === 0}
                >
                  Select visible pending
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="border border-white/8 text-slate-300 hover:bg-white/[0.04]"
                  onClick={() => setSelectedLedgerEntryIds([])}
                  disabled={selectedLedgerEntryIds.length === 0}
                >
                  Clear selection
                </Button>
                <Button
                  type="button"
                  className="h-10 rounded-md"
                  onClick={() => void handleApproveSelected()}
                  disabled={isApproving || selectedPendingEntries.length === 0}
                >
                  {isApproving
                    ? "Approving..."
                    : `Approve selected (${selectedPendingEntries.length})`}
                </Button>
              </div>
            </div>

            {filteredGlobalLedgerEntries.length === 0 ? (
              <div className="px-5 py-10">
                <EmptyState
                  title="No ledger entries match these filters"
                  description="Adjust the queue filters or wait for new royalty earnings to be recorded."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="grid min-w-[920px] grid-cols-[52px_minmax(0,1.1fr)_160px_140px_120px_170px] gap-4 border-b border-white/8 px-4 py-3 text-[0.68rem] uppercase tracking-[0.18em] text-slate-500">
                  <span>Select</span>
                  <span>Recipient</span>
                  <span>Source</span>
                  <span>Amount</span>
                  <span>Status</span>
                  <span>Created</span>
                </div>
                {filteredGlobalLedgerEntries.map((entry) => {
                  const isPending = entry.status === "pending";
                  const isSelected = selectedLedgerEntryIds.includes(entry.id);

                  return (
                    <div
                      key={entry.id}
                      className={cn(
                        "grid min-w-[920px] grid-cols-[52px_minmax(0,1.1fr)_160px_140px_120px_170px] gap-4 border-t border-white/6 px-4 py-4 text-sm transition",
                        isSelected && "bg-white/[0.03]",
                      )}
                    >
                      <div className="pt-0.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={!isPending}
                          onChange={() => toggleLedgerSelection(entry.id)}
                          className="h-4 w-4 rounded border-white/15 bg-[#0b1220] accent-emerald-400"
                          aria-label={`Select royalty ledger entry ${entry.id}`}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-white">
                          {entry.recipientWalletAddress}
                        </p>
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {entry.recipientRole} • {entry.recipientChain} • {entry.trackId}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-slate-300">{entry.sourceType}</p>
                        <p className="mt-1 truncate text-xs text-slate-500">{entry.sourceId}</p>
                      </div>
                      <div className="text-slate-300">
                        {formatAssetAmount(entry.netAmount, entry.assetCode)}
                      </div>
                      <div>
                        <span
                          className={cn(
                            "inline-flex border px-2 py-1 text-xs",
                            statusBadgeClassName(entry.status),
                          )}
                        >
                          {entry.status}
                        </span>
                      </div>
                      <div className="text-slate-300">{formatDateTime(entry.createdAt)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <div className="space-y-6">
            <section className={cn(shellPanelClassName, "p-5")}>
              <div className="grid gap-6 xl:grid-cols-2">
                <form className="space-y-4" onSubmit={handleSavePayoutSettings}>
                  <div className="border-b border-white/8 pb-4">
                    <h3 className="text-sm font-semibold text-white">Payout policy</h3>
                    <p className="mt-1 text-sm text-slate-400">
                      Control approval mode, payout cadence, thresholding, retries, and reconciliation behavior.
                    </p>
                  </div>
                  {payoutSettings ? (
                    <>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="payout-approval-mode">Approval mode</Label>
                          <select
                            id="payout-approval-mode"
                            value={payoutSettings.approvalMode}
                            onChange={(event) =>
                              setPayoutSettings((current) =>
                                current
                                  ? {
                                      ...current,
                                      approvalMode: event.target.value as RoyaltyPayoutSettings["approvalMode"],
                                    }
                                  : current,
                              )
                            }
                            className={selectClassName}
                          >
                            <option value="admin">admin</option>
                            <option value="automatic">automatic</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="payout-cadence">Cadence</Label>
                          <select
                            id="payout-cadence"
                            value={payoutSettings.cadence}
                            onChange={(event) =>
                              setPayoutSettings((current) =>
                                current
                                  ? {
                                      ...current,
                                      cadence: event.target.value as RoyaltyPayoutSettings["cadence"],
                                    }
                                  : current,
                              )
                            }
                            className={selectClassName}
                          >
                            <option value="manual">manual</option>
                            <option value="daily">daily</option>
                            <option value="weekly">weekly</option>
                            <option value="monthly">monthly</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="payout-minimum-amount">Minimum payout amount</Label>
                          <Input
                            id="payout-minimum-amount"
                            value={payoutSettings.minimumPayoutAmount}
                            onChange={(event) =>
                              setPayoutSettings((current) =>
                                current
                                  ? { ...current, minimumPayoutAmount: event.target.value }
                                  : current,
                              )
                            }
                            className={fieldClassName}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="payout-shortfall-behavior">Shortfall behavior</Label>
                          <select
                            id="payout-shortfall-behavior"
                            value={payoutSettings.shortfallBehavior}
                            onChange={(event) =>
                              setPayoutSettings((current) =>
                                current
                                  ? {
                                      ...current,
                                      shortfallBehavior: event.target.value as RoyaltyPayoutSettings["shortfallBehavior"],
                                    }
                                  : current,
                              )
                            }
                            className={selectClassName}
                          >
                            <option value="block_all">block_all</option>
                            <option value="allow_partial_batches">allow_partial_batches</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid gap-3">
                        <label className="flex items-center gap-3 text-sm text-slate-300">
                          <input
                            type="checkbox"
                            checked={payoutSettings.retryFailedPayouts}
                            onChange={(event) =>
                              setPayoutSettings((current) =>
                                current
                                  ? { ...current, retryFailedPayouts: event.target.checked }
                                  : current,
                              )
                            }
                            className="h-4 w-4 rounded border-white/15 bg-[#0b1220] accent-emerald-400"
                          />
                          Retry failed payouts automatically on later runs
                        </label>
                        <label className="flex items-center gap-3 text-sm text-slate-300">
                          <input
                            type="checkbox"
                            checked={payoutSettings.automaticApproval}
                            onChange={(event) =>
                              setPayoutSettings((current) =>
                                current
                                  ? { ...current, automaticApproval: event.target.checked }
                                  : current,
                              )
                            }
                            className="h-4 w-4 rounded border-white/15 bg-[#0b1220] accent-emerald-400"
                          />
                          Approve new ledger entries automatically
                        </label>
                        <label className="flex items-center gap-3 text-sm text-slate-300">
                          <input
                            type="checkbox"
                            checked={payoutSettings.confirmBeforeMarkPaid}
                            onChange={(event) =>
                              setPayoutSettings((current) =>
                                current
                                  ? { ...current, confirmBeforeMarkPaid: event.target.checked }
                                  : current,
                              )
                            }
                            className="h-4 w-4 rounded border-white/15 bg-[#0b1220] accent-emerald-400"
                          />
                          Keep payouts submitted until reconciliation confirms settlement
                        </label>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="payout-reversal-policy">Failure / reversal policy</Label>
                        <textarea
                          id="payout-reversal-policy"
                          value={payoutSettings.reversalPolicy}
                          onChange={(event) =>
                            setPayoutSettings((current) =>
                              current
                                ? { ...current, reversalPolicy: event.target.value }
                                : current,
                            )
                          }
                          className={cn(fieldClassName, "min-h-[96px] py-3")}
                        />
                      </div>
                      <Button
                        type="submit"
                        className="h-10 rounded-md"
                        disabled={isSavingPayoutSettings}
                      >
                        {isSavingPayoutSettings ? "Saving policy..." : "Save payout policy"}
                      </Button>
                    </>
                  ) : null}
                </form>

                <form className="space-y-4" onSubmit={handleSaveFeeSettings}>
                  <div className="border-b border-white/8 pb-4">
                    <h3 className="text-sm font-semibold text-white">Fee policy</h3>
                    <p className="mt-1 text-sm text-slate-400">
                      Configure deterministic platform fee basis points per royalty source before distribution.
                    </p>
                  </div>
                  {feeSettings ? (
                    <>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="fee-track-purchase">Track purchase fee bps</Label>
                          <Input
                            id="fee-track-purchase"
                            value={String(feeSettings.trackPurchaseFeeBps)}
                            onChange={(event) =>
                              setFeeSettings((current) =>
                                current
                                  ? {
                                      ...current,
                                      trackPurchaseFeeBps:
                                        Number.parseInt(event.target.value, 10) || 0,
                                    }
                                  : current,
                              )
                            }
                            inputMode="numeric"
                            className={fieldClassName}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="fee-platform-subscription">
                            Platform subscription fee bps
                          </Label>
                          <Input
                            id="fee-platform-subscription"
                            value={String(feeSettings.platformSubscriptionFeeBps)}
                            onChange={(event) =>
                              setFeeSettings((current) =>
                                current
                                  ? {
                                      ...current,
                                      platformSubscriptionFeeBps:
                                        Number.parseInt(event.target.value, 10) || 0,
                                    }
                                  : current,
                              )
                            }
                            inputMode="numeric"
                            className={fieldClassName}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="fee-ad-revenue">Ad revenue fee bps</Label>
                          <Input
                            id="fee-ad-revenue"
                            value={String(feeSettings.adRevenueFeeBps)}
                            onChange={(event) =>
                              setFeeSettings((current) =>
                                current
                                  ? {
                                      ...current,
                                      adRevenueFeeBps:
                                        Number.parseInt(event.target.value, 10) || 0,
                                    }
                                  : current,
                              )
                            }
                            inputMode="numeric"
                            className={fieldClassName}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="fee-manual-adjustment">Manual adjustment fee bps</Label>
                          <Input
                            id="fee-manual-adjustment"
                            value={String(feeSettings.manualAdjustmentFeeBps)}
                            onChange={(event) =>
                              setFeeSettings((current) =>
                                current
                                  ? {
                                      ...current,
                                      manualAdjustmentFeeBps:
                                        Number.parseInt(event.target.value, 10) || 0,
                                    }
                                  : current,
                              )
                            }
                            inputMode="numeric"
                            className={fieldClassName}
                          />
                        </div>
                      </div>
                      <Button
                        type="submit"
                        className="h-10 rounded-md"
                        disabled={isSavingFeeSettings}
                      >
                        {isSavingFeeSettings ? "Saving fees..." : "Save fee policy"}
                      </Button>
                    </>
                  ) : null}
                </form>
              </div>
            </section>

            <section className={cn(shellPanelClassName, "p-5")}>
              <div className="flex flex-col gap-3 border-b border-white/8 pb-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">Payout run</h3>
                  <p className="text-sm text-slate-400">
                    Preview or execute payout batches from approved earnings. Leave the wallet blank to process all approved recipients.
                  </p>
                </div>
                <div className="grid gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="payout-run-recipient">Recipient wallet</Label>
                    <Input
                      id="payout-run-recipient"
                      value={runRecipientWalletAddress}
                      onChange={(event) => setRunRecipientWalletAddress(event.target.value)}
                      placeholder="Optional exact Stellar wallet"
                      className={fieldClassName}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payout-run-max-entries">Max approved ledger entries</Label>
                    <Input
                      id="payout-run-max-entries"
                      value={maxPayoutEntries}
                      onChange={(event) => setMaxPayoutEntries(event.target.value)}
                      inputMode="numeric"
                      className={fieldClassName}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    className="border border-white/8 text-slate-300 hover:bg-white/[0.04]"
                    onClick={() => void handleRunPayouts(true)}
                    disabled={isDryRunning || isRunningPayouts}
                  >
                    {isDryRunning ? "Preparing preview..." : "Dry run payout batch"}
                  </Button>
                  <Button
                    type="button"
                    className="h-10 rounded-md"
                    onClick={() => void handleRunPayouts(false)}
                    disabled={isRunningPayouts || isDryRunning}
                  >
                    {isRunningPayouts ? "Running payouts..." : "Run payouts now"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="border border-white/8 text-slate-300 hover:bg-white/[0.04]"
                    onClick={() => void handleReconcileSubmitted()}
                    disabled={isReconcilingPayouts}
                  >
                    {isReconcilingPayouts
                      ? "Reconciling..."
                      : `Reconcile submitted (${submittedPayouts.length})`}
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <StatTile label="Approved volume" value={formatAssetSummary(
                  approvedEntries.map((entry) => ({
                    amount: entry.netAmount,
                    assetCode: entry.assetCode,
                    assetIssuer: entry.assetIssuer,
                  })),
                )} />
                <StatTile label="Paid volume" value={formatAssetSummary(
                  paidEntries.map((entry) => ({
                    amount: entry.netAmount,
                    assetCode: entry.assetCode,
                    assetIssuer: entry.assetIssuer,
                  })),
                )} />
                <StatTile label="Pending entries" value={String(pendingEntries.length)} />
                <StatTile label="Failed payouts" value={String(failedPayouts.length)} />
                <StatTile label="Submitted payouts" value={String(submittedPayouts.length)} />
                <StatTile
                  label="Min threshold"
                  value={payoutSettings?.minimumPayoutAmount ?? "—"}
                />
              </div>

              <div className="mt-4 border border-white/8 bg-[#0b1220] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-medium text-white">Last execution</h4>
                    <p className="text-sm text-slate-400">
                      Latest preview or payout run result from this console session.
                    </p>
                  </div>
                  {lastExecutionResult ? (
                    <div className="text-sm text-slate-400">
                      {lastExecutionResult.items.length} batch
                      {lastExecutionResult.items.length === 1 ? "" : "es"}
                    </div>
                  ) : null}
                </div>
                {!lastExecutionResult ? (
                  <div className="mt-4 text-sm text-slate-500">
                    No dry run or payout execution has been performed in this session.
                  </div>
                ) : lastExecutionResult.items.length === 0 ? (
                  <div className="mt-4 text-sm text-slate-500">
                    No approved payouts matched the current execution input.
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {lastExecutionResult.items.map((item, index) => (
                      <div
                        key={`${item.recipientWalletAddress}-${index}`}
                        className="border border-white/8 bg-[#0f1728] p-4"
                      >
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="truncate font-medium text-white">
                              {item.recipientWalletAddress}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {item.ledgerEntryIds.length} ledger entries • {item.payoutRail}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "inline-flex w-fit border px-2 py-1 text-xs",
                              statusBadgeClassName(item.status),
                            )}
                          >
                            {item.status}
                          </span>
                        </div>
                        <p className="mt-3 text-sm text-slate-300">
                          {formatAssetAmount(item.amount, item.assetCode)}
                        </p>
                        {item.txHash ? (
                          <p className="mt-1 truncate text-xs text-slate-500">
                            Tx hash: {item.txHash}
                          </p>
                        ) : null}
                        {item.reason ? (
                          <p className="mt-2 text-xs text-rose-200">{item.reason}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 border border-white/8 bg-[#0b1220] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-medium text-white">Last reconciliation</h4>
                    <p className="text-sm text-slate-400">
                      Latest submitted-payout reconciliation result from this console session.
                    </p>
                  </div>
                  {lastReconciliationResult ? (
                    <div className="text-sm text-slate-400">
                      {lastReconciliationResult.items.length} batch
                      {lastReconciliationResult.items.length === 1 ? "" : "es"}
                    </div>
                  ) : null}
                </div>
                {!lastReconciliationResult ? (
                  <div className="mt-4 text-sm text-slate-500">
                    No reconciliation has been performed in this session.
                  </div>
                ) : lastReconciliationResult.items.length === 0 ? (
                  <div className="mt-4 text-sm text-slate-500">
                    No submitted payouts matched the current reconciliation input.
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {lastReconciliationResult.items.map((item) => (
                      <div
                        key={item.payoutId}
                        className="border border-white/8 bg-[#0f1728] p-4"
                      >
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="truncate font-medium text-white">{item.payoutId}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {item.ledgerEntryIds.length} ledger entries
                            </p>
                          </div>
                          <span
                            className={cn(
                              "inline-flex w-fit border px-2 py-1 text-xs",
                              statusBadgeClassName(item.status),
                            )}
                          >
                            {item.status}
                          </span>
                        </div>
                        {item.txHash ? (
                          <p className="mt-2 truncate text-xs text-slate-500">
                            Tx hash: {item.txHash}
                          </p>
                        ) : null}
                        {item.reason ? (
                          <p className="mt-2 text-xs text-rose-200">{item.reason}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className={cn(shellPanelClassName, "overflow-hidden")}>
              <div className="border-b border-white/8 px-5 py-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">Payout history</h3>
                  <p className="text-sm text-slate-400">
                    Submitted, confirmed, and failed payouts with treasury execution references.
                  </p>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-[160px_minmax(0,1fr)]">
                  <select
                    value={payoutStatusFilter}
                    onChange={(event) =>
                      setPayoutStatusFilter(
                        event.target.value as RoyaltyPayoutRecord["status"] | "all",
                      )
                    }
                    className={selectClassName}
                  >
                    <option value="all">All statuses</option>
                    <option value="pending">Pending</option>
                    <option value="submitted">Submitted</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="failed">Failed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <Input
                    value={payoutRecipientFilter}
                    onChange={(event) => setPayoutRecipientFilter(event.target.value)}
                    placeholder="Filter by recipient, tx hash, payout id, or asset"
                    className={fieldClassName}
                  />
                </div>
              </div>

              {filteredPayoutHistory.length === 0 ? (
                <div className="px-5 py-10">
                  <EmptyState
                    title="No payouts match these filters"
                    description="Run a payout batch or broaden the history filters to inspect previous treasury activity."
                  />
                </div>
              ) : (
                filteredPayoutHistory.map((payout) => (
                  <div key={payout.id} className="border-t border-white/6 px-5 py-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-white">
                          {payout.recipientWalletAddress}
                        </p>
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {payout.id} • {payout.payoutRail} • {payout.ledgerEntryIds.length} entries
                        </p>
                      </div>
                      <span
                        className={cn(
                          "inline-flex w-fit border px-2 py-1 text-xs",
                          statusBadgeClassName(payout.status),
                        )}
                      >
                        {payout.status}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-300 md:grid-cols-2">
                      <p>{formatAssetAmount(payout.amount, payout.assetCode)}</p>
                      <p>
                        {payout.status === "confirmed"
                          ? formatDateTime(payout.confirmedAt ?? payout.updatedAt)
                          : payout.status === "submitted"
                            ? formatDateTime(payout.submittedAt ?? payout.updatedAt)
                            : formatDateTime(payout.updatedAt)}
                      </p>
                    </div>
                    {payout.txHash ? (
                      <p className="mt-2 truncate text-xs text-slate-500">
                        Tx hash: {payout.txHash}
                      </p>
                    ) : null}
                    {payout.failureReason ? (
                      <p className="mt-2 text-xs text-rose-200">{payout.failureReason}</p>
                    ) : null}
                  </div>
                ))
              )}
            </section>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <section className={cn(shellPanelClassName, "p-5")}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="royalty-track-search">Find track</Label>
                <Input
                  id="royalty-track-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by title, artist, or track id"
                  className={fieldClassName}
                />
              </div>

              <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
                {filteredTracks.length === 0 ? (
                  <EmptyState
                    title="No matching tracks"
                    description="Try a different search term."
                  />
                ) : (
                  filteredTracks.map((track) => (
                    <button
                      key={track.id}
                      type="button"
                      onClick={() => setSelectedTrackId(track.id)}
                      className={cn(
                        "w-full border px-4 py-3 text-left transition",
                        selectedTrackId === track.id
                          ? "border-emerald-400/25 bg-emerald-400/8"
                          : "border-white/8 bg-[#0b1220] hover:border-white/12 hover:bg-white/[0.03]",
                      )}
                    >
                      <p className="truncate font-medium text-white">{track.title}</p>
                      <p className="mt-1 truncate text-sm text-slate-400">
                        {track.artistName}
                      </p>
                      <p className="mt-2 truncate text-xs text-slate-500">{track.id}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          </section>

          <div className="space-y-6">
            {!selectedTrack ? (
              <EmptyState
                title="Select a track"
                description="Choose a track from the list to manage its royalty split."
              />
            ) : (
              <>
                <section className={cn(shellPanelClassName, "p-5")}>
                  <div className="flex flex-col gap-4 border-b border-white/8 pb-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        {selectedTrack.title}
                      </h3>
                      <p className="mt-1 text-sm text-slate-400">
                        {selectedTrack.artistName} • {selectedTrack.id}
                      </p>
                    </div>
                    {activeSplit ? (
                      <div className="border border-emerald-400/20 bg-emerald-400/8 px-3 py-2 text-sm text-emerald-200">
                        Active split v{activeSplit.version}
                      </div>
                    ) : (
                      <div className="border border-white/8 bg-[#0b1220] px-3 py-2 text-sm text-slate-300">
                        No split yet
                      </div>
                    )}
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-5">
                    <StatTile label="Status" value={activeSplit?.status ?? "Draft"} />
                    <StatTile
                      label="Recipients"
                      value={String(activeSplit?.recipients.length ?? draftRecipients.length)}
                    />
                    <StatTile
                      label="Total"
                      value={formatSharePercent(activeSplit?.totalBps ?? totalDraftBps)}
                    />
                    <StatTile label="Ledger entries" value={String(ledgerEntries.length)} />
                    <StatTile
                      label="On-chain"
                      value={activeSplit?.registryVerificationStatus ?? "unverified"}
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/8 pt-4">
                    <Button
                      type="button"
                      className="h-10 rounded-md"
                      disabled={!activeSplit || isPublishingSplit}
                      onClick={() => void handlePublishSplit()}
                    >
                      {isPublishingSplit ? "Publishing..." : "Publish to Soroban"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-10 border border-white/8 text-slate-300 hover:bg-white/[0.04]"
                      disabled={!activeSplit || isVerifyingSplit}
                      onClick={() => void handleVerifySplit()}
                    >
                      {isVerifyingSplit ? "Verifying..." : "Verify on-chain"}
                    </Button>
                    {activeSplit?.registryTxHash ? (
                      <a
                        href={stellarTransactionExplorerUrl(
                          activeSplit.registryTxHash,
                          activeSplit.registryNetwork,
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-10 items-center border border-white/8 px-3 text-sm text-emerald-200 hover:bg-white/[0.04]"
                      >
                        View publish transaction
                        <CircleArrowOutUpRight className="ml-2 h-4 w-4" />
                      </a>
                    ) : config?.registryExplorerUrl ? (
                      <a
                        href={config.registryExplorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-10 items-center border border-white/8 px-3 text-sm text-slate-300 hover:bg-white/[0.04]"
                      >
                        View contract
                        <CircleArrowOutUpRight className="ml-2 h-4 w-4" />
                      </a>
                    ) : null}
                    {activeSplit?.registryVerificationMessage ? (
                      <p
                        className={cn(
                          "text-sm",
                          activeSplit.registryVerificationStatus === "match"
                            ? "text-emerald-200"
                            : "text-amber-200",
                        )}
                      >
                        {activeSplit.registryVerificationMessage}
                      </p>
                    ) : null}
                  </div>
                </section>

                <section className={cn(shellPanelClassName, "p-5")}>
                  <div className="mb-4 flex items-center justify-between gap-3 border-b border-white/8 pb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-white">Split editor</h3>
                      <p className="text-sm text-slate-400">
                        Percentages must total exactly 100%.
                      </p>
                    </div>
                    <div className="text-sm text-slate-300">
                      Draft total:{" "}
                      <span
                        className={cn(
                          totalDraftBps === 10_000 ? "text-emerald-300" : "text-amber-300",
                        )}
                      >
                        {formatSharePercent(totalDraftBps)}
                      </span>
                    </div>
                  </div>

                  <form className="space-y-4" onSubmit={handleSave}>
                    <div className="space-y-3">
                      {draftRecipients.map((recipient, index) => (
                        <div
                          key={`${selectedTrack.id}-recipient-${index}`}
                          className="grid gap-3 border border-white/8 bg-[#0b1220] p-4 lg:grid-cols-[minmax(0,1.3fr)_110px_150px_120px_72px]"
                        >
                          <Input
                            value={recipient.walletAddress}
                            onChange={(event) =>
                              updateRecipient(index, {
                                walletAddress: event.target.value,
                              })
                            }
                            placeholder="Recipient wallet / address"
                            className={fieldClassName}
                            required
                          />
                          <select
                            value={recipient.chain}
                            onChange={(event) =>
                              updateRecipient(index, {
                                chain: event.target.value as EditableRoyaltyRecipient["chain"],
                              })
                            }
                            className={selectClassName}
                          >
                            <option value="stellar">stellar</option>
                            <option value="evm">evm</option>
                            <option value="solana">solana</option>
                            <option value="manual">manual</option>
                          </select>
                          <select
                            value={recipient.role}
                            onChange={(event) =>
                              updateRecipient(index, {
                                role: event.target.value as EditableRoyaltyRecipient["role"],
                              })
                            }
                            className={selectClassName}
                          >
                            <option value="artist">artist</option>
                            <option value="producer">producer</option>
                            <option value="writer">writer</option>
                            <option value="featured_artist">featured artist</option>
                            <option value="label">label</option>
                            <option value="platform">platform</option>
                            <option value="other">other</option>
                          </select>
                          <Input
                            value={recipient.shareBps}
                            onChange={(event) =>
                              updateRecipient(index, { shareBps: event.target.value })
                            }
                            inputMode="numeric"
                            placeholder="BPS"
                            className={fieldClassName}
                            required
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            className="border border-white/8 text-slate-300 hover:bg-white/[0.04]"
                            disabled={draftRecipients.length === 1}
                            onClick={() => removeRecipient(index)}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Button
                        type="button"
                        variant="ghost"
                        className="border border-white/8 text-slate-300 hover:bg-white/[0.04]"
                        onClick={addRecipient}
                      >
                        Add recipient
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="border border-white/8 text-slate-300 hover:bg-white/[0.04]"
                        onClick={() => syncDraftFromSplit(activeSplit)}
                      >
                        Reset to active split
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="royalty-notes">Notes</Label>
                      <textarea
                        id="royalty-notes"
                        value={draftNotes}
                        onChange={(event) => setDraftNotes(event.target.value)}
                        placeholder="Optional internal note about this split version"
                        className={cn(fieldClassName, "min-h-[90px] py-3")}
                      />
                    </div>

                    <Button type="submit" className="h-10 rounded-md" disabled={isSaving}>
                      {isSaving ? "Saving split..." : "Save active split"}
                    </Button>
                  </form>
                </section>

                <section className={cn(shellPanelClassName, "overflow-hidden")}>
                  <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
                    <div>
                      <h3 className="text-sm font-semibold text-white">Split history</h3>
                      <p className="text-sm text-slate-400">
                        Previous versions remain visible for auditability.
                      </p>
                    </div>
                    {isSplitLoading ? (
                      <div className="text-sm text-slate-400">Refreshing…</div>
                    ) : null}
                  </div>

                  {splitHistory.length === 0 ? (
                    <div className="px-4 py-8 text-sm text-slate-400">
                      No split versions have been created for this track yet.
                    </div>
                  ) : (
                    splitHistory.map((split) => (
                      <div key={split.id} className="border-t border-white/6 px-4 py-4">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-white">
                              Version {split.version}
                            </span>
                            <span
                              className={cn(
                                "inline-flex border px-2 py-1 text-xs",
                                split.status === "active"
                                  ? "border-emerald-400/25 bg-emerald-400/8 text-emerald-200"
                                  : "border-white/10 text-slate-300",
                              )}
                            >
                              {split.status}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">
                            Updated {formatDateTime(split.updatedAt)}
                          </p>
                        </div>
                        <div className="mt-3 space-y-2">
                          {split.recipients.map((recipient, index) => (
                            <div
                              key={`${split.id}-${index}`}
                              className="grid gap-3 text-sm text-slate-300 md:grid-cols-[minmax(0,1.4fr)_110px_150px_100px]"
                            >
                              <span className="truncate">{recipient.walletAddress}</span>
                              <span>{recipient.chain}</span>
                              <span>{recipient.role}</span>
                              <span>{formatSharePercent(recipient.shareBps)}</span>
                            </div>
                          ))}
                        </div>
                        {split.registryKind === "soroban" ? (
                          <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">
                            <span>Registry: Soroban</span>
                            <span>Verification: {split.registryVerificationStatus}</span>
                            {split.registryTxHash ? (
                              <a
                                href={stellarTransactionExplorerUrl(
                                  split.registryTxHash,
                                  split.registryNetwork,
                                )}
                                target="_blank"
                                rel="noreferrer"
                                className="text-emerald-200 hover:text-emerald-100"
                              >
                                Explorer transaction
                              </a>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ))
                  )}
                </section>

                <section className={cn(shellPanelClassName, "overflow-hidden")}>
                  <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
                    <div>
                      <h3 className="text-sm font-semibold text-white">Track ledger</h3>
                      <p className="text-sm text-slate-400">
                        Generated earnings entries for the selected track.
                      </p>
                    </div>
                  </div>

                  {ledgerEntries.length === 0 ? (
                    <div className="px-4 py-8 text-sm text-slate-400">
                      No royalty ledger entries have been created for this track yet.
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-[minmax(0,1.1fr)_120px_140px_120px_180px_170px] gap-4 border-b border-white/8 px-4 py-3 text-[0.68rem] uppercase tracking-[0.18em] text-slate-500">
                        <span>Recipient</span>
                        <span>Role</span>
                        <span>Amount</span>
                        <span>Status</span>
                        <span>Source</span>
                        <span>Created</span>
                      </div>
                      {ledgerEntries.map((entry) => (
                        <div
                          key={entry.id}
                          className="grid grid-cols-[minmax(0,1.1fr)_120px_140px_120px_180px_170px] gap-4 border-t border-white/6 px-4 py-4 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium text-white">
                              {entry.recipientWalletAddress}
                            </p>
                            <p className="mt-1 truncate text-xs text-slate-500">
                              {entry.recipientChain}
                            </p>
                          </div>
                          <div className="text-slate-300">{entry.recipientRole}</div>
                          <div className="text-slate-300">
                            {formatAssetAmount(entry.netAmount, entry.assetCode)}
                          </div>
                          <div>
                            <span
                              className={cn(
                                "inline-flex border px-2 py-1 text-xs",
                                statusBadgeClassName(entry.status),
                              )}
                            >
                              {entry.status}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-slate-300">{entry.sourceType}</p>
                            <p className="mt-1 truncate text-xs text-slate-500">
                              {entry.sourceId}
                            </p>
                          </div>
                          <div className="text-slate-300">
                            {formatDateTime(entry.createdAt)}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
};

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
