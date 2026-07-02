import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import {
  CreditCard,
  Eye,
  EyeOff,
  LayoutDashboard,
  LogOut,
  Percent,
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
  RoyaltyLedgerEntry,
  RoyaltyEngineConfig,
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
import { adminApi } from "@/features/auth/lib/admin-api";
import { useAdminAuth } from "@/features/auth/providers/admin-auth-provider";
import { cn } from "@/lib/utils";

const navItems = [
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
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const canManageTreasury = admin?.role === "super_admin";

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
      setOverview(next);
      setWalletAddress(next.settings.walletAddress);
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
          </aside>
        </div>

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

const RoyaltiesPage = () => {
  const { session } = useAdminAuth();
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [config, setConfig] = useState<RoyaltyEngineConfig | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [splitHistory, setSplitHistory] = useState<TrackRoyaltySplitRecord[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<RoyaltyLedgerEntry[]>([]);
  const [draftRecipients, setDraftRecipients] = useState<EditableRoyaltyRecipient[]>([]);
  const [draftNotes, setDraftNotes] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSplitLoading, setIsSplitLoading] = useState(false);

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
        const [nextTracks, nextConfig] = await Promise.all([
          adminApi.listTracks(session.token),
          adminApi.getRoyaltyConfig(session.token),
        ]);

        if (!cancelled) {
          setTracks(nextTracks);
          setConfig(nextConfig);
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
        const [response, nextLedgerEntries] = await Promise.all([
          adminApi.listTrackRoyaltySplits(selectedTrackId, session.token),
          adminApi.listTrackRoyaltyLedger(selectedTrackId, session.token),
        ]);

        if (!cancelled) {
          setSplitHistory(response.items);
          setLedgerEntries(nextLedgerEntries);
          syncDraftFromSplit(
            response.items.find((split) => split.status === "active") ??
              response.items[0] ??
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
      const [response, nextLedgerEntries] = await Promise.all([
        adminApi.listTrackRoyaltySplits(selectedTrackId, session.token),
        adminApi.listTrackRoyaltyLedger(selectedTrackId, session.token),
      ]);
      setSplitHistory(response.items);
      setLedgerEntries(nextLedgerEntries);
      syncDraftFromSplit(
        response.items.find((split) => split.status === "active") ??
          response.items[0] ??
          null,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save royalty split",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <SectionHeader
          title="Royalties"
          description="Manage canonical track split ownership with Stellar as the primary registry path."
        />

        <div className="grid gap-3 md:grid-cols-4">
          <StatTile
            label="Primary chain"
            value={config?.primaryChain?.toUpperCase() ?? "—"}
          />
          <StatTile label="Network" value={config?.primaryNetwork ?? "—"} />
          <StatTile label="Registry" value={config?.registryKind ?? "—"} />
          <StatTile
            label="Settlement"
            value={config?.settlementRails.join(", ") ?? "—"}
          />
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

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <StatTile
                      label="Status"
                      value={activeSplit?.status ?? "Draft"}
                    />
                    <StatTile
                      label="Recipients"
                      value={String(activeSplit?.recipients.length ?? draftRecipients.length)}
                    />
                    <StatTile
                      label="Total"
                      value={formatSharePercent(activeSplit?.totalBps ?? totalDraftBps)}
                    />
                    <StatTile
                      label="Ledger entries"
                      value={String(ledgerEntries.length)}
                    />
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
                      <div
                        key={split.id}
                        className="border-t border-white/6 px-4 py-4"
                      >
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
                      </div>
                    ))
                  )}
                </section>

                <section className={cn(shellPanelClassName, "overflow-hidden")}>
                  <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
                    <div>
                      <h3 className="text-sm font-semibold text-white">Royalty ledger</h3>
                      <p className="text-sm text-slate-400">
                        Generated earnings entries for this track.
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
                            {entry.netAmount} {entry.assetCode ?? ""}
                          </div>
                          <div>
                            <span className="inline-flex border border-white/10 px-2 py-1 text-xs text-slate-300">
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
