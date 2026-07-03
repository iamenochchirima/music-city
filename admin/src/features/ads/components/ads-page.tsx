import { type FormEvent, useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { toast } from "sonner";
import {
  CreditCard,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Percent,
  ShieldCheck,
  Ticket,
  Users,
  Wallet,
} from "lucide-react";
import type {
  AdminRole,
  AdImpressionRecord,
  AdRecord,
  AdStatus,
  AdminAdListItem,
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

const shellPanelClassName = "border border-white/8 bg-[#0f1728]";
const selectClassName =
  "flex h-10 w-full rounded-md border border-white/10 bg-[#0b1220] px-3 text-sm text-white outline-none transition focus:border-emerald-300/35 focus:ring-2 focus:ring-emerald-300/15";
const textAreaClassName =
  "min-h-24 w-full rounded-md border border-white/10 bg-[#0b1220] px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-300/35 focus:ring-2 focus:ring-emerald-300/15";

type AdFormState = {
  name: string;
  brandName: string;
  status: AdStatus;
  audioUrl: string;
  clickUrl: string;
  startsAt: string;
  endsAt: string;
  priority: string;
  weight: string;
  maxImpressionsPerWalletPerDay: string;
  notes: string;
};

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

const createEmptyForm = (): AdFormState => ({
  name: "",
  brandName: "",
  status: "draft",
  audioUrl: "",
  clickUrl: "",
  startsAt: "",
  endsAt: "",
  priority: "0",
  weight: "1",
  maxImpressionsPerWalletPerDay: "3",
  notes: "",
});

const formatRole = (role: AdminRole) =>
  role === "super_admin" ? "Super admin" : "Admin";

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

const toDateTimeLocal = (value?: string) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

const fromDateTimeLocal = (value: string) => {
  if (!value.trim()) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

const statusBadgeClassName = (status: string) => {
  switch (status) {
    case "active":
    case "completed":
      return "border-emerald-400/25 bg-emerald-400/8 text-emerald-200";
    case "draft":
    case "pending":
      return "border-amber-400/25 bg-amber-400/8 text-amber-200";
    case "paused":
    case "started":
      return "border-sky-400/25 bg-sky-400/8 text-sky-200";
    case "failed":
    case "archived":
    case "skipped":
      return "border-rose-400/25 bg-rose-400/8 text-rose-200";
    default:
      return "border-white/10 text-slate-300";
  }
};

const StatTile = ({ label, value }: { label: string; value: string }) => (
  <div className={cn(shellPanelClassName, "px-4 py-3")}>
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

const SidebarLayout = ({ children }: { children: React.ReactNode }) => (
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

          <AdminSidebarFooter />
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

const AdminSidebarFooter = () => {
  const { admin, logout } = useAdminAuth();

  return (
    <div className="border-t border-white/8 px-4 py-4">
      <div className="space-y-1">
        <p className="truncate text-sm font-medium text-white">{admin?.name}</p>
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
  );
};

const mapAdToForm = (ad: AdRecord): AdFormState => ({
  name: ad.name,
  brandName: ad.brandName ?? "",
  status: ad.status,
  audioUrl: ad.audioUrl,
  clickUrl: ad.clickUrl ?? "",
  startsAt: toDateTimeLocal(ad.startsAt),
  endsAt: toDateTimeLocal(ad.endsAt),
  priority: String(ad.priority),
  weight: String(ad.weight),
  maxImpressionsPerWalletPerDay: String(ad.maxImpressionsPerWalletPerDay),
  notes: ad.notes ?? "",
});

export const AdsPage = () => {
  const { session } = useAdminAuth();
  const [ads, setAds] = useState<AdminAdListItem[]>([]);
  const [impressions, setImpressions] = useState<AdImpressionRecord[]>([]);
  const [selectedAdId, setSelectedAdId] = useState<string | null>(null);
  const [form, setForm] = useState<AdFormState>(() => createEmptyForm());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const token = session?.token;

  const loadAds = async () => {
    if (!token) {
      return;
    }

    const [nextAds, nextImpressions] = await Promise.all([
      adminApi.listAds(token),
      adminApi.listAdImpressions(token),
    ]);

    setAds(nextAds);
    setImpressions(nextImpressions);
    setSelectedAdId((current) =>
      current && nextAds.some((ad) => ad.id === current) ? current : nextAds[0]?.id ?? null,
    );
  };

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    const run = async () => {
      setIsLoading(true);

      try {
        const [nextAds, nextImpressions] = await Promise.all([
          adminApi.listAds(token),
          adminApi.listAdImpressions(token),
        ]);

        if (cancelled) {
          return;
        }

        setAds(nextAds);
        setImpressions(nextImpressions);
        setSelectedAdId(nextAds[0]?.id ?? null);
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Unable to load ads");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const selectedAd = useMemo(
    () => ads.find((item) => item.id === selectedAdId) ?? null,
    [ads, selectedAdId],
  );

  useEffect(() => {
    if (!selectedAd) {
      setForm(createEmptyForm());
      return;
    }

    setForm(mapAdToForm(selectedAd));
  }, [selectedAd]);

  const impressionSummary = useMemo(
    () =>
      impressions.reduce(
        (summary, impression) => {
          summary.total += 1;
          if (impression.status === "completed") {
            summary.completed += 1;
          }
          if (impression.status === "failed") {
            summary.failed += 1;
          }
          if (impression.status === "skipped") {
            summary.skipped += 1;
          }
          return summary;
        },
        {
          total: 0,
          completed: 0,
          failed: 0,
          skipped: 0,
        },
      ),
    [impressions],
  );

  const selectedImpressions = useMemo(
    () =>
      impressions
        .filter((impression) => impression.adId === selectedAdId)
        .sort(
          (left, right) =>
            Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
        )
        .slice(0, 12),
    [impressions, selectedAdId],
  );

  const activeAdsCount = ads.filter((ad) => ad.status === "active").length;

  const handleChange = <K extends keyof AdFormState>(key: K, value: AdFormState[K]) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const resetForNewAd = () => {
    setSelectedAdId(null);
    setForm(createEmptyForm());
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!token) {
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        name: form.name.trim(),
        brandName: form.brandName.trim() || undefined,
        status: form.status,
        slot: "preroll" as const,
        audioUrl: form.audioUrl.trim(),
        clickUrl: form.clickUrl.trim() || undefined,
        startsAt: fromDateTimeLocal(form.startsAt),
        endsAt: fromDateTimeLocal(form.endsAt),
        priority: Number(form.priority),
        weight: Number(form.weight),
        targetAccess: "public" as const,
        maxImpressionsPerWalletPerDay: Number(form.maxImpressionsPerWalletPerDay),
        notes: form.notes.trim() || undefined,
      };

      if (selectedAdId) {
        await adminApi.updateAd(selectedAdId, payload, token);
        toast.success("Ad updated");
      } else {
        await adminApi.createAd(payload, token);
        toast.success("Ad created");
      }

      await loadAds();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save ad");
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!token || !selectedAdId) {
      return;
    }

    try {
      await adminApi.archiveAd(selectedAdId, token);
      toast.success("Ad archived");
      await loadAds();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to archive ad");
    }
  };

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <SectionHeader
          title="Ads"
          description="Manage admin-run preroll audio inventory for unsubscribed public playback."
          action={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void loadAds()} disabled={!token}>
                Refresh
              </Button>
              <Button onClick={resetForNewAd}>New ad</Button>
            </div>
          }
        />

        <div className="grid gap-3 md:grid-cols-4">
          <StatTile label="Campaigns" value={String(ads.length)} />
          <StatTile label="Active" value={String(activeAdsCount)} />
          <StatTile label="Impressions" value={String(impressionSummary.total)} />
          <StatTile
            label="Completed"
            value={String(impressionSummary.completed)}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)_360px]">
          <Card className={shellPanelClassName}>
            <CardHeader>
              <CardTitle className="text-lg text-white">Inventory</CardTitle>
              <CardDescription className="text-slate-400">
                Active, draft, paused, and archived audio spots.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                <p className="text-sm text-slate-400">Loading ads...</p>
              ) : ads.length === 0 ? (
                <p className="text-sm text-slate-400">No ads configured yet.</p>
              ) : (
                ads.map((ad) => (
                  <button
                    key={ad.id}
                    type="button"
                    onClick={() => setSelectedAdId(ad.id)}
                    className={cn(
                      "w-full rounded-md border px-4 py-3 text-left transition",
                      ad.id === selectedAdId
                        ? "border-emerald-300/35 bg-emerald-300/8"
                        : "border-white/10 bg-black/20 hover:bg-white/5",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">{ad.name}</p>
                        <p className="truncate text-xs text-slate-400">
                          {ad.brandName || "Independent campaign"}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "rounded-full border px-2 py-1 text-[0.65rem] uppercase tracking-[0.16em]",
                          statusBadgeClassName(ad.status),
                        )}
                      >
                        {ad.status}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400">
                      <span>{ad.summary.total} impressions</span>
                      <span>{ad.summary.completed} completed</span>
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          <Card className={shellPanelClassName}>
            <CardHeader>
              <CardTitle className="text-lg text-white">
                {selectedAdId ? "Edit campaign" : "Create campaign"}
              </CardTitle>
              <CardDescription className="text-slate-400">
                This MVP serves public-track preroll only and falls back to track playback on ad errors.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ad-name">Campaign name</Label>
                    <Input
                      id="ad-name"
                      value={form.name}
                      onChange={(event) => handleChange("name", event.target.value)}
                      placeholder="Weekend launch spot"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ad-brand-name">Brand</Label>
                    <Input
                      id="ad-brand-name"
                      value={form.brandName}
                      onChange={(event) => handleChange("brandName", event.target.value)}
                      placeholder="Brand or sponsor"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ad-status">Status</Label>
                    <select
                      id="ad-status"
                      value={form.status}
                      onChange={(event) =>
                        handleChange("status", event.target.value as AdStatus)
                      }
                      className={selectClassName}
                    >
                      <option value="draft">Draft</option>
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ad-cap">Daily wallet cap</Label>
                    <Input
                      id="ad-cap"
                      type="number"
                      min={1}
                      max={1000}
                      value={form.maxImpressionsPerWalletPerDay}
                      onChange={(event) =>
                        handleChange("maxImpressionsPerWalletPerDay", event.target.value)
                      }
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ad-audio-url">Audio URL</Label>
                  <Input
                    id="ad-audio-url"
                    value={form.audioUrl}
                    onChange={(event) => handleChange("audioUrl", event.target.value)}
                    placeholder="https://..."
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ad-click-url">Click URL</Label>
                  <Input
                    id="ad-click-url"
                    value={form.clickUrl}
                    onChange={(event) => handleChange("clickUrl", event.target.value)}
                    placeholder="https://..."
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ad-starts-at">Starts at</Label>
                    <Input
                      id="ad-starts-at"
                      type="datetime-local"
                      value={form.startsAt}
                      onChange={(event) => handleChange("startsAt", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ad-ends-at">Ends at</Label>
                    <Input
                      id="ad-ends-at"
                      type="datetime-local"
                      value={form.endsAt}
                      onChange={(event) => handleChange("endsAt", event.target.value)}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ad-priority">Priority</Label>
                    <Input
                      id="ad-priority"
                      type="number"
                      min={0}
                      max={10000}
                      value={form.priority}
                      onChange={(event) => handleChange("priority", event.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ad-weight">Weight</Label>
                    <Input
                      id="ad-weight"
                      type="number"
                      min={1}
                      max={10000}
                      value={form.weight}
                      onChange={(event) => handleChange("weight", event.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ad-notes">Notes</Label>
                  <textarea
                    id="ad-notes"
                    value={form.notes}
                    onChange={(event) => handleChange("notes", event.target.value)}
                    className={textAreaClassName}
                    placeholder="Campaign context, trafficking notes, or timing constraints."
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? "Saving..." : selectedAdId ? "Save changes" : "Create ad"}
                  </Button>
                  {selectedAdId ? (
                    <Button type="button" variant="outline" onClick={handleArchive}>
                      Archive
                    </Button>
                  ) : null}
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className={shellPanelClassName}>
            <CardHeader>
              <CardTitle className="text-lg text-white">Delivery</CardTitle>
              <CardDescription className="text-slate-400">
                Recent impression states for the selected campaign.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedAd ? (
                <div className="rounded-md border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-medium text-white">{selectedAd.name}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Window {formatDateTime(selectedAd.startsAt)} to {formatDateTime(selectedAd.endsAt)}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400">
                    <span>{selectedAd.summary.pending} pending</span>
                    <span>{selectedAd.summary.started} started</span>
                    <span>{selectedAd.summary.completed} completed</span>
                    <span>{selectedAd.summary.failed} failed</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400">
                  Select a campaign to inspect impression activity.
                </p>
              )}

              {selectedImpressions.length === 0 ? (
                <p className="text-sm text-slate-400">No impressions recorded yet.</p>
              ) : (
                selectedImpressions.map((impression) => (
                  <div
                    key={impression.id}
                    className="rounded-md border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs uppercase tracking-[0.16em] text-slate-500">
                          {impression.id}
                        </p>
                        <p className="mt-1 text-sm text-white">
                          Track {impression.trackId}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "rounded-full border px-2 py-1 text-[0.65rem] uppercase tracking-[0.16em]",
                          statusBadgeClassName(impression.status),
                        )}
                      >
                        {impression.status}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      Wallet {impression.walletAddress}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Updated {formatDateTime(impression.updatedAt)}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </SidebarLayout>
  );
};
