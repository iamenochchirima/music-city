import {afterEach, expect, it, vi} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
import type {ReactNode} from "react";
import {AdminWalletProvider} from "./admin-wallet-provider";
const m=vi.hoisted(()=>({settings:null as any,logout:vi.fn().mockResolvedValue(undefined),admin:"admin-a"}));
vi.mock("@dynamic-labs/sdk-react-core",()=>({
 DynamicContextProvider:({settings,children}:{settings:unknown;children:ReactNode})=>{m.settings=settings;return children;},
 DynamicMultiWalletPromptsWidget:()=>null,
 useDynamicContext:()=>({sdkHasLoaded:true,handleLogOut:m.logout}),useUserWallets:()=>[],
}));
vi.mock("@dynamic-labs/stellar",()=>({DynamicWaasStellarConnectors:()=>[]}));
vi.mock("./resolve-stellar-wallet",()=>({resolveStellarWallet:()=>null}));
vi.mock("./use-stellar-authorization",()=>({useStellarAuthorization:()=>vi.fn()}));
vi.mock("@/lib/config/env",()=>({adminEnv:{dynamicEnvironmentId:"admin-wallet-environment"}}));
vi.mock("@/features/auth/providers/admin-auth-provider",()=>({useAdminAuth:()=>({admin:m.admin?{id:m.admin}:null})}));
afterEach(()=>{cleanup();vi.clearAllMocks();m.admin="admin-a";});
it("returns Google wallet authentication to admin settlements on this origin",()=>{
 render(<AdminWalletProvider><p>Admin</p></AdminWalletProvider>);
 expect(screen.getByText("Admin")).toBeTruthy();
 expect(m.settings.redirectUrl).toBe(`${window.location.origin}/console/settlements`);
 expect(m.settings.environmentId).toBe("admin-wallet-environment");

});
it("disconnects the previous wallet when switching admin identities",()=>{
 const {rerender}=render(<AdminWalletProvider><p>Admin</p></AdminWalletProvider>);
 expect(m.logout).not.toHaveBeenCalled();m.admin="admin-b";
 rerender(<AdminWalletProvider><p>Admin</p></AdminWalletProvider>);
 expect(m.logout).toHaveBeenCalledTimes(1);
});
