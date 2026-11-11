import {clientEnv} from "@/lib/config/env";
import {useCallback,useEffect,useRef,useState} from "react";
import {useDynamicContext,useUserWallets} from "@dynamic-labs/sdk-react-core";
import type {PoolOrder,PoolAttempt} from "@music-city/shared";
import {useAuth} from "@/hooks/use-auth";
import {httpClient} from "@/lib/api/http-client";
import {resolveStellarWallet} from "@/features/wallet/lib/resolve-stellar-wallet";
import {useStellarAuthorization} from "@/features/wallet/lib/use-stellar-authorization";
import {Button} from "@/components/ui/button";
const money=(s:string)=>`${BigInt(s)/10000000n}.${(BigInt(s)%10000000n).toString().padStart(7,"0").replace(/0+$/,"")||"00"}`;
type Data={enabled:boolean;acceptingPurchases?:boolean;orders:(PoolOrder&{trackTitle?:string})[];attempts:PoolAttempt[]};
export function PoolClaims({onEnabledChange}:{onEnabledChange:(enabled:boolean)=>void}){
 const {session}=useAuth(),{primaryWallet}=useDynamicContext(),wallets=useUserWallets(),authorize=useStellarAuthorization();
 const token=session?.token,tokenRef=useRef(token);tokenRef.current=token;
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState<string|null>(null),[busy,setBusy]=useState(false),[review,setReview]=useState<{order:PoolOrder;index:number}|null>(null);
 const load=useCallback(async()=>{if(!token)return;const r=await httpClient.get<Data>("/pool",token);if(tokenRef.current!==token)return;setData(r);onEnabledChange(r.enabled);},[token,onEnabledChange]);
 useEffect(()=>{setData(null);setReview(null);setError(null);onEnabledChange(false);void load().catch(()=>setError("We could not load your pool earnings. Refresh to check again."));const timer=setInterval(()=>void load().catch(()=>setError("We could not refresh pool earnings. Check their status before retrying.")),5000);return()=>clearInterval(timer);},[load,onEnabledChange]);
 if(!session||(!data?.enabled&&!error))return null;
 const claims=(data?.orders??[]).flatMap(order=>order.claims.filter(c=>c.beneficiary===session.walletAddress&&BigInt(c.amountUnits)>0n).map(c=>({order,claim:c})));
 const available=claims.filter(c=>!c.claim.claimed).reduce((sum,c)=>sum+BigInt(c.claim.amountUnits),0n);
 async function claim(){if(!review||!session)return;setBusy(true);setError(null);const requestToken=token;try{
  const wallet=resolveStellarWallet(session.walletAddress,primaryWallet,wallets);if(!wallet||wallet.address!==session.walletAddress)throw Error("Connect your signed-in Stellar wallet to claim");
  const {attempt}=await httpClient.post<{attempt:PoolAttempt}>("/pool/claims/prepare",{orderId:review.order.id,index:review.index},token);
  if(attempt.networkPassphrase!==clientEnv.stellarNetworkPassphrase)throw Error("Your wallet and claim must use the same Stellar network");
  if(attempt.treasuryAddress!==wallet.address)throw Error("Claim wallet changed. Review this withdrawal again");
  if(attempt.status==="awaiting_signatures"){
   await authorize(wallet);const signedTransaction=await wallet.signTransaction(attempt.transaction);
   if(tokenRef.current!==requestToken)throw Error("Account changed. Review this withdrawal again");
   await httpClient.post(`/pool/attempts/${attempt.id}/signatures`,{signedTransaction},token);
  }
  if(tokenRef.current!==requestToken)throw Error("Account changed. Review this withdrawal again");
  await httpClient.post(`/pool/attempts/${attempt.id}/submit`,{},token);setReview(null);await load();
 }catch(e){const message=e instanceof Error?e.message:"Claim could not be confirmed. Check its status before retrying.";setError(message.includes("Add the configured USDC trustline")?"Your wallet cannot receive USDC yet. Add the USDC trustline in your wallet, then return here to claim. Your earnings are still available.":message);}finally{setBusy(false);}}
 const notice=error&&<div role="alert" className="rounded-xl border border-destructive/30 p-4 text-sm"><p>{error}</p>{error.includes("trustline")&&<a href="/account" className="underline">Open wallet to add USDC trustline</a>}</div>;
 return <section className="space-y-4" aria-label="Pool earnings">
  <header><h2 className="text-xl font-semibold">Your earnings</h2><p className="text-sm text-muted-foreground">{data?.acceptingPurchases===false?"Previously registered pool earnings remain available to claim.":"Purchases register your USDC automatically. Claim with your wallet, without admin approval."}</p></header>
  {!review&&notice}<p className="rounded-xl border p-5 text-2xl">{money(available.toString())} USDC <span className="text-sm">available</span></p>
  {!claims.length&&<p className="text-sm text-muted-foreground">Your earnings appear here after a purchase confirms.</p>}
  {claims.map(({order,claim:c})=>{const attempt=data?.attempts.find(a=>a.batchId===order.id&&a.claimIndex===c.index&&["submitting","submitted","confirmed"].includes(a.status));return <article key={`${order.id}:${c.index}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"><div><p>{order.trackTitle??"Song purchase"}</p><p>{money(c.amountUnits)} USDC</p></div>{c.claimed?<span>Received</span>:attempt&&attempt.status!=="confirmed"?<span role="status">Confirming withdrawal</span>:<Button disabled={busy} onClick={()=>{setReview({order,index:c.index});setError(null);}}>Claim USDC</Button>}{attempt?.status==="confirmed"&&<a className="text-sm underline" target="_blank" rel="noreferrer" href={`https://stellar.expert/explorer/${attempt.networkPassphrase.includes("Test SDF")?"testnet":"public"}/tx/${attempt.transactionHash}`}>View receipt</a>}</article>;})}
  {review&&<section aria-label="Review pool withdrawal" className="space-y-3 rounded-xl border border-primary/40 p-5"><h3>Claim {money(review.order.claims[review.index]!.amountUnits)} USDC</h3><p className="break-all text-xs">To your Stellar wallet: {session.walletAddress}</p>{notice}<Button disabled={busy} onClick={()=>void claim()}>{busy?"Waiting for wallet":"Sign and claim"}</Button><Button disabled={busy} variant="outline" onClick={()=>setReview(null)}>Cancel</Button></section>}
 </section>;
}
