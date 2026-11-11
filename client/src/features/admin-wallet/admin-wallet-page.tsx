import {TokenScope} from "@dynamic-labs/sdk-api-core";
import {useEffect,useRef,useState} from "react";
import {useParams} from "react-router-dom";
import {useDynamicContext,useUserWallets,useStepUpAuthentication} from "@dynamic-labs/sdk-react-core";
import {useStellarAuthorization} from "@/features/wallet/lib/use-stellar-authorization";
import {resolveStellarWallet} from "@/features/wallet/lib/resolve-stellar-wallet";
import {clientEnv} from "@/lib/config/env";
import {Button} from "@/components/ui/button";
type Request={id:string;kind:"link"|"sign";adminName:string;adminEmail:string;walletAddress:string|null;networkPassphrase:string;summary:string;status:string;expiresAt:string};
export function AdminWalletPage(){
 const {isStepUpRequired}=useStepUpAuthentication();
 const {requestId}=useParams(),{sdkHasLoaded,primaryWallet,user,setShowAuthFlow,handleLogOut}=useDynamicContext(),wallets=useUserWallets(),authorize=useStellarAuthorization();
 const [request,setRequest]=useState<Request|null>(null),[error,setError]=useState<string|null>(null),[busy,setBusy]=useState(false),[sent,setSent]=useState(false);
 const wallet=resolveStellarWallet(null,primaryWallet,wallets);
 const addressRef=useRef(wallet?.address);addressRef.current=wallet?.address;
 const tokenRef=useRef<string|null>(null);
 async function api<T>(path:string,body?:object):Promise<T>{const response=await fetch(`${clientEnv.apiBaseUrl}/admin-wallet/requests/${requestId}${path}`,{method:body?"POST":"GET",headers:{"Content-Type":"application/json","X-Wallet-Request-Token":tokenRef.current??""},body:body?JSON.stringify(body):undefined});const result=await response.json();if(!response.ok)throw Error(result.error??result.message??"Wallet request failed");return result;}
 useEffect(()=>{
  const key=`music-city-admin-wallet:${requestId}`,params=new URLSearchParams(window.location.hash.slice(1)),token=params.get("token")??sessionStorage.getItem(key);
  tokenRef.current=token;
  if(token){sessionStorage.setItem(key,token);sessionStorage.setItem("music-city-admin-wallet-return",window.location.pathname);if(params.has("token"))history.replaceState(history.state,"",window.location.pathname+window.location.search);}
  if(!token){setError("This signing page must be opened from your admin account.");return;}
  let active=true;void api<Request>("").then(r=>{if(active)setRequest(r);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};
 },[requestId]);
 const resumeKey=`music-city-admin-wallet-signing:${requestId}`;
 useEffect(()=>{
  if(!request||!sdkHasLoaded||!user||busy||sent)return;
  const saved=sessionStorage.getItem(resumeKey);if(!saved)return;
  if(["signed","completed"].includes(request.status)){sessionStorage.removeItem(resumeKey);setSent(true);return;}
  if(saved!==wallet?.address){sessionStorage.removeItem(resumeKey);setError("Wallet account changed. Review this request and sign again.");return;}
  let active=true;
  void isStepUpRequired({scope:TokenScope.Walletsign}).then(required=>{
   if(!active||sessionStorage.getItem(resumeKey)!==saved)return;sessionStorage.removeItem(resumeKey);
   if(required){setError("Wallet authentication was not completed. Click sign when you are ready.");return;}
   void sign();
  }).catch(()=>{if(active){sessionStorage.removeItem(resumeKey);setError("Could not verify wallet authorization. Click sign to retry.");}});
  return()=>{active=false;};
 },[request?.id,sdkHasLoaded,user?.userId,wallet?.address,busy,sent,isStepUpRequired]);
 useEffect(()=>{
  const cancelled=()=>{sessionStorage.removeItem(resumeKey);};
  window.addEventListener("music-city:dynamic-auth-cancel",cancelled);window.addEventListener("music-city:dynamic-auth-failure",cancelled);
  return()=>{window.removeEventListener("music-city:dynamic-auth-cancel",cancelled);window.removeEventListener("music-city:dynamic-auth-failure",cancelled);};
 },[resumeKey]);
 async function sign(){if(!request||!wallet)return;setBusy(true);setError(null);const address=wallet.address;
  try{
   if(request.networkPassphrase!==clientEnv.stellarNetworkPassphrase)throw Error("The signing page and transaction must use the same Stellar network");
   if(request.walletAddress&&request.walletAddress!==address)throw Error("Choose the wallet linked to this admin account");
   const challenge=await api<{transaction:string;networkPassphrase:string}>("/challenge",{walletAddress:address});
   if(challenge.networkPassphrase!==request.networkPassphrase)throw Error("Wallet request network changed");
   sessionStorage.setItem(resumeKey,address);
   await authorize(wallet);
   if(addressRef.current&&addressRef.current!==address)throw Error("Wallet account changed. Review the request again");
   const signedTransaction=await wallet.signTransaction(challenge.transaction);
   if(addressRef.current&&addressRef.current!==address)throw Error("Wallet account changed. Review the request again");
   await api("/signed",{signedTransaction});setSent(true);sessionStorage.removeItem(resumeKey);
   sessionStorage.removeItem("music-city-admin-wallet-return");sessionStorage.removeItem(`music-city-admin-wallet:${requestId}`);
  }catch(e){sessionStorage.removeItem(resumeKey);setError(e instanceof Error?e.message:"Wallet signing failed");}finally{setBusy(false);}
 }
 const wrongWallet=!!request?.walletAddress&&wallet?.address!==request.walletAddress;
 return <main className="mx-auto max-w-xl space-y-5 p-6" aria-label="Admin wallet signing">
  <h1 className="text-2xl font-semibold">{request?.kind==="link"?"Link your admin wallet":"Sign treasury transaction"}</h1>
  {error&&<p role="alert" className="rounded-xl border border-destructive/30 p-4">{error}</p>}
  {!request&&!error&&<p role="status">Loading signing request…</p>}
  {request&&<><p>Admin: {request.adminName} · {request.adminEmail}</p><p>Wallet account: {user?.email??"Not signed in"}</p><p className="text-sm">Network: {request.networkPassphrase.includes("Test SDF")?"Stellar Testnet":"Configured Stellar network"}</p><p className="break-words">{request.summary}</p><p className="break-all text-sm">{request.walletAddress?`Required wallet: ${request.walletAddress}`:"Choose the authorized treasury wallet you personally control. A wallet can be linked to only one admin account."}</p>
   {sent?<p role="status">Signature sent. Return to the admin page to finish.</p>:<>
    <p className="break-all text-sm">Connected wallet: {wallet?.address??primaryWallet?.address??"Not connected"}</p>
    {wrongWallet&&<p role="alert">This is not the wallet linked to the admin. Switch accounts to continue.</p>}
    {!user&&<Button disabled={busy} onClick={()=>setShowAuthFlow(true)}>Connect wallet</Button>}
    {user&&<Button variant="outline" disabled={busy} onClick={async()=>{await handleLogOut();setShowAuthFlow(true);}}>Switch wallet account</Button>}
    {user&&wallet&&!wrongWallet&&<Button disabled={busy||Date.parse(request.expiresAt)<=Date.now()} onClick={()=>void sign()}>{busy?"Waiting for wallet":request.kind==="link"?"Prove ownership and link wallet":"Sign with my wallet"}</Button>}
   </>}
  </>}
 </main>;
}
