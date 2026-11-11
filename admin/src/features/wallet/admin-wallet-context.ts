import {createContext, useContext} from "react";
import type {StellarWallet} from "@dynamic-labs/stellar";

export type WalletConnection = {
  ready: boolean;
  wallet: StellarWallet | null;
  email?: string;
  connect: () => void;
  disconnect: () => Promise<void>;
  authorize: (wallet: StellarWallet) => Promise<void>;
};
const unavailable = () => {throw Error("Wallet sign-in is not configured for the admin site");};
export const AdminWalletContext = createContext<WalletConnection>({ready:false, wallet:null, connect:unavailable, disconnect:async()=>unavailable(), authorize:async()=>unavailable()});


export const useAdminWalletConnection = () => useContext(AdminWalletContext);
