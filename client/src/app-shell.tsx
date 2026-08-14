import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/react";

import { AppProviders } from "@/components/layout/app-providers";
import { SiteHeader } from "@/components/layout/site-header";
import { AppRoutes } from "@/app-routes";

export const AppShell = () => {
  return (
    <AppProviders>
      <div className="min-h-screen bg-slate-950 text-white">
        <SiteHeader />
        <main>
          <AppRoutes />
        </main>
        <Toaster richColors position="top-right" />
        <Analytics />
      </div>
    </AppProviders>
  );
};
