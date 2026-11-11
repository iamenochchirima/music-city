import {useCallback, useEffect, useRef, useState} from "react";
import {httpClient} from "@/lib/api/http-client";
import {adminEnv} from "@/lib/config/env";
import {useAdminWalletConnection} from "./admin-wallet-context";

export type LinkedAdminWallet = {walletAddress:string|null; eligible:boolean; networkPassphrase:string};
type Request = {id:string; token:string; expiresAt:string};

export function useAdminWallet(token:string) {
  const connection = useAdminWalletConnection();
  const [status,setStatus] = useState<LinkedAdminWallet|null>(null);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState<string|null>(null);
  const current = useRef({token, address:connection.wallet?.address});
  current.current = {token, address:connection.wallet?.address};
  const pending = useRef<null|{cancel:()=>void}>(null);
  const load = useCallback(async()=>{
    const result = await httpClient.get<LinkedAdminWallet>("/wallet",token);
    if (current.current.token === token) setStatus(result);
  },[token]);
  useEffect(()=>{
    setStatus(null);
    void load().catch(e=>setError(e.message));
    return ()=>pending.current?.cancel();
  },[load]);
  useEffect(()=>{
    const cancel = ()=>pending.current?.cancel();
    window.addEventListener("admin-wallet-auth-cancel",cancel);
    return ()=>window.removeEventListener("admin-wallet-auth-cancel",cancel);
  },[]);

  const run = async(input:{kind:"link"|"sign"; attemptId?:string})=>{
    if (pending.current) throw Error("Finish your current wallet request first");
    const wallet = connection.wallet;
    if (!wallet) {connection.connect(); return;}
    if (input.kind === "sign" && wallet.address !== status?.walletAddress) {
      throw Error("Connect the wallet linked to this admin account before signing");
    }
    let cancelled = false;
    let request:Request|undefined;
    const cancel = ()=>{
      cancelled = true;
      if (request) void httpClient.post(`/wallet/requests/${request.id}/cancel`,{},token).catch(()=>{});
    };
    const assertActive = ()=>{
      if (cancelled || current.current.token !== token || current.current.address !== wallet.address) {
        throw Error("Wallet request cancelled or account changed. Start again");
      }
      if (request && Date.parse(request.expiresAt) <= Date.now()) throw Error("Wallet request expired. Start again");
    };
    const capability = async<T,>(path:string,body?:object):Promise<T>=>{
      assertActive();
      const response = await fetch(`${adminEnv.apiBaseUrl.replace(/\/admin$/, "")}/admin-wallet/requests/${request!.id}${path}`,{
        method:body ? "POST" : "GET",
        headers:{"Content-Type":"application/json", "X-Wallet-Request-Token":request!.token},
        body:body ? JSON.stringify(body) : undefined,
      });
      const result = await response.json();
      assertActive();
      if (!response.ok) throw Error(result.message ?? result.error ?? "Wallet request failed");
      return result;
    };
    const operation = {cancel};
    pending.current = operation;
    setBusy(true); setError(null);
    try {
      request = await httpClient.post<Request>("/wallet/requests",input,token);
      assertActive();
      const view = await capability<{networkPassphrase:string; walletAddress:string|null}>("");
      if (view.networkPassphrase !== adminEnv.stellarNetworkPassphrase) throw Error("Admin wallet and treasury must use the same Stellar network");
      if (view.walletAddress && view.walletAddress !== wallet.address) throw Error("Choose the wallet linked to this admin account");
      const challenge = await capability<{transaction:string; networkPassphrase:string}>("/challenge",{walletAddress:wallet.address});
      if (challenge.networkPassphrase !== view.networkPassphrase) throw Error("Wallet request network changed");
      await connection.authorize(wallet);
      assertActive();
      const signedTransaction = await wallet.signTransaction(challenge.transaction);
      assertActive();
      await capability("/signed",{signedTransaction});
      assertActive();
      await httpClient.post(`/wallet/requests/${request.id}/confirm`,{},token);
      assertActive();
      await load();
    } catch(e) {
      cancel();
      if (current.current.token === token) setError(e instanceof Error ? e.message : "Wallet signing failed");
      throw e;
    } finally {
      if (pending.current === operation) {pending.current = null; setBusy(false);}
    }
  };
  return {
    status,busy,error,
    connectedAddress:connection.wallet?.address,
    connectedEmail:connection.email,
    ready:connection.ready,
    connect:connection.connect,
    switchWallet:async()=>{pending.current?.cancel(); await connection.disconnect(); connection.connect();},
    link:()=>run({kind:"link"}),
    signAttempt:(attemptId:string)=>run({kind:"sign",attemptId}),
    cancel:()=>{pending.current?.cancel(); window.dispatchEvent(new Event("admin-wallet-auth-cancel"));},refresh:load,
  };
}
