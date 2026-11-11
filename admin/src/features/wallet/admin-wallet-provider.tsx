import {useEffect, useRef, type ReactNode} from "react";
import {DynamicContextProvider, DynamicMultiWalletPromptsWidget, useDynamicContext, useUserWallets} from "@dynamic-labs/sdk-react-core";
import {DynamicWaasStellarConnectors} from "@dynamic-labs/stellar";
import {AdminWalletContext} from "./admin-wallet-context";
import {adminEnv} from "@/lib/config/env";
import {resolveStellarWallet} from "./resolve-stellar-wallet";
import {useStellarAuthorization} from "./use-stellar-authorization";
import {useAdminAuth} from "@/features/auth/providers/admin-auth-provider";


function Connection({children}:{children:ReactNode}) {
  const {sdkHasLoaded, primaryWallet, user, setShowAuthFlow, handleLogOut} = useDynamicContext();
  const wallets = useUserWallets();
  const authorize = useStellarAuthorization();
  const {admin} = useAdminAuth();
  const previousAdmin = useRef<string|null>(null);
  useEffect(()=>{
    if (previousAdmin.current && previousAdmin.current !== admin?.id) {
      void handleLogOut();
    }
    previousAdmin.current = admin?.id ?? null;
  },[admin?.id,handleLogOut]);
  return <AdminWalletContext.Provider value={{ready:sdkHasLoaded, wallet:resolveStellarWallet(null,primaryWallet,wallets), email:user?.email, connect:()=>{if (!sdkHasLoaded) throw new Error("Wallet sign-in has not loaded. Refresh this page and try again."); setShowAuthFlow(true);}, disconnect:handleLogOut, authorize}}>{children}</AdminWalletContext.Provider>;
}

export function AdminWalletProvider({children}:{children:ReactNode}) {
  if (!adminEnv.dynamicEnvironmentId) return children;
  return <DynamicContextProvider settings={{
    environmentId:adminEnv.dynamicEnvironmentId,
    redirectUrl:`${window.location.origin}/console/settlements`,
    walletConnectors:[DynamicWaasStellarConnectors],
    social:{strategy:"redirect"},
    events:{
      onAuthFailure:()=>window.dispatchEvent(new Event("admin-wallet-auth-cancel")),
    },
  }}>
    <Connection>{children}</Connection>
    <DynamicMultiWalletPromptsWidget />
  </DynamicContextProvider>;
}

