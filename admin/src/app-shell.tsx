import { Toaster } from "sonner";

import { AppRoutes } from "@/app-routes";
import { AdminAuthProvider } from "@/features/auth/providers/admin-auth-provider";
import { AdminWalletProvider } from "@/features/wallet/admin-wallet-provider";

export const AppShell = () => {
  return (
    <AdminAuthProvider>
      <AdminWalletProvider>
      <div className="min-h-screen bg-[#050816] text-slate-100">
        <AppRoutes />
        <Toaster richColors position="top-right" />
      </div>
      </AdminWalletProvider>
    </AdminAuthProvider>
  );
};
